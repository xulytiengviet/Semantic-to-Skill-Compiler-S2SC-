# S2SC Grounding Contract v1.1 — Research Specification

**Status:** Proposed / executable symbolic reference · **Profile:** CVNSS4.0-G/1.1 · **Scope:** closed-domain Vietnamese robotics. This document defines an implementation contract, not functional-safety certification.

## 1. Grounding claims and exclusions

Four distinct meanings must not be conflated:

| Concept | Question | S2SC v1.1 claim |
|---|---|---|
| Symbol grounding (Harnad) | How can symbols acquire intrinsic meaning? | **Out of scope / open** |
| Referential grounding | Which observed object is described? | Addressed for uniquely resolvable objects in an observed closed domain |
| Affordance / feasibility | Is an action executable under current constraints? | Conditional checks against external world and skill state |
| LM semantic grounding | Does the TinyLM genuinely understand its words? | **No claim**; distributional disambiguation is not sensor grounding |

**Continuous anchoring** extends referential grounding over time by combining object tracking, data association, scene updates, timestamps, and runtime monitoring. SLAM alone is insufficient.

CVNSS4.0 and TinyLM work at a symbolic stage, before physical reference binding. The profile CVNSS4.0-G attaches *proof obligations* to tokens without changing the underlying writing system, transliteration rules, or encoding. Task IR type correctness is not evidence that a robot is physically safe.

## 2. Non-negotiable invariants

- **G-INV-01 — Grounding-transparent constructor:** every grounded token is created with a nonempty evidence bundle; no default/optional evidence argument can issue a verified token.
- **G-INV-02 — Grounding-obligated outcome:** `-1`, `0`, `+1` must result from checks against independent contextual input. Lexicon entries do not store pre-verified statuses.
- **G-INV-03 — Temporal monotonicity:** given one token identity, `status(t+1) <= status(t)`. `+1 -> 0` on expiry and any status `-> -1` on contradiction; no upward transitions. Recovery requires re-issuance with new evidence and identity.
- **G-INV-04 — Aggregate proof checking:** a program's status is the minimum of its role obligations; fail (`-1`) rejects, defer (`0`) holds, and pass (`+1`) emits **only proposed Task IR**.
- **G-INV-05 — Independent admission:** correct grounding, typed IR and feasible motion do not authorize a motor driver. Admission, execution supervision, and emergency stop must remain separately trusted mechanisms.
- **G-INV-06 — Evidence provenance:** each observation has source identifier, clock validity, frame/revision where applicable. A real system must authenticate evidence at the hardware/software boundary.

## 3. Five obligation layers

| Layer | External source | Mandatory check | Failure policy |
|---|---|---|---|
| T0 — Transport | Symbol codec | A–Z plus SPACE ↔ Base27 ↔ three ternary digits; round-trip | Encoding error; **not grounding** |
| T1 — Acoustic | ADC / mic / observation registry | span, alignment confidence, F0, tone agreement | contradictory or absent = -1; expired = 0 |
| T2 — Referential | Scene graph / perception | object ID, class, pose, frame, scene revision, attribute, TTL | missing/mismatch = -1; stale = 0 |
| T3 — Action / numeric | Skill registry / domain catalog | signature, preconditions, admissible physical range | mismatch/unknown = -1; expired = 0 |
| T4 — Temporal | Monotonic clock / event log | freshness, non-increasing token state, re-observation | expiry = 0; conflict = -1 |

T0 is an encoding transport and **must not** be used as evidence of sensory grounding. A three-trit status is a *derived diagnostic*, not a motor command and not an FPGA ternary hardware claim. The reference implementation models T1 F0 against a separate fixture; it does not process acoustic waveforms or validate real-world tones.

## 4. Grammar-sensitive evidence obligations

| Role | Obligations | Unresolved/missing |
|---|---|---|
| FUNCTION | acoustic | absent = -1 |
| NOUN | acoustic + referential class/identity | absent = -1 |
| ADJECTIVE | acoustic + referential + matching object attribute | absent = -1 |
| IMPERATIVE_VERB | acoustic + action signature / preconditions | absent = -1 |
| NUMERIC | acoustic + numeric value, unit, independent valid domain | absent = -1 |
| DEICTIC | acoustic + resolved referent | unresolved referent = 0; false binding = -1 |
| UNKNOWN lexical role | none allowed | reject = -1 |

Ambiguous role assignment must never reduce obligations. Enforce an allowlist of role candidates and require the strictest interpretation or explicit disambiguation. The reference harness assumes the parser already supplied a role; a production parser must separately enforce this rule.

## 5. Contract API and lifecycle

1. `issueToken(value, role, evidence, context)` accepts mandatory evidence and computes status from independent world/audio/skill inputs.
2. `tick(token, context)` reevaluates with new observations and computes `min(previous, recomputed)`; it never upgrades an existing token.
3. `compileTokens(tokens, context)` returns `REJECT`, `DEFER`, or `ACCEPT` with `TaskIR.status = PROPOSED` only for all-verified programs.
4. `checkFeasibility(compiled, scene, policy)` returns `REJECT`, `DEFER`, or `ELIGIBLE`, with ELIGIBLE explicitly requiring a separate trusted admission step.
5. Reobservation and updated evidence must produce **a fresh token identity**. Logging should preserve the old binding, cause of revocation, new sensor provenance and world revision.

Recommended runtime behavior for expired/vanished objects: suspend affected skill at a bounded safe point; reacquire sensors; re-resolve reference; verify task consistency and policy; issue a new candidate; resume only after an external admission gate. Instant hard-stop behavior is platform- and hazard-specific and cannot be inferred from symbolic grounding checks.

## 6. Falsification-first CI checks

| Test | Intervention | Expected result |
|---|---|---|
| F1 | Delete referenced object from independent scene | -1 |
| F2 | Perturb F0 contour relative to independent observation | -1 |
| F3 | Expire evidence TTL | 0; same token cannot regain +1 |
| F4 | Delete bound skill from independent registry | compile-time REJECT |
| F5 | Replace comparator with constant `+1` | sensitivity guard **fails** test |

The sensitivity guard helps catch accidental relabeling, but cannot stop an adversary who changes both implementation and tests; hardware security, signed logs and independent supervision are separate requirements.

## 7. Metrics and study design (proposed targets, NOT measurements)

| Metric | Definition | Pre-registered research target |
|---|---|---|
| Lexicon coverage | content tokens with a grounded lexicon entry / content tokens | above 70% before extending compiler |
| Alignment coverage | audio tokens whose alignment passes the threshold | above 95% on a curated clean set |
| Tone verification | tone-bearing tokens matching reference measurements | above 90% on a defined corpus |
| Referent resolution accuracy | correct object ID among all evaluated expressions | above 85% in a closed domain |
| Skill binding coverage | imperative verbs with a declared skill contract | 100% for commands admitted |
| False rejection | valid task candidates incorrectly rejected / all valid candidates | report by failure layer, no blind optimization |
| False admission | unsafe or unsupported tasks that pass all gates / all such tasks | report separately; safety-critical priority |
| Conditional task success | task successes / externally admitted tasks | compare matched scenarios with/without grounding checks |
| Temporal revocation latency | elapsed time from change detection to invalidation | distribution p50/p95/p99 |

Comparisons must use the **same environment and task split**, declare confidence intervals, count defer and false reject rates, and avoid inflated success from filtering difficult tasks. No empirical thresholds, ASR performance, FPGA timing or robot safety claims are established by the current simulation.

## 8. Failure modes and audit requirements

- Wrong part-of-speech role → privilege reduction: over-obligate or disambiguate.
- Sparse lexicon → excessive rejections: measure coverage before training or compiler development; expand by usage frequency.
- Constant comparator → false grounding: run sensitivity/property and mutation tests.
- Long TTL → stale object bindings: sensor-specific freshness and observed change invalidation.
- Round-trip TTS/ASR online → latency and correlated false agreement: keep as **offline audit**, never as an authorization gate.
- Simulated sensor fixtures → not real sensor provenance: mark all demonstrations clearly; do not equate unit-test pass with physical evidence.

## 9. Integration boundaries

S2SC research pipeline: speech/ASR → optional unchanged CVNSS4.0 codec → semantic role/lexicon → mandatory evidence envelopes → grounding proof checker → candidate Task IR → feasibility/policy → trusted admission → bounded ARM/FPGA skills → anchoring/effect monitor.

The current S2SC `docs/core.js` browser simulator is independent; the new `grounding/src` module is a separate experimental contract, not yet wired into the browser UI. This is intentional so the original demonstration and the evidence-obligation reference can be evaluated separately before integration.

## 10. References and scientific positioning

- Harnad (1990), *The Symbol Grounding Problem*, Physica D 42:335–346.
- Coradeschi & Saffiotti (2003), *An Introduction to the Anchoring Problem*, Robotics and Autonomous Systems 43(2–3):85–96.
- Ahn et al. (2022), *Do As I Can, Not As I Say: Grounding Language in Robotic Affordances* (SayCan), arXiv:2204.01691.
- S2SC v1.0 Technical Architecture Specification in `spec/SPEC.md`.
