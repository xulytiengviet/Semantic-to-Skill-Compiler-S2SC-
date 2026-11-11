# S2SC Technical Architecture Specification v1.0

> **Proposed research specification — not an implementation of a certified robot system.**
>
> Title: **A Safety-Governed Vietnamese Semantic-to-Skill Compilation Framework for Hybrid FPGA–ARM Robotics**
>
> Author: Long Ngo · Date: 2026-11-11 · Spec ID: S2SC-SPEC-001 · Status: Proposed

## 1. Scope and claims

S2SC defines typed contracts between Vietnamese spoken-command interpretation and robot skill execution. The MVP is a **wheeled mobile manipulator in a bounded indoor environment**, starting in a discrete grid-world. Quadruped and aerial vehicle profiles are future, separately assessed extensions.

Explicitly out of scope for the browser simulation: microphone ASR, CNN acoustic inference, faithful CVNSS4.0 Unicode conversion, trained TinyLM or VLM, accurate camera/SLAM modeling, ROS 2 integration, synthesized RTL or physical FPGA, motor control and safety certification.

The simulator is an **executable model of decision logic**, not a performance benchmark or an assurance argument.

## 2. Architecture and ownership

| Layer | Input → output | Candidate compute | Trust boundary |
| --- | --- | --- | --- |
| AFE / speech | PCM → speech hypotheses / direct intent | DSP, ARM, optionally FPGA | Untrusted observation |
| Optional CVNSS FST / TinyLM | Candidate text and scores → reranked candidates | ARM/NPU | No action authority |
| Parser and static compiler | Candidate intent → Task IR | ARM/CPU | Type/constraint gate |
| World grounding | IR + observations → bound referents + evidence | ARM/NPU | Scene data can be stale |
| Admission | Grounded goal + policy → authorization token | Trusted supervisor | Separate policy decision |
| Planner and dispatcher | Admitted goal → finite skill graph | ARM/CPU | Allowlisted skill APIs |
| Real-time control | Skill parameters → actuator demand + feedback | MCU/FPGA | Deterministic timing |
| Safety | Sensors, watchdog, authority → interlock | Independent MCU/hardware | Can veto all motion |

### System invariants

- **INV-001:** untrusted language output never writes PWM, torque, motor-enable or driver registers.
- **INV-002:** correctly typed Task IR remains PROPOSED until external admission.
- **INV-003:** no skill launch without fresh grounding, authorization, state-valid preconditions, and declared resource limits.
- **INV-004:** every accepted skill has a bounded lifetime, feedback and terminal SUCCEEDED/ABORTED/CANCELED state; candidate rejection is REJECTED.
- **INV-005:** controller and independent safety interlock continue working during LLM/cloud outage.
- **INV-006:** all poses carry frame_id, timestamp, units and uncertainty.
- **INV-007:** dynamic obstacles or invalid sensor data can force pause/replan/stop; no unbounded retries.
- **INV-008:** the mission is complete only after verified postconditions, not a planner's prediction.

## 3. Candidate Task IR

The only AI-produced artifact allowed across the admission boundary is **candidate IR**. A preferred production format is Protobuf or constrained JSON validated against a strict schema and an explicit skill catalog. A suggested example:

~~~json
{
  "ir_version": "1.0.0",
  "mission_id": "2a6e53d0-1551-412c-983e-773d5d86f24d",
  "intent": "FETCH_AND_RETURN",
  "arguments": {
    "object": { "class": "bottle", "color": "blue", "location_hint": "table_2" },
    "return_reference": "mission_start"
  },
  "constraints": { "max_speed_mps": 0.25, "max_payload_kg": 0.3 },
  "source": {
    "language": "vi", "asr_version": "placeholder",
    "codec_version": "cvnss-version-pending"
  },
  "status": "PROPOSED"
}
~~~

**Not present:** fields that grant access, set driver channels, set motor torques, or bypass supervisor checks. Authorization evidence is produced by the trusted admission subsystem, not the AI.

### Compiler phases

1. Lexical interpretation; maintain ASR N-best and acoustic confidences where available.
2. Parse intent and slot schema; reject unknown verbs or ambiguous referents.
3. Enforce dimensional types such as Speed<MeterPerSecond> and Pose<MapFrame>.
4. Statically enforce velocity, payload and capability ceilings.
5. Resolve object ID, pose, sensor freshness and semantic constraints from world observations.
6. Verify path, payload affordance, energy reserve and security policy.
7. Admit a time-limited goal; lower to a finite, allowlisted skill graph.
8. Monitor preconditions continuously; stop/repair on state changes.
9. Verify postconditions before marking the mission successful.

### Typed errors

| Error | Meaning | Required behavior |
| --- | --- | --- |
| E_INTENT_AMBIGUOUS | Missing, contradictory or uncertain slots | Clarify or reject |
| E_SCHEMA | Unsupported Task IR shape or version | Reject |
| E_SPEED / E_PAYLOAD | Constraints exceed declared limits | Reject |
| E_PRIVILEGE | Language model attempts to self-authorize | Reject and log |
| E_FRAME | Missing or mismatched transform | Reject/re-ground |
| E_OBSERVATION_STALE | Last observation outside freshness budget | Refresh or refuse |
| E_OBJECT_MISSING | Cannot bind a physical object | Search within bounds or refuse |
| E_NO_PATH | Round trip not reachable | Replan or refuse |
| E_BATTERY_RESERVE | Insufficient energy with reserve | Refuse or safe home |
| E_RUNTIME_OBSTACLE | Collision monitor detects changed world | Stop, bounded replan |
| E_POSTCONDITION_GRASP | Gripper lacks evidence of object retention | Abort or recover |
| E_TIMEOUT / E_WATCHDOG | Action expires or control health lost | Independent safe stop |

## 4. World grounding: first-class evidence

**Referent binding** is association of a named item with a real or simulated object instance from observations. **Geometric grounding** ensures coordinate-frame consistency and reachable pose. **Affordance grounding** checks that a planned skill can physically succeed in the current state. **Temporal grounding** ensures observation freshness and manages time-of-check/time-of-use faults.

A task is admissible only if:

\`\`\`
admit(task,world) =
  wellTyped(task) && grounded(task,world) &&
  authorized(task) && feasible(task,world) && fresh(world)
\`\`\`

The predicate is software admission logic, **not a safety proof**. Grounding must be revisited after perception, localization, obstacle and payload changes. Each successful binding should preserve object ID, sensor provenance, frame_id, covariance, timestamp, perception model version and data quality.

The browser demo substitutes a known rectangular grid, a simulated observation timestamp, known obstacle cells, object attributes, path-existence BFS and simple reserve-energy math. This is intentionally not a neural VLM, pose estimation or physical collision model.

## 5. Skill contract

Every skill declares its name, version, input schema, unit and frame requirements, preconditions, invariants, postconditions, timeout, cancel behavior, result codes and bounded recovery. Suggested actions:

- LOCALIZE; SEARCH_OBJECT; NAVIGATE_TO_POSE; APPROACH_OBJECT.
- GRASP; VERIFY_GRASP; RETURN_HOME; VERIFY_RETURN; PLACE; SAFE_STOP.

In deployed ROS 2 systems, Action APIs carry goal/feedback/result/cancel; Nav2 may implement navigation, MoveIt Task Constructor manipulation stages, and ros2_control the hardware control interface. These are reference integration targets, **not code currently wired into the browser simulation**.

Cancel request is not equivalent to verified stopping. Timed cancellation must escalate to a trusted safe state when necessary. A Skill Library is **not simply a table of replayed motion trajectories**; policies must use sensor feedback and enforce runtime limits.

## 6. CVNSS4.0 and ternary profile

CVNSS4.0 uses a rule-based orthographic encoding into Latin letters and can expose syllable-like units. It is not an acoustic model, phonetic transcript or automatic semantic parser. Its reverse transformation can have ambiguity requiring contextual and acoustic evidence. For production, preserve Unicode UTF-8 NFC, raw hypotheses, codec versions, ambiguity flags and unknown spans; define a fallback for punctuation, numbers, names and other unsupported symbols.

**Base27/Trit demonstrator:** fixed alphabet A-Z + SPACE, IDs 0..26, length-3 ternary codes in {0,1,2}³. Balanced display maps each trit d to d−1 (−1,0,+1). This is a **codebook experiment**, not a complete CVNSS4.0 encoder. Pack one 27-way ID in five binary bits. If each of three trits is stored separately with two bits, six bits are required. No unmeasured claims of BRAM/MAC savings.

Ternary arithmetic is an optional research track for quantized neural weights; it must be benchmarked separately from Base27 text coding.

## 7. FPGA/ARM partition & timing

**Baseline:** run speech/SLU on ARM/CPU, typed compiler on CPU, perception on GPU/NPU as needed, bounded task planner on CPU, low-level controller on MCU. Profile power, latency and memory. Only then consider FPGA AFE, FST table logic, fixed-point filter/control or inference acceleration.

An indicative control-loop budget is 1 kHz (1 ms); jitter under 10 μs is an optional target requiring measured WCET, HIL and realistic worst-case load. **Speech-to-action latency is not the control-loop period.**

Separate measurements: utterance end→intent ready; intent→admission; admission→first safe motion; per-loop jitter/deadlines; postcondition→reported result.

## 8. Fault injection and acceptance

Required scenarios: unsupported utterance, forged authorization field, invalid units, stale observation, missing object, blocked path, low battery reserve, grasp failure, late obstacle, watchdog timeout, localization loss, network interruption, emergency stop.

All fault injections must assert that no unapproved motor command reaches the low-level controller. Browser-only tests can assert logical invariants; hardware risk assessment and HIL are separate gates. Unsafe behaviors must be rejected or brought to a defined safe stop.

## 9. Experiment and scientific claims

Compare B0 direct Vietnamese SLU; B1 Unicode ASR/parser; B2 Unicode+LM; B3 CVNSS-FST+TinyLM; B4 phoneme/tone baseline, with identical data partitions and robot world/skills. Report Intent Accuracy, Slot F1, calibrated confidence, false admission, object-binding accuracy, grasp success, return accuracy, end-to-end mission success, and unknown-domain refusal. For hardware report FPGA LUT/FF/BRAM/DSP/Fmax, clock timing closure, control jitter, device power and energy.

All thresholds are **proposed acceptance targets**, not results. The research hypothesis may be rejected if CVNSS-FST+TinyLM adds latency, memory or errors relative to a simpler baseline.

## 10. Technical-debt register

| Priority | Debt | Mitigation |
| --- | --- | --- |
| P0 | Missing world-state freshness and frame contracts | typed transforms + timestamps |
| P0 | LLM can bypass actuator safety | privilege separation + independent interlock |
| P0 | Skill postconditions cannot be proven | sensor verification + bounded recovery |
| P1 | Unversioned CVNSS rules | reference codec + golden corpus |
| P1 | No speech-command dataset and calibration | versioned splits + OOD tests |
| P1 | FPGA build drift | pinned toolchain, traceable bitstreams |
| P1 | No cross-layer trace | mission IDs, event logs, model checksums |
| P2 | Premature FPGA implementation | CPU profiling and ablations first |

## 11. References

1. CVNSS4.0 guide — https://cvnss.github.io/cvnss-guide/
2. Ahn et al. *Do As I Can, Not As I Say* (SayCan) — https://arxiv.org/abs/2204.01691
3. ROS 2 Navigation2 — https://docs.nav2.org/
4. MoveIt Task Constructor — https://moveit.github.io/moveit_task_constructor/
5. NIST AI RMF — https://www.nist.gov/itl/ai-risk-management-framework

The sources establish useful prior art but do not validate S2SC's unpublished hypotheses. Third-party frameworks retain their licenses.
