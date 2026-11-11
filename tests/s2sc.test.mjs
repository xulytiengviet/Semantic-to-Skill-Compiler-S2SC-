import test from 'node:test';
import assert from 'node:assert/strict';
import {makeWorld,proposeTask,validateTask,groundTask,makePlan,executeStep,bfs,
        cellKey,toTrits,fromTrits,HOME,TARGET} from '../docs/core.js';

const utterance='Lấy chai nước màu xanh trên bàn số hai rồi quay lại chỗ cũ.';
function setup(s='nominal'){
  const world=makeWorld(s),ir=proposeTask(utterance);
  assert.equal(validateTask(ir).ok,true);
  return {world,ir,g:groundTask(ir,world)};
}
test('task parser returns unprivileged typed candidate',()=>{
  const ir=proposeTask(utterance);
  assert.equal(ir.intent,'FETCH_AND_RETURN');assert.equal(ir.status,'PROPOSED');
  assert.equal(ir.arguments.object.color,'blue');
  assert.equal(proposeTask('lấy cái đó'),null);
});
test('type/authorization validator rejects unsafe speed and privilege',()=>{
  const ir=proposeTask(utterance);ir.constraints.max_speed_mps=0.9;
  assert.equal(validateTask(ir).ok,false);
  ir.constraints.max_speed_mps=.2;ir.execution_authorized=true;
  assert.equal(validateTask(ir).ok,false);
});
test('nominal grounding returns evidence and complete round trip',()=>{
  const {world,g}=setup();assert.equal(g.ok,true);
  const steps=makePlan(world,g);assert.ok(steps.length>10);
  for(const step of steps){const r=executeStep(world,step);assert.equal(r.ok,true,JSON.stringify({step,r}));}
  assert.equal(world.completed,true);assert.deepEqual(world.robot,HOME);
});
for(const [scenario,rule] of [['missing','Object detection'],['stale','Observation freshness'],
  ['blocked','Path existence'],['low-battery','Round-trip battery reserve']]){
  test('negative grounding: '+scenario,()=>{
    const {g}=setup(scenario);assert.equal(g.ok,false);
    assert.equal(g.checks.find(x=>x.name===rule).ok,false);
  });
}
test('grasp failure is not accepted as mission success',()=>{
  const {world,g}=setup('grasp-fail'),steps=makePlan(world,g);
  const graspIndex=steps.findIndex(s=>s.type==='VERIFY_GRASP');
  for(const step of steps.slice(0,graspIndex)){assert.equal(executeStep(world,step).ok,true);}
  assert.equal(executeStep(world,steps[graspIndex]).code,'E_POSTCONDITION_GRASP');
  assert.equal(world.completed,false);
});
test('runtime obstacle causes stop, route must be revalidated',()=>{
  const {world,g}=setup(),steps=makePlan(world,g);
  const next=steps.find(s=>s.to);world.walls.add(cellKey(next.to));
  assert.equal(executeStep(world,next).code,'E_RUNTIME_OBSTACLE');
  const replanned=bfs(world,world.robot,TARGET);assert.ok(replanned && replanned.length>0);
});
test('Base27 three-trit round-trip and input rejection',()=>{
  for(const s of ['CVNSS FPGA','A','Z ','ABCDEFGHIJKLMNOPQRSTUVWXYZ ']){
    const encoded=toTrits(s);assert.equal(fromTrits(encoded),s);assert.equal(encoded.length,s.length);
  }
  assert.equal(toTrits('Z')[0].ternary,'221');
  assert.equal(toTrits(' ')[0].ternary,'222');
  assert.throws(()=>toTrits('TIẾNG VIỆT'),/Base27 demo/);
});
