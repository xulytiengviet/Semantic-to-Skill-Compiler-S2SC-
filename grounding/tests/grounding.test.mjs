import test from 'node:test';
import assert from 'node:assert/strict';
import { Status, Role, GroundedToken, issueToken, tick, compileTokens, checkFeasibility,
         assertComparatorSensitivity, base27ToTrits, tritsToBase27, lexiconCoverage, evaluate } from '../src/index.mjs';
import { demoContext, acoustic, reference, noun, verb } from '../src/fixtures.mjs';
const clone = x => structuredClone(x);
const issued = () => issueToken(noun(), demoContext());
test('mandatory constructor evidence and nonforgeable status', () => {
  assert.throws(() => issueToken({ role: Role.NOUN, value: 'cốc' }, demoContext()), /evidence/);
  assert.throws(() => issueToken({ role: Role.NOUN, value: 'cốc', evidence: {} }, demoContext()), /evidence/);
  assert.throws(() => new GroundedToken(null, {}, 1, []), /issueToken/);
  const t = issued();
  assert.equal(t.status, Status.VERIFIED);
  assert.throws(() => { t.evidence.referential.objectId = 'fake'; }, TypeError);
  assert.throws(() => { t.status = 1; }, TypeError);
});
test('T0 base27 exactly 27 symbols, 3 trits, bijective in alphabet', () => {
  const s = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ ';
  const trits = base27ToTrits(s);
  assert.equal(trits.length, 27);
  assert.equal(tritsToBase27(trits), s);
  assert.equal(trits[25], '221');
  assert.equal(trits[26], '222');
  assert.throws(() => base27ToTrits('CỐC'), /A-Z/);
  assert.throws(() => tritsToBase27(['333']), /Invalid/);
});
test('positive NOUN and verb compile to only PROPOSED Task IR', () => {
  const ctx = demoContext();
  const result = compileTokens([issueToken(verb(), ctx), issueToken(noun(), ctx)], ctx);
  assert.equal(result.kind, 'ACCEPT');
  assert.equal(result.taskIR.status, 'PROPOSED');
  assert.equal('motor_command' in result.taskIR, false);
  assert.deepEqual(checkFeasibility(result, ctx.scene, { allow: true }),
    { kind: 'ELIGIBLE', status: 'REQUIRES_TRUSTED_ADMISSION' });
  assert.equal(checkFeasibility(result, ctx.scene, { allow: false }).kind, 'REJECT');
});
test('falsification 1: delete the referent -> -1, never relabel', () => {
  const ctx = demoContext(), t = issueToken(noun(), ctx);
  delete ctx.scene.objects.cup_1;
  assert.equal(tick(t, ctx).status, Status.REFUTED);
});
test('falsification 2: perturb acoustic F0 -> -1', () => {
  const ctx = demoContext(), e = noun();
  e.evidence.acoustic.f0ContourHz = [240, 230, 220];
  assert.equal(issueToken(e, ctx).status, Status.REFUTED);
});
test('falsification 3: TTL expiry -> 0 and no recovery of same token', () => {
  const ctx = demoContext(), t = issueToken(noun(), ctx);
  ctx.nowMs = 1200;
  const stale = tick(t, ctx);
  assert.equal(stale.status, Status.UNKNOWN);
  ctx.nowMs = 1000;
  assert.equal(tick(stale, ctx).status, Status.UNKNOWN);
  const renewed = issueToken(noun(), ctx);
  assert.equal(renewed.status, Status.VERIFIED);
  assert.notEqual(renewed.id, stale.id);
});
test('falsification 4: deleted skill -> compile reject', () => {
  const ctx = demoContext(), t = issueToken(verb(), ctx);
  delete ctx.skills.grasp;
  assert.equal(compileTokens([t], ctx).kind, 'REJECT');
});
test('falsification 5: constant +1 comparator detected', () => {
  const compare = x => evaluate(Role.NOUN, noun().evidence, x)
    .reduce((min, r) => Math.min(min, r.status), Status.VERIFIED);
  const good = demoContext(), missing = demoContext();
  delete missing.scene.objects.cup_1;
  assert.equal(assertComparatorSensitivity(compare, good, [missing]), true);
  assert.throws(() => assertComparatorSensitivity(() => Status.VERIFIED, good, [missing]),
    /E_COMPARATOR_INSENSITIVE/);
});
test('deictic unresolved -> 0; unknown token -> -1', () => {
  const ctx = demoContext();
  assert.equal(issueToken({ role: Role.DEICTIC, value: 'đó', evidence: { acoustic: acoustic() } }, ctx).status, Status.UNKNOWN);
  assert.equal(issueToken({ role: 'UNLISTED', value: 'foobar', evidence: { acoustic: acoustic() } }, ctx).status, Status.REFUTED);
});
test('adjective property must match same referent', () => {
  const ctx = demoContext();
  const base = { acoustic: acoustic('adj1', 'ngang', [120,122,124]), referential: reference() };
  assert.equal(issueToken({ role: Role.ADJECTIVE, value: 'đỏ', evidence: { ...base, attribute: { objectId: 'cup_1', key: 'color', value: 'red' } } }, ctx).status, Status.VERIFIED);
  assert.equal(issueToken({ role: Role.ADJECTIVE, value: 'xanh', evidence: { ...base, attribute: { objectId: 'cup_1', key: 'color', value: 'blue' } } }, ctx).status, Status.REFUTED);
});
test('numeric domain is independent of asserted value', () => {
  const ctx = demoContext(), e = { acoustic: acoustic(), numeric: { value: 0.9, unit: 'm/s', domainId: 'speed', observedAtMs: 990, expiresAtMs: 1100 } };
  assert.equal(issueToken({ role: Role.NUMERIC, value: '0.9', evidence: e }, ctx).status, Status.REFUTED);
  e.numeric.value = 0.2;
  assert.equal(issueToken({ role: Role.NUMERIC, value: '0.2', evidence: e }, ctx).status, Status.VERIFIED);
});
test('feasibility failure and unknown never treated as allowed', () => {
  const ctx = demoContext();
  const proposal = compileTokens([issueToken(noun(), ctx)], ctx);
  ctx.scene.reachable = false;
  assert.equal(checkFeasibility(proposal, ctx.scene, { allow: true }).kind, 'REJECT');
  ctx.scene.reachable = undefined;
  assert.equal(checkFeasibility(proposal, ctx.scene, { allow: true }).kind, 'DEFER');
});
test('scene stale -> unknown, conflicting pose or wrong class -> refuted', () => {
  const ctx = demoContext(), t = issued();
  ctx.nowMs = 1250;
  assert.equal(tick(t, ctx).status, Status.UNKNOWN);
  const fresh = demoContext(); fresh.scene.objects.cup_1.className = 'bottle';
  assert.equal(tick(t, fresh).status, Status.REFUTED);
  const shifted = demoContext(); shifted.scene.objects.cup_1.pose[0] += 2;
  assert.equal(tick(t, shifted).status, Status.REFUTED);
});
test('coverage-first metric is diagnostic, not an accuracy claim', () => {
  assert.equal(lexiconCoverage(['lấy','cốc','lạ'], [{surface:'lấy'},{surface:'cốc'}]), 2/3);
});
