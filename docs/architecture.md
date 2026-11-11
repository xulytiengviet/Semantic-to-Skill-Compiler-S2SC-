# Research methods and reproducibility

## Title
**A Safety-Governed Vietnamese Semantic-to-Skill Compilation Framework for Hybrid FPGA–ARM Robotics**

**Author:** Long Ngo · **Version:** 1.0 · **Status:** Unreviewed preprint/project page.

### Abstract
We propose a modular framework for compiling Vietnamese speech-derived intents into typed, grounded and policy-admitted robotic skills. Speech recognition and CVNSS4.0-aware symbolic decoding do not directly determine motor commands. A small on-demand language model, if trained, serves candidate reranking rather than physical control. A typed Task IR enforces syntactic, dimensional and static constraints but does not constitute functional-safety certification. A world-grounding stage binds linguistic references to fresh object observations, coordinate frames and affordances. A bounded skill dispatcher executes feedback-monitored routines under independent safety supervision. A symbolic browser grid-world illustrates the architecture and explicit failure rejection. Empirical speech, FPGA and robot results are future work.

### Proposed contributions (not demonstrated performance)

1. A versioned typed boundary between Vietnamese SLU and robot action.
2. Explicit decomposition of object binding, pose/time grounding, reachability and affordance evidence.
3. Bounded skill graph with postcondition verification and independent interlock.
4. A falsifiable evaluation of Unicode vs CVNSS4.0 vs phoneme/tone front-ends.
5. Optional Base27/three-trit encoding as a separately measured representation experiment.

### Implementation reality

| Component | This release | Required for empirical publication |
| --- | --- | --- |
| Vietnamese text-to-intent | Tiny deterministic parser | Real audio and held-out speech |
| CVNSS4.0 codec | Not implemented | Versioned reference codec/FST and tests |
| TinyLM | Not implemented | Trained model, ablations and latency reports |
| Perception | Synthetic object state | Camera, depth/SLAM + ground truth |
| Grounding | Typed evidence checks and BFS | Robot object ID/poses, covariance, recency |
| Planner and skill execution | Symbolic finite steps | ROS 2 action server + feedback |
| FPGA | Partitioning proposal | RTL, P&R, HIL, real power/timing |
| Safety | Toy admission and E-stop logic | Hardware interlock and independent assessment |

### Grounding vs. language confidence

A clear sentence does not prove the object exists. Conversely, a visible object does not prove it is the intended referent. Evaluate false-binding and false-admission independently of WER. Capture time-of-check/time-of-use faults where an obstacle appears after admission.

### Balanced ternary clarification

The demo encodes a fixed 27-character alphabet. Given symbol ID i in 0..26:

\`\`\`
d2 = floor(i / 9), d1 = floor((i % 9) / 3), d0 = i % 3
balanced_display = (d2-1, d1-1, d0-1)
\`\`\`

This is bijective over the codebook. It is *not* a Vietnamese codec, nor a mathematical proof of storage compression. Binary representation of one ID requires 5 bits.

### Falsifiable experiments

- B0: Direct Vietnamese SLU, no CVNSS or TinyLM.
- B1: Unicode ASR + parser.
- B2: Unicode ASR + LM/reranking.
- B3: same ASR + full CVNSS4.0 FST + context model.
- B4: phoneme and tone-based front-end.

Keep task skill library, physical environment and splits fixed. Report CER/WER, Intent Accuracy, Slot F1, OOD false accept, target binding, mission success, latency and FPGA hardware resource breakdown. Do not attribute acoustic model compression to CVNSS4.0.

### Reproducibility

\`\`\`bash
python -m http.server 8000
# http://localhost:8000/docs/
node --check docs/core.js
node --check docs/app.js
node --test tests/*.test.mjs
\`\`\`

Use failure scenarios in the browser. The grid simulation intentionally lacks physics, kinematics, ROS 2, microphone audio and realistic controller timing.

### Ethics / safety

The project is not a robotics product, a validated vehicle controller, a safety case or a certification. No human, animals, public places or aerial operations should be entrusted to this simulator. A safety-qualified actuator stack and task-specific risk assessment are required before any physical experiment.

### Bibliography

- Kiều Trường Lâm and Trần Tư Bình. CVNSS4.0 guide: https://cvnss.github.io/cvnss-guide/
- Ahn et al. Do As I Can, Not As I Say: Grounding Language in Robotic Affordances. https://arxiv.org/abs/2204.01691
- Nav2: https://docs.nav2.org/
- MoveIt Task Constructor: https://moveit.github.io/moveit_task_constructor/
- NIST AI RMF: https://www.nist.gov/itl/ai-risk-management-framework
