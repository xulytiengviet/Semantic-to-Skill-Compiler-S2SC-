/** S2SC CVNSS4.0-G: symbolic, testable obligation checks; never actuator authority. */
export const Status = Object.freeze({ REFUTED: -1, UNKNOWN: 0, VERIFIED: 1 });
export const Role = Object.freeze({ FUNCTION: 'FUNCTION', NOUN: 'NOUN', ADJECTIVE: 'ADJECTIVE', IMPERATIVE_VERB: 'IMPERATIVE_VERB', NUMERIC: 'NUMERIC', DEICTIC: 'DEICTIC' });
export const PROFILE = 'CVNSS4.0-G/1.1';
export const OBLIGATIONS = Object.freeze({
  FUNCTION: ['acoustic'],
  NOUN: ['acoustic', 'referential'],
  ADJECTIVE: ['acoustic', 'referential', 'attribute'],
  IMPERATIVE_VERB: ['acoustic', 'action'],
  NUMERIC: ['acoustic', 'numeric'],
  DEICTIC: ['acoustic', 'referential']
});

const SECRET = Symbol('grounding-constructor');
const validTime = Number.isFinite;
const snapshot = x => JSON.parse(JSON.stringify(x));
const frozen = x => {
  if (x && typeof x === 'object' && !Object.isFrozen(x)) {
    for (const v of Object.values(x)) frozen(v);
    Object.freeze(x);
  }
  return x;
};
const verdict = (status, code, layer) => Object.freeze({ status, code, layer });
const bad = (code, layer) => verdict(Status.REFUTED, code, layer);
const unknown = (code, layer) => verdict(Status.UNKNOWN, code, layer);
const ok = (layer) => verdict(Status.VERIFIED, 'OK', layer);

function freshness(e, nowMs, layer) {
  if (!e || typeof e !== 'object') return bad('E_EVIDENCE_MISSING', layer);
  if (!validTime(e.observedAtMs) || !validTime(e.expiresAtMs) ||
      !validTime(nowMs) || e.observedAtMs > nowMs || e.expiresAtMs < e.observedAtMs)
    return bad('E_EVIDENCE_TIME', layer);
  return nowMs > e.expiresAtMs ? unknown('E_EVIDENCE_EXPIRED', layer) : ok(layer);
}
const isRejected = r => r.status === Status.REFUTED;
function checkAcoustic(e, ctx) {
  const f = freshness(e, ctx.nowMs, 'T1');
  if (f.status !== Status.VERIFIED) return f;
  const independent = ctx.audio?.segments?.[e.segmentId];
  if (!independent) return bad('E_NO_INDEPENDENT_AUDIO', 'T1');
  if (!Array.isArray(e.spanMs) || e.spanMs.length !== 2 ||
      e.spanMs[0] >= e.spanMs[1] || e.spanMs.some(n => !Number.isFinite(n)))
    return bad('E_INVALID_ALIGNMENT', 'T1');
  if (!Number.isFinite(e.alignConf) || e.alignConf < (ctx.thresholds?.minAlignConf ?? 0.80))
    return bad('E_LOW_ALIGNMENT', 'T1');
  if (!Array.isArray(e.f0ContourHz) || !Array.isArray(independent.f0ContourHz) ||
      e.f0ContourHz.length < 2 || e.f0ContourHz.length !== independent.f0ContourHz.length)
    return bad('E_F0_MISSING', 'T1');
  const tolerance = ctx.thresholds?.f0ToleranceHz ?? 8;
  if (e.f0ContourHz.some((n, i) => !Number.isFinite(n) || n <= 0 ||
      Math.abs(n - independent.f0ContourHz[i]) > tolerance))
    return bad('E_F0_MISMATCH', 'T1');
  if (e.toneLabel !== independent.toneLabel) return bad('E_TONE_MISMATCH', 'T1');
  return ok('T1');
}
function checkReferential(e, ctx) {
  const f = freshness(e, ctx.nowMs, 'T2');
  if (f.status !== Status.VERIFIED) return f;
  if (!ctx.scene || ctx.scene.observedAtMs > ctx.nowMs ||
      !Number.isFinite(ctx.scene.observedAtMs) || !Number.isFinite(ctx.scene.ttlMs))
    return bad('E_SCENE_INVALID', 'T2');
  if (ctx.nowMs > ctx.scene.observedAtMs + ctx.scene.ttlMs)
    return unknown('E_SCENE_STALE', 'T2');
  const obj = ctx.scene.objects?.[e.objectId];
  if (!obj) return bad('E_REFERENT_ABSENT', 'T2');
  if (!e.objectId || !e.className || obj.className !== e.className)
    return bad('E_REFERENT_CLASS', 'T2');
  if (!e.frameId || obj.frameId !== e.frameId || e.sceneId !== ctx.scene.id)
    return bad('E_REFERENCE_FRAME', 'T2');
  if (e.worldRevision !== ctx.scene.revision)
    return unknown('E_WORLD_REVISION', 'T2');
  if (!Array.isArray(e.pose) || !Array.isArray(obj.pose) || e.pose.length !== obj.pose.length ||
      e.pose.some((v, i) => !Number.isFinite(v) || Math.abs(v - obj.pose[i]) > (ctx.thresholds?.poseToleranceM ?? .05)))
    return bad('E_POSE_MISMATCH', 'T2');
  return ok('T2');
}
function checkAttribute(e, ref, ctx) {
  if (!e || typeof e !== 'object') return bad('E_ATTRIBUTE_MISSING', 'T2');
  if (e.objectId !== ref?.objectId) return bad('E_ATTRIBUTE_REFERENT', 'T2');
  const obj = ctx.scene?.objects?.[e.objectId];
  return obj && Object.prototype.hasOwnProperty.call(obj.attributes ?? {}, e.key) &&
    obj.attributes[e.key] === e.value ? ok('T2') : bad('E_ATTRIBUTE_MISMATCH', 'T2');
}
function checkAction(e, ctx) {
  const f = freshness(e, ctx.nowMs, 'T3');
  if (f.status !== Status.VERIFIED) return f;
  const skill = ctx.skills?.[e.skillId];
  if (!skill || !skill.enabled || skill.signature !== e.signature ||
      !Array.isArray(skill.preconditions) || !Array.isArray(e.preconditions) ||
      JSON.stringify(skill.preconditions) !== JSON.stringify(e.preconditions))
    return bad('E_SKILL_CONTRACT', 'T3');
  return ok('T3');
}
function checkNumeric(e, ctx) {
  const f = freshness(e, ctx.nowMs, 'T3');
  if (f.status !== Status.VERIFIED) return f;
  const domain = ctx.numericDomains?.[e.domainId];
  return domain && e.unit === domain.unit && Number.isFinite(e.value) &&
    e.value >= domain.min && e.value <= domain.max ? ok('T3') : bad('E_NUMERIC_DOMAIN', 'T3');
}
/** Verdicts are calculated from independent world/audio/skill inputs, never config trits. */
export function evaluate(role, evidence, ctx) {
  if (!OBLIGATIONS[role]) return frozen([bad('E_UNKNOWN_ROLE', 'LEXICON')]);
  const checks = [checkAcoustic(evidence?.acoustic, ctx)];
  if (role === Role.DEICTIC && !evidence?.referential) {
    checks.push(unknown('E_DEICTIC_UNRESOLVED', 'T2'));
  } else if ([Role.NOUN, Role.ADJECTIVE, Role.DEICTIC].includes(role)) {
    checks.push(checkReferential(evidence?.referential, ctx));
  }
  if (role === Role.ADJECTIVE)
    checks.push(checkAttribute(evidence?.attribute, evidence?.referential, ctx));
  if (role === Role.IMPERATIVE_VERB) checks.push(checkAction(evidence?.action, ctx));
  if (role === Role.NUMERIC) checks.push(checkNumeric(evidence?.numeric, ctx));
  return frozen(checks);
}
const minStatus = checks => Math.min(...checks.map(c => c.status));
let sequence = 0;
export class GroundedToken {
  #data; #status; #checks;
  constructor(secret, data, status, checks) {
    if (secret !== SECRET) throw new TypeError('Use issueToken; status cannot be supplied');
    this.#data = frozen(snapshot(data));
    this.#status = status;
    this.#checks = frozen(snapshot(checks));
    Object.freeze(this);
  }
  get role() { return this.#data.role; }
  get value() { return this.#data.value; }
  get evidence() { return this.#data.evidence; }
  get id() { return this.#data.id; }
  get status() { return this.#status; }
  get checks() { return this.#checks; }
  get profile() { return PROFILE; }
}
/** Evidence must be passed at issue time; constructing with null/empty is forbidden. */
export function issueToken({ value, role, evidence }, ctx) {
  if (evidence === null || !evidence || typeof evidence !== 'object' || !Object.keys(evidence).length)
    throw new TypeError('Grounded symbol requires nonempty evidence');
  if (typeof value !== 'string' || !value.length) throw new TypeError('Token requires a value');
  const checks = evaluate(role, evidence, ctx);
  return new GroundedToken(SECRET, { id: 'grounded-' + (++sequence), value, role, evidence }, minStatus(checks), checks);
}
/** Same token may only decline; recovery REQUIRES issueToken with fresh evidence. */
export function tick(token, ctx) {
  if (!(token instanceof GroundedToken)) throw new TypeError('Expected grounded token');
  const checks = evaluate(token.role, token.evidence, ctx);
  const next = Math.min(token.status, minStatus(checks));
  if (next > token.status) throw new Error('E_MONOTONICITY');
  return new GroundedToken(SECRET,
    { id: token.id, value: token.value, role: token.role, evidence: token.evidence }, next, checks);
}
/** Parser output remains a candidate, not an execution permit. */
export function compileTokens(tokens, ctx) {
  if (!Array.isArray(tokens) || tokens.length === 0) return { kind: 'REJECT', code: 'E_EMPTY_PROGRAM' };
  const checked = tokens.map(t => tick(t, ctx));
  const failed = checked.find(t => t.status === Status.REFUTED);
  if (failed) return { kind: 'REJECT', code: failed.checks.find(c => isRejected(c))?.code ?? 'E_TOKEN_REFUTED', tokenId: failed.id };
  const pending = checked.filter(t => t.status === Status.UNKNOWN);
  if (pending.length) return { kind: 'DEFER', code: 'E_OBLIGATION_PENDING', tokenIds: pending.map(t => t.id) };
  return { kind: 'ACCEPT', taskIR: { version: '1.1', status: 'PROPOSED', tokens: checked.map(t => ({ id: t.id, role: t.role, value: t.value })) } };
}
/** A separate admission boundary checks policy and *current* feasibility. No motor permission is created. */
export function checkFeasibility(compiled, scene, policy) {
  if (compiled?.kind !== 'ACCEPT' || compiled.taskIR?.status !== 'PROPOSED')
    return { kind: 'REJECT', code: 'E_NO_PROPOSAL' };
  if (!policy || policy.allow !== true) return { kind: 'REJECT', code: 'E_POLICY' };
  if (!scene || !Number.isFinite(scene.batteryWh) || !Number.isFinite(scene.requiredBatteryWh))
    return { kind: 'DEFER', code: 'E_RESOURCE_UNKNOWN' };
  if (scene.batteryWh < scene.requiredBatteryWh || scene.pathClear === false || scene.reachable === false)
    return { kind: 'REJECT', code: 'E_FEASIBILITY' };
  if (scene.pathClear !== true || scene.reachable !== true)
    return { kind: 'DEFER', code: 'E_FEASIBILITY_UNKNOWN' };
  return { kind: 'ELIGIBLE', status: 'REQUIRES_TRUSTED_ADMISSION' };
}
/** Comparator mutation guard: positive and perturbed inputs must not have identical positive verdicts. */
export function assertComparatorSensitivity(comparator, positiveInput, perturbedInputs) {
  if (comparator(positiveInput) !== Status.VERIFIED) throw new Error('E_POSITIVE_CONTROL');
  if (!Array.isArray(perturbedInputs) || !perturbedInputs.length ||
      perturbedInputs.some(x => comparator(x) === Status.VERIFIED))
    throw new Error('E_COMPARATOR_INSENSITIVE');
  return true;
}
export function base27ToTrits(text) {
  if (typeof text !== 'string' || !/^[A-Z ]*$/.test(text))
    throw new TypeError('T0 accepts A-Z and SPACE only; not a CVNSS4.0 Unicode converter');
  return [...text].map(ch => {
    const n = ch === ' ' ? 26 : ch.charCodeAt(0) - 65;
    return [Math.floor(n / 9), Math.floor(n / 3) % 3, n % 3].join('');
  });
}
export function tritsToBase27(trits) {
  if (!Array.isArray(trits)) throw new TypeError('Expected trit array');
  return trits.map(t => {
    if (typeof t !== 'string' || !/^[012]{3}$/.test(t)) throw new TypeError('Invalid trit');
    const n = Number(t[0]) * 9 + Number(t[1]) * 3 + Number(t[2]);
    return n === 26 ? ' ' : String.fromCharCode(65 + n);
  }).join('');
}
export function lexiconCoverage(contentTokens, entries) {
  const surfaces = new Set(entries.map(e => e.surface.toLocaleLowerCase('vi')));
  return contentTokens.length ? contentTokens.filter(t => surfaces.has(t.toLocaleLowerCase('vi'))).length / contentTokens.length : 1;
}
