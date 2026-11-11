import { issueToken, compileTokens, checkFeasibility, tick } from '../src/index.mjs';
import { demoContext, noun, verb } from '../src/fixtures.mjs';
const world = demoContext(); // SIMULATED SENSORS ONLY
const tokens = [issueToken(verb(), world), issueToken(noun(), world)];
console.log('Grounding checks:', tokens.map(t => ({ role: t.role, status: t.status, checks: t.checks })));
const ir = compileTokens(tokens, world);
console.log('Compile:', ir);
console.log('Feasibility:', checkFeasibility(ir, world.scene, { allow: true }));
world.nowMs = 1200;
console.log('Expired original noun token:', tick(tokens[1], world).status); // 0
