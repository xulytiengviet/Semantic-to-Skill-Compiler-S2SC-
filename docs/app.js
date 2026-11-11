import {WIDTH,HEIGHT,HOME,TARGET,makeWorld,proposeTask,validateTask,groundTask,makePlan,executeStep,bfs,cellKey,toTrits,fromTrits} from "./core.js";
const $=id=>document.getElementById(id);
let world,ir,grounding,plan,index,timer,logs,status,executed;
function stopTimer(){if(timer!=null)clearInterval(timer);timer=null;$("play").textContent="Auto-run";}
function say(message,kind="normal"){
  logs.push({message,kind});const pane=$("trace-output");pane.replaceChildren();
  for(let i=logs.length-1;i>=0;i--){
    const d=document.createElement("div");d.className="trace-entry"+(logs[i].kind==="error"?" error":logs[i].kind==="success"?" success":"");
    d.textContent=String(i+1).padStart(3,"0")+" · "+logs[i].message;pane.appendChild(d);
  }
}
function state(s,msg){
  status=s;$("mission-state").textContent=s;$("mission-state").className="status"+(["READY","COMPLETED"].includes(s)?" good":["REJECTED","ABORTED","E-STOP"].includes(s)?" bad":"");
  if(msg)$("sim-outcome").textContent=msg;
  const on=["READY","RUNNING"].includes(s)&&index<plan.length;$("step").disabled=!on;$("play").disabled=!on;
  if(!on)stopTimer();
}
function evidence(){
  const host=$("ground-evidence");host.replaceChildren();
  if(!grounding){host.textContent="Compile a command to inspect evidence.";return;}
  for(const c of grounding.checks){
    const d=document.createElement("div");d.className="evidence-item"+(c.ok?" pass":"");
    const icon=document.createElement("div");icon.className="indicator";
    const body=document.createElement("div"),title=document.createElement("strong"),detail=document.createElement("small");
    title.textContent=(c.ok?"PASS · ":"FAIL · ")+c.name;detail.textContent=c.detail;
    body.append(title,detail);d.append(icon,body);host.append(d);
  }
}
function map(){
  let o="";
  for(let y=0;y<HEIGHT;y++)for(let x=0;x<WIDTH;x++){
    const wall=world.walls.has(x+","+y);
    o+='<rect x="'+(x*60+1)+'" y="'+(y*60+1)+'" width="58" height="58" rx="4" fill="'+(wall?"#3c5666":"#112f40")+'" stroke="#365263"/>';
    if(wall)o+='<path d="M'+(x*60+13)+' '+(y*60+14)+' l34 32" stroke="#7794a5" opacity=".35"/>';
  }
  const points=[world.robot].concat(plan.slice(index).filter(p=>p.to).map(p=>p.to));
  if(points.length>1)o+='<polyline points="'+points.map(p=>(p.x*60+30)+','+(p.y*60+30)).join(" ")+'" fill="none" stroke="#5ad8c6" stroke-width="4" stroke-dasharray="7 7" opacity=".8"/>';
  o+='<rect x="'+(HOME.x*60+13)+'" y="'+(HOME.y*60+13)+'" width="34" height="34" rx="5" fill="#f7c98a"/>';
  o+='<text x="'+(HOME.x*60+30)+'" y="'+(HOME.y*60+36)+'" fill="#24313b" text-anchor="middle" font-size="18" font-weight="bold">H</text>';
  o+='<rect x="'+(TARGET.x*60+5)+'" y="'+(TARGET.y*60+6)+'" width="50" height="48" rx="4" fill="#3d6072" stroke="#92afbd"/>';
  if(world.object.visible&&!world.grasped)o+='<rect x="'+(TARGET.x*60+23)+'" y="'+(TARGET.y*60+22)+'" width="16" height="26" rx="5" fill="#81b4fc" stroke="#d8ecff" stroke-width="2"/>';
  o+='<circle cx="'+(world.robot.x*60+30)+'" cy="'+(world.robot.y*60+30)+'" r="20" fill="#67e0cd" stroke="#b9fff3" stroke-width="3"/>';
  o+='<text x="'+(world.robot.x*60+30)+'" y="'+(world.robot.y*60+36)+'" fill="#073c39" text-anchor="middle" font-size="16" font-weight="bold">'+(world.grasped?"R+":"R")+'</text>';
  $("world-map").innerHTML=o;$("robot-pose").textContent=world.robot.x+", "+world.robot.y;
  $("battery").textContent=world.batteryWh.toFixed(1)+" Wh";$("steps-taken").textContent=String(executed);$("grasp-status").textContent=world.grasped?"CONFIRMED":"NO";
}
function render(){map();evidence();$("ir-output").textContent=ir?JSON.stringify(ir,null,2):'{ "status": "IDLE" }';}
function reset(){
  stopTimer();world=makeWorld($("scenario").value);ir=null;grounding=null;plan=[];index=0;logs=[];executed=0;
  $("trace-output").textContent="No transitions yet.";state("IDLE","No task compiled yet.");render();
}
function compile(){
  reset();ir=proposeTask($("utterance").value);say("Toy Vietnamese text parser; no microphone, ASR or TinyLM.");
  if(!ir){state("REJECTED","E_INTENT_AMBIGUOUS: ask for clarification.");say("Intent/slots cannot be resolved.","error");render();return;}
  say("Proposed typed Task IR constructed, never self-authorized.");
  const v=validateTask(ir);
  if(!v.ok){state("REJECTED",v.errors.join("; "));v.errors.forEach(e=>say(e,"error"));render();return;}
  say("Static type and constraints: pass.");
  if(ir.intent==="STOP"){world.allowed=false;state("E-STOP","Stop request: no motion admitted.");say("Stop acknowledged in symbolic model.","success");render();return;}
  grounding=groundTask(ir,world);say("World grounding: query sensed observations and route feasibility.");
  for(const c of grounding.checks)say((c.ok?"PASS ":"FAIL ")+c.name,c.ok?"normal":"error");
  if(!grounding.ok){state("REJECTED","Admission denied: grounding evidence or feasibility failed.");say("No skills dispatched.","error");render();return;}
  plan=makePlan(world,grounding);state("READY","Proposed mission admitted by simulated checks; "+plan.length+" bounded symbolic operations.");
  say("Plan admitted; "+plan.length+" skill steps queued.","success");render();
}
function replan(){
  if(world.replanCount>=1){state("ABORTED","E_REPLAN_LIMIT: stop.");say("Bounded replan already used.","error");return;}
  world.replanCount++;
  const returning=world.grasped,target=returning?world.home:world.object.pose;
  const outbound=bfs(world,world.robot,target);
  const back=returning?null:bfs(world,world.object.pose,world.home);
  if(!outbound||(!returning&&!back)){state("ABORTED","E_RUNTIME_OBSTACLE: no alternate path.");say("Cannot safely replan.","error");render();return;}
  plan=outbound.slice(1).map(to=>({type:returning?"RETURN":"NAVIGATE",to:{...to}}));
  if(!returning)plan.push({type:"GRASP",objectId:world.object.id},{type:"VERIFY_GRASP"},...back.slice(1).map(to=>({type:"RETURN",to:{...to}})));
  plan.push({type:"VERIFY_RETURN"});index=0;say("Bounded replan 1/1 constructed using updated obstacle map.","success");
  state("RUNNING","A new route was planned after detecting the runtime obstacle.");render();
}
function finish(){
  if(world.completed){state("COMPLETED","SUCCESS (SYMBOLIC ONLY): grasp and return postconditions both confirmed.");say("Mission success with postcondition evidence.","success");}
  else{state("ABORTED","E_POSTCONDITION: success not verified.");say("False success prevented.","error");}
  render();
}
function step(){
  if(!["READY","RUNNING"].includes(status)||index>=plan.length)return;
  const op=plan[index];
  if(world.scenario==="dynamic-obstacle"&&executed===2&&world.replanCount===0&&op.to){
    world.walls.add(cellKey(op.to));say("Injected dynamic obstacle after admission.","error");
  }
  const result=executeStep(world,op);
  if(!result.ok){
    say(op.type+" returned "+result.code,"error");
    if(result.code==="E_RUNTIME_OBSTACLE"){replan();return;}
    state("ABORTED",result.code+" — runtime guard or postcondition failed.");render();return;
  }
  index++;executed++;if(status==="READY")state("RUNNING","Executing monitored symbolic skills.");
  say(op.type+(op.to?"("+op.to.x+","+op.to.y+")":"")+" → "+result.code,result.code==="MISSION_CONFIRMED"?"success":"normal");
  if(index>=plan.length)finish();else render();
}
$("compile").addEventListener("click",compile);
$("reset").addEventListener("click",reset);
$("scenario").addEventListener("change",reset);
$("step").addEventListener("click",()=>{stopTimer();step();});
$("play").addEventListener("click",()=>{
  if(timer!=null){stopTimer();return;}
  if(!["READY","RUNNING"].includes(status))return;
  $("play").textContent="Pause";
  timer=setInterval(()=>{if(["READY","RUNNING"].includes(status))step();else stopTimer();},220);
});
$("estop").addEventListener("click",()=>{stopTimer();world.allowed=false;state("E-STOP","Independent simulated E-stop inhibits new skill dispatch.");say("E-STOP active (browser only).","error");render();});
for(const b of document.querySelectorAll("[data-tab]"))b.addEventListener("click",()=>{
  for(const x of document.querySelectorAll("[data-tab]")){const active=x.dataset.tab===b.dataset.tab;x.classList.toggle("active",active);x.setAttribute("aria-selected",String(active));}
  for(const x of ["ground","ir","trace"])$("tab-"+x).classList.toggle("active",x===b.dataset.tab);
});
function trits(){
  const host=$("trit-body");host.replaceChildren();
  try{
    const rows=toTrits($("base27-input").value);
    for(const x of rows){const tr=document.createElement("tr");for(const field of [x.char===" "?"SPACE":x.char,x.id,x.ternary,x.balanced]){const td=document.createElement("td");td.textContent=String(field);tr.append(td);}host.append(tr);}
    if(fromTrits(rows)!==$("base27-input").value.toUpperCase())throw Error("Round-trip test failed");
    $("base27-note").textContent="Illustrative Base27 round-trip confirmed. Independent 2-bit fields use "+rows.length*6+" bits.";
    $("symbols-count").textContent=rows.length+" symbols";$("trits-count").textContent=rows.length*3+" trits";$("bits-count").textContent=rows.length*5+" bits (5-bit IDs)";
  }catch(e){$("base27-note").textContent=e.message;$("symbols-count").textContent="Invalid input";$("trits-count").textContent="—";$("bits-count").textContent="—";}
}
$("base27-input").addEventListener("input",trits);
$("copy-bibtex").addEventListener("click",async()=>{
  const bib="@misc{ngo2026s2sc,\n  title={A Safety-Governed Vietnamese Semantic-to-Skill Compilation Framework for Hybrid FPGA--ARM Robotics},\n  author={Long Ngo},\n  year={2026},\n  note={Research preprint / symbolic browser simulation, not peer-reviewed},\n  url={https://github.com/xulytiengviet/Semantic-to-Skill-Compiler-S2SC-}\n}";
  try{await navigator.clipboard.writeText(bib);$("copy-bibtex").textContent="BibTeX copied ✓";}catch{$("copy-bibtex").textContent="Clipboard unavailable";}
});
reset();trits();
