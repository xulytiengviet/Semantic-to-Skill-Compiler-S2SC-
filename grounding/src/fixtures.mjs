/** Simulated independent sensor observations for deterministic tests only. */
export function demoContext() {
  return {
    nowMs: 1000,
    thresholds: { minAlignConf: 0.8, f0ToleranceHz: 8, poseToleranceM: 0.05 },
    audio: { segments: {
      noun1: { f0ContourHz: [121, 126, 129], toneLabel: 'ngang' },
      verb1: { f0ContourHz: [134, 141, 136], toneLabel: 'sắc' },
      adj1: { f0ContourHz: [120, 122, 124], toneLabel: 'ngang' }
    } },
    scene: { id: 'room-A', revision: 7, observedAtMs: 990, ttlMs: 200,
      objects: { cup_1: { className: 'cup', frameId: 'map', pose: [0.4, 0.2, 0.1],
        attributes: { color: 'red' } } },
      batteryWh: 25, requiredBatteryWh: 2, pathClear: true, reachable: true },
    skills: { grasp: { enabled: true, signature: 'Grasp(ObjectID)', preconditions: ['reachable', 'gripper_open'] } },
    numericDomains: { speed: { unit: 'm/s', min: 0, max: 0.25 } }
  };
}
export function acoustic(segmentId = 'noun1', toneLabel = 'ngang', f0 = [121, 126, 129]) {
  return { segmentId, spanMs: [0, 400], alignConf: 0.97, toneLabel,
    f0ContourHz: f0, observedAtMs: 990, expiresAtMs: 1100 };
}
export function reference() {
  return { objectId: 'cup_1', className: 'cup', sceneId: 'room-A', frameId: 'map',
    pose: [0.4, 0.2, 0.1], worldRevision: 7, observedAtMs: 990, expiresAtMs: 1100 };
}
export function noun() { return { value: 'cốc', role: 'NOUN', evidence: { acoustic: acoustic(), referential: reference() } }; }
export function verb() {
  return { value: 'lấy', role: 'IMPERATIVE_VERB', evidence: {
    acoustic: acoustic('verb1', 'sắc', [134, 141, 136]),
    action: { skillId: 'grasp', signature: 'Grasp(ObjectID)',
      preconditions: ['reachable', 'gripper_open'], observedAtMs: 990, expiresAtMs: 1100 }
  } };
}
