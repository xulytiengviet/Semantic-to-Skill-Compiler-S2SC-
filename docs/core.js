/**
 * S2SC v1.0 — symbolic demonstrator, NOT speech recognition, CVNSS conversion,
 * a robotics controller, or an engineering safety system.
 * All public functions are deterministic for reproducible browser tests.
 */
export const WIDTH = 11;
export const HEIGHT = 8;
export const HOME = Object.freeze({ x: 1, y: 6 });
export const TARGET = Object.freeze({ x: 8, y: 1 });
export const MAX_SPEED = 0.25;
export const MAX_PAYLOAD = 0.30;
const baseWalls = ["3,1","3,2","3,3","3,4","5,4","6,4","7,4"];
export const cellKey = p => p.x + "," + p.y;
export const same = (a, b) => !!a && !!b && a.x === b.x && a.y === b.y;

export function makeWorld(scenario = "nominal") {
  const walls = new Set(baseWalls);
  if (scenario === "blocked") for (let x=0; x<WIDTH; x++) walls.add(x + ",4");
  return {
    scenario, width: WIDTH, height: HEIGHT, walls,
    robot: { ...HOME }, home: { ...HOME },
    table: { ...TARGET },
    object: { id:"bottle_01", type:"bottle", color:"blue", pose: { ...TARGET },
              observedAt: scenario === "stale" ? 0 : 990, confidence:0.97,
              visible:scenario !== "missing", massKg:0.12 },
    now:1000, localization:{valid:true, frame:"map", timestamp:998, uncertaintyM:0.03},
    batteryWh: scenario === "low-battery" ? 0.1 : 28,
    allowed:true, grasped:false, completed:false, motorEnabled:false,
    path:[], replanCount:0
  };
}

export function normalizeVi(s) {
  return String(s ?? "").normalize("NFC").toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g,"").replace(/đ/g,"d");
}
/** Constrained toy semantic recognizer. Not ASR, NLU or TinyLM. */
export function proposeTask(utterance) {
  const t=normalizeVi(utterance).trim();
  const wantsStop=/\b(dung|stop|khan cap)\b/.test(t);
  if(wantsStop) return {ir_version:"1.0.0", intent:"STOP", arguments:{}, constraints:{max_speed_mps:0,max_payload_kg:0}, status:"PROPOSED", source:{language:"vi",mode:"typed-demo"}};
  const fetch=/\b(lay|mang|fetch|bring)\b/.test(t);
  const bottle=/\b(chai|bottle|nuoc)\b/.test(t);
  const returnHome=/\b(quay|tro|return|ve|lai)\b/.test(t);
  if(!fetch || !bottle || !returnHome) return null;
  let color="blue";
  if(/\b(do|red)\b/.test(t)) color="red";
  if(/\b(xanh|blue)\b/.test(t)) color="blue";
  return {
    ir_version:"1.0.0",
    intent:"FETCH_AND_RETURN",
    arguments:{
      object:{class:"bottle",color,location_hint:"table_2"},
      return_reference:"mission_start"
    },
    constraints:{max_speed_mps:0.25,max_payload_kg:0.30},
    status:"PROPOSED",
    source:{language:"vi",mode:"typed-demo"}
  };
}

export function validateTask(ir) {
  const errors=[];
  if (!ir || typeof ir !== "object" || Array.isArray(ir)) return {ok:false,errors:["E_SCHEMA: expected object"]};
  if(ir.ir_version!=="1.0.0") errors.push("E_VERSION: unsupported IR version");
  if(ir.status!=="PROPOSED") errors.push("E_AUTH: candidate IR must remain PROPOSED");
  if(!["FETCH_AND_RETURN","STOP"].includes(ir.intent)) errors.push("E_INTENT: not allowed");
  if(!ir.constraints || typeof ir.constraints.max_speed_mps!=="number" ||
      ir.constraints.max_speed_mps<0 || ir.constraints.max_speed_mps>MAX_SPEED)
    errors.push("E_SPEED: speed exceeds 0.25 m/s or invalid");
  if(!ir.constraints || typeof ir.constraints.max_payload_kg!=="number" ||
      ir.constraints.max_payload_kg<0 || ir.constraints.max_payload_kg>MAX_PAYLOAD)
    errors.push("E_PAYLOAD: mass constraint invalid");
  if(ir.intent==="FETCH_AND_RETURN") {
    if(ir.arguments?.object?.class!=="bottle" ||
       !["blue","red"].includes(ir.arguments?.object?.color))
      errors.push("E_OBJECT_TYPE: invalid typed object");
    if(ir.arguments?.return_reference!=="mission_start")
      errors.push("E_FRAME: return reference is unresolved");
  }
  if("execution_authorized" in ir || "motor_command" in ir) errors.push("E_PRIVILEGE: AI cannot grant motor authorization");
  return {ok:errors.length===0,errors};
}

export function bfs(world, start, goal) {
  if(!start || !goal || world.walls.has(cellKey(start)) || world.walls.has(cellKey(goal))) return null;
  const queue=[{...start}], seen=new Set([cellKey(start)]), prev=new Map();
  const steps=[[1,0],[-1,0],[0,1],[0,-1]];
  for(let i=0;i<queue.length;i++){
    const p=queue[i];
    if(same(p,goal)){
      const path=[p]; let k=cellKey(p);
      while(prev.has(k)) { const q=prev.get(k); path.unshift(q); k=cellKey(q); }
      return path;
    }
    for(const [dx,dy] of steps){
      const q={x:p.x+dx,y:p.y+dy}, key=cellKey(q);
      if(q.x<0||q.x>=world.width||q.y<0||q.y>=world.height||world.walls.has(key)||seen.has(key)) continue;
      seen.add(key);prev.set(key,p);queue.push(q);
    }
  }
  return null;
}

/** Grounding checks evidence, *not* just syntactic type safety. */
export function groundTask(ir, world) {
  const checks=[];
  function check(name,ok,detail){checks.push({name,ok:!!ok,detail});}
  const loc=world.localization;
  check("Localization & map frame",loc.valid && loc.frame==="map" && world.now-loc.timestamp<=10,
        "frame=map; age="+(world.now-loc.timestamp)+" ticks");
  if(ir?.intent==="STOP") return {ok:true,checks:[{name:"STOP admission",ok:true,detail:"Always permitted in toy model"}],path:[],returnPath:[]};
  const o=world.object;
  check("Object detection",o.visible,"detector observation: "+(o.visible?"visible":"missing"));
  check("Object class and color",o.visible && o.type===ir.arguments.object.class && o.color===ir.arguments.object.color,
        "observed "+o.type+" / "+o.color+"; requested "+ir.arguments.object.color);
  check("Observation freshness",world.now-o.observedAt<=10,"age="+(world.now-o.observedAt)+" ticks; maximum=10");
  check("Payload affordance",o.massKg<=ir.constraints.max_payload_kg,
        "mass="+o.massKg+" kg; admitted limit="+ir.constraints.max_payload_kg+" kg");
  const path=bfs(world,world.robot,o.pose);
  const returnPath=path && bfs(world,o.pose,world.home);
  check("Path existence",!!path && !!returnPath,
        path&&returnPath ? "outbound="+(path.length-1)+" / return="+(returnPath.length-1)+" cells":"no feasible round trip");
  const distance=(path?.length??100)+(returnPath?.length??100);
  check("Round-trip battery reserve",world.batteryWh>=distance*0.10+3,
        "available="+world.batteryWh.toFixed(1)+" Wh; model reserve="+(distance*0.10+3).toFixed(1)+" Wh");
  check("Operator admission",world.allowed,"simulated permission flag");
  return {ok:checks.every(c=>c.ok), checks, path, returnPath};
}

export function makePlan(world,grounding){
  if(!grounding?.ok) return [];
  return [
    ...grounding.path.slice(1).map(p=>({type:"NAVIGATE",to:{...p}})),
    {type:"GRASP",objectId:world.object.id},
    {type:"VERIFY_GRASP"},
    ...grounding.returnPath.slice(1).map(p=>({type:"RETURN",to:{...p}})),
    {type:"VERIFY_RETURN"}
  ];
}

/** One symbolic step. Runtime hazard checks act independently of static Task IR. */
export function executeStep(world,step) {
  if(!step) return {ok:false,code:"E_NO_STEP"};
  if(!world.localization.valid || world.now-world.localization.timestamp>10)
    return {ok:false,code:"E_RUNTIME_POSE_STALE"};
  if(!world.allowed) return {ok:false,code:"E_RUNTIME_AUTH"};
  if(step.type==="NAVIGATE" || step.type==="RETURN"){
    if(world.walls.has(cellKey(step.to))) return {ok:false,code:"E_RUNTIME_OBSTACLE"};
    if(Math.abs(world.robot.x-step.to.x)+Math.abs(world.robot.y-step.to.y)!==1)
      return {ok:false,code:"E_NONLOCAL_ACTUATION"};
    world.robot={...step.to}; world.batteryWh=Math.max(0,world.batteryWh-.10);
    return {ok:true,code:"POSE_REACHED"};
  }
  if(step.type==="GRASP") {
    if(!same(world.robot,world.object.pose)) return {ok:false,code:"E_GRASP_NOT_REACHABLE"};
    if(world.scenario!=="grasp-fail") world.grasped=true;
    return {ok:true,code:"GRASP_ATTEMPTED"};
  }
  if(step.type==="VERIFY_GRASP")
    return world.grasped ? {ok:true,code:"GRASP_CONFIRMED"} : {ok:false,code:"E_POSTCONDITION_GRASP"};
  if(step.type==="VERIFY_RETURN"){
    if(!same(world.robot,world.home)||!world.grasped) return {ok:false,code:"E_POSTCONDITION_RETURN"};
    world.completed=true; return {ok:true,code:"MISSION_CONFIRMED"};
  }
  return {ok:false,code:"E_UNKNOWN_SKILL"};
}

/** Base27 alphabet A-Z and SPACE, NOT the CVNSS4.0 spelling converter. */
export const ALPHABET="ABCDEFGHIJKLMNOPQRSTUVWXYZ ";
export function toTrits(input){
  const str=String(input).toUpperCase();
  if(!/^[A-Z ]*$/.test(str)) throw new Error("Base27 demo accepts only A–Z and SPACE; CVNSS conversion is NOT implemented.");
  return [...str].map(char=>{
    const id=ALPHABET.indexOf(char);
    const digits=[Math.floor(id/9),Math.floor((id%9)/3),id%3];
    return {char,id,ternary:digits.join(""),balanced:digits.map(d=>d-1).join(",")};
  });
}
export function fromTrits(items){
  return items.map(x=>{
    const bits=String(x.ternary);
    if(!/^[012]{3}$/.test(bits)) throw new Error("Invalid trit code");
    const id=[...bits].reduce((a,d)=>a*3+Number(d),0);
    return ALPHABET[id];
  }).join("");
}
