# Grounding Contract v1.1 · CVNSS4.0-G

**S2SC — Semantic-to-Skill Compiler** · Long Ngo · experimental reference implementation

This directory specifies a **closed-domain, evidence-obligated, temporal grounding protocol** for Vietnamese command-to-skill compilation. It operationalizes *referential grounding* and *affordance/feasibility checks*. It **does not solve** Harnad's general symbol grounding problem, prove intrinsic language-model understanding, or provide functional-safety certification.

## Layout

| Path | Purpose |
|---|---|
| `spec/GROUNDING.md` | Formal scope, T0–T4, invariants, failure handling, experimental metrics |
| `spec/CVNSS4.0-G.schema.json` | Draft JSON schema for token envelope (not an encoding replacement) |
| `lexicon/vi-closed-domain.json` | Closed-domain starter vocabulary with roles/ontology/skill bindings |
| `src/index.mjs` | Proof-obligation comparator, temporal monitor, candidate IR, Base27 transport |
| `src/fixtures.mjs` | Clearly simulated sensor, object and skill snapshots |
| `tests/grounding.test.mjs` | Five falsification checks plus role and state checks |
| `examples/demo.mjs` | Node.js command-line example without real hardware |

## Usage

Run from repository root with Node.js 22+:

~~~bash
node --test grounding/tests/*.test.mjs
node grounding/examples/demo.mjs
npm test
~~~

## Grounding status

**-1 REFUTED:** contradictory, missing mandatory evidence, or unknown content word → reject.

**0 UNKNOWN:** evidence expired, scene stale, unresolved deictic, or undecidable feasibility → defer/re-observe; never execute.

**+1 VERIFIED:** independent, current supporting evidence satisfies the declared role obligations → eligible for candidate Task IR only, **not authorization**.

For a given issued token, the monitor computes `min(previousStatus, recomputedStatus)`; a downgraded token cannot be upgraded. Recovery requires issuing a **different token** with newly gathered evidence. The accompanying reference comparator and model are not tamper-resistant; a real deployment requires authenticated measurements and trusted software boundaries.

## Architectural scope

- **T0 (transport only):** one-to-one `A–Z + SPACE` ↔ Base27 ↔ 3 trits per symbol. This is **not** CVNSS4.0 Unicode conversion and carries **no grounding** by itself.
- **T1:** verify acoustic alignment/tone evidence against an independent observation fixture. The F0 comparison is illustrative, not a validated Vietnamese tone classifier.
- **T2:** scene/object class, pose, frame, revision, TTL, and adjective attribute consistency.
- **T3:** skill signature/preconditions and numeric parameter domain in independently supplied registries.
- **T4:** observable time-based status decay and explicit re-issuance policy.
- **Feasibility/admission:** separately inspect path, reachability, battery and policy. `ELIGIBLE` is not a motor permit.

Acoustic evidence is mandatory for the supplied speech-command profile. A future text-only input profile must be versioned separately and must not quietly fabricate microphone evidence.

## Key promises and non-promises

- No token is issued with empty/null evidence; status is not a writable field or a constant lexicon label.
- If a grounded object is deleted, F0 evidence contradicts observation, or a bound skill is removed, the corresponding comparator fails in the test harness.
- Expired evidence reduces a previous `+1` to `0`; it cannot silently return to `+1`.
- No component in this module controls PWM/motors, bypasses the independent supervisor, or claims hardware metrics.

See `spec/GROUNDING.md` for roles, failure cases, and proposed experimental KPI definitions.
