# S2SC — Semantic-to-Skill Compiler

**A Safety-Governed Vietnamese Semantic-to-Skill Compilation Framework for Hybrid FPGA–ARM Robotics**

**Status:** research preprint / interactive browser simulation / architecture v1.0, **not a peer-reviewed or certified safety-critical system**.

S2SC investigates how Vietnamese spoken commands can be interpreted, statically validated as typed Task IR, grounded in an observed world, admitted by policy, planned as bounded skill sequences, and verified through feedback. The browser demo is an educational **symbolic grid-world simulation**, not an acoustic ASR, trained TinyLM/VLM, real CVNSS4.0 codec, FPGA RTL, or hardware safety demonstration.

## Open the research site

[**Interactive preprint & simulator**](./docs/index.html) · [Architecture and reproducibility](./docs/architecture.md) · [Technical specification v1](./spec/SPEC.md)

To publish via GitHub Pages: **Settings → Pages → Deploy from a branch → main → /docs**. Site URL, after GitHub Pages is enabled and deployment succeeds:

https://xulytiengviet.github.io/Semantic-to-Skill-Compiler-S2SC-/

## Research pipeline

```text
Vietnamese speech / text
  → AFE + ASR/Direct SLU (future integration)
  → optional CVNSS4.0 FST + TinyLM rescoring
  → proposed typed Task IR
  → static type/constraint checking
  → world grounding (observations + localization + affordances)
  → authorization + safety admission
  → bounded planner / skill contracts
  → feedback controller (MCU/FPGA target)
  → sensor-based postcondition verification
```

**Task IR type safety is not functional-safety certification.** A syntactically valid command does not establish physical safety, feasibility, or execution authorization. Runtime monitoring and independent emergency stopping remain mandatory for physical robots.

## Contents

- `docs/index.html`: full English project/preprint page and interactive demo.
- `docs/styles.css`, `docs/app.js`, `docs/core.js`: zero-dependency static simulator.
- `docs/architecture.md`: scientific positioning, grounding, limitations, design measurements and bibliography.
- `spec/`: versioned Task IR and skill contract schemas, examples, draft specification.
- `tests/`: executable Node.js tests for the *symbolic* model.
- `LICENSE`: MIT for original code and text; cited third-party resources retain their own licenses.

## Running locally

```bash
python -m http.server 8000
# then open http://localhost:8000/docs/
node --test tests/*.test.mjs
```

The page does not use microphone permissions or actuators. Its Vietnamese text parser supports only a few illustrative commands; it does not claim full Vietnamese speech recognition or faithful CVNSS4.0 conversion.

## Measurement plan (not yet executed)

Compare direct intent classification against Unicode ASR, Unicode + contextual LM, Unicode + CVNSS4.0-FST + TinyLM, and phoneme+tone baselines with identical splits. Report command success, mission success, grounding errors, false admission, latency p50/p95/p99, FPGA LUT/FF/BRAM/DSP/Fmax and power **only after hardware measurements**.

## References

- [CVNSS4.0 guide](https://cvnss.github.io/cvnss-guide/)
- [SayCan — Grounding Language in Robotic Affordances](https://arxiv.org/abs/2204.01691)
- [ROS 2 Navigation2](https://docs.nav2.org/)
- [MoveIt Task Constructor](https://moveit.github.io/moveit_task_constructor/)
- [NIST AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework)

**Author:** Long Ngo · Research concept, open-source implementation.

Please treat all browser-run metrics as illustrative and not empirical evidence of an FPGA implementation.
