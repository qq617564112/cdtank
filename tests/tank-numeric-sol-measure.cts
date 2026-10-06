import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {TANKS,PET_BASES} from '../apps/server/src/config';
import {combatSkills,combatItemSkills,combatLimits} from '../apps/server/src/battle/catalog';
import {recomputeRoleAttributes} from '../apps/server/src/battle/roles/recompute';
import {ROLE_INITIAL_MOVEMENT_SCALES} from '../apps/server/src/battle/roles/record-defaults';
import {roleMovementCommand} from '../apps/server/src/battle/roles/movement-permission';
import {moveRolePose} from '../apps/server/src/battle/roles/movement-math';
import type {MsgRoomSnapshot,MsgRoomEvent,PlayerSnapshot} from '../apps/shared/protocols';
interface Measurement {name:string;input:{move:number;turn:number;aim:number};values:(PlayerSnapshot&{tick:number})[]}
const evidence=JSON.parse(readFileSync('recovery/output/tank-numeric-sol-network.json','utf8')) as {
 status:string;fixture:{base:[number,number][];equipment:[number,number][]};manual:{measured:Measurement[];reload:{duration:number};intervals:number[]};
 frames:MsgRoomSnapshot[][];events:MsgRoomEvent[][];autonomous:{hit:MsgRoomEvent};
};
assert.equal(evidence.status,'PASS');
const base={name:'Explicit base pet1 fixture',fields:new Map(evidence.fixture.base)};
const equipment={name:'Explicit base tank1 fixture',fields:new Map(evidence.fixture.equipment)};
let speed=0,turn=0;
const recompute=recomputeRoleAttributes({base,equipment,tank:TANKS.find(t=>t.id===1)!.recomputeBase,pet:PET_BASES.find(p=>p.id===1)!,
 sources:{currentSkillIds:Array(16).fill(0),equipmentSkills:undefined,extraSkill:{baseId:0,rank:0},itemIds:[2001,0,0,0,0,0,0,0,0,0]},
 skills:combatSkills,items:combatItemSkills,limits:combatLimits,roleValue9:1,tankType:1,movementScales:ROLE_INITIAL_MOVEMENT_SCALES,vip:0,vipMultiplier:0},
 {setMovement:(selector,value)=>{if(selector===10)speed=value;else turn=value;},notify:()=>{},clearDirty:()=>{}});
assert(recompute.completed);
const dt=.05;
const vector=(yaw:number)=>({x:Math.fround(Math.sin(yaw)),y:0,z:Math.fround(Math.cos(yaw))});
const measurements=evidence.manual.measured.map(segment=>{
 const steps=segment.values.slice(1).map((actual,index)=>{
  const previous=segment.values[index],ticks=actual.tick-previous.tick;
  if(ticks!==1)return {tick:actual.tick,status:'nonconsecutive'};
  const expected=moveRolePose({position:previous,look:vector(previous.yaw),forward:vector(previous.bodyYaw??previous.yaw),
   command:roleMovementCommand(segment.input.move,segment.input.turn) as 0|1|2|3|4|5|6|7|8,tankType:1,move:speed,turn,dt});
  const distance=Math.hypot(actual.x-previous.x,actual.z-previous.z);
  const expectedDistance=Math.hypot(expected.position.x-previous.x,expected.position.z-previous.z);
  const positionError=Math.hypot(actual.x-expected.position.x,actual.z-expected.position.z);
  const wrap=(angle:number)=>Math.atan2(Math.sin(angle),Math.cos(angle));
  const yawError=Math.abs(wrap(actual.yaw-Math.atan2(expected.look.x,expected.look.z)));
  const blocked=expectedDistance>0&&distance<expectedDistance-.02;
  if(!blocked){assert(positionError<.025,`${segment.name} source position error ${positionError}`);assert(yawError<.00016);}
  const aimExpected=previous.aim+segment.input.aim*.9*dt,aimError=Math.abs(actual.aim-aimExpected);
  assert(aimError<.00016);
  return {tick:actual.tick,status:blocked?'NAV-or-dynamic-blocked':'source-math-comparable',dt,distance,expectedDistance,
   speed:distance/dt,positionError,relativeDistanceError:expectedDistance>.001?Math.abs(distance-expectedDistance)/expectedDistance:0,yawError,
   aimError,aimSource:'rebuilt0.9'};
 });
 return {name:segment.name,steps};
});
assert.equal(evidence.manual.reload.duration,recompute.state.roleFloats.get(0x50));
assert(evidence.frames[0][0].players.every(p=>p.maxHp===recompute.state.recordFields.get(0x58)));
const trajectories=new Map<string,{tick:number;x:number;y:number;z:number;vx:number;vy:number;vz:number;ownerId:string}[]>();
for(const frame of evidence.frames[0])for(const bullet of frame.bullets){const list=trajectories.get(bullet.id)??[];list.push({tick:frame.tick,...bullet});trajectories.set(bullet.id,list);}
const flight=[...trajectories].map(([id,samples])=>({id,ownerId:samples[0].ownerId,firstTick:samples[0].tick,lastTick:samples.at(-1)!.tick,
 steps:samples.slice(1).map((sample,index)=>{const previous=samples[index],seconds=(sample.tick-previous.tick)*dt;
 const distance=Math.hypot(sample.x-previous.x,sample.y-previous.y,sample.z-previous.z);
 const velocity=Math.hypot(sample.vx,sample.vy,sample.vz);const error=Math.abs(distance-velocity*seconds);assert(error<.035);
 return {seconds,distance,measuredSpeed:distance/seconds,projectedSpeed:velocity,positionDistanceError:error,source:'rebuilt-projectile'};})}));
const hit=evidence.autonomous.hit;
let hpChange:Record<string,unknown>|undefined;
for(let i=1;i<evidence.frames[0].length;i++){
 const previous=evidence.frames[0][i-1],current=evidence.frames[0][i];
 const before=previous.players.find(p=>p.id===hit.targetId)!,after=current.players.find(p=>p.id===hit.targetId)!;
 if(before.hp-after.hp!==hit.value)continue;
 const removed=previous.bullets.filter(b=>b.ownerId===hit.playerId&&!current.bullets.some(c=>c.id===b.id));
 assert.equal(removed.length,1,'One observed bullet disappears at actual HP reduction');
 const projectile=flight.find(b=>b.id===removed[0].id)!;
 hpChange={tick:current.tick,hpBefore:before.hp,hpAfter:after.hp,eventDamage:hit.value,bulletId:projectile.id,
  firstObservedToHitSeconds:(current.tick-projectile.firstTick)*dt,
  creationToHitBracketSeconds:[(current.tick-projectile.firstTick)*dt,(current.tick-projectile.firstTick+1)*dt],
  source:'rebuilt-damage; snapshot tick observation; initial sub-tick impact time unavailable'};
 break;
}
assert(hpChange,'Actual hit event and before/after HP must agree');
const summary={status:'PASS',sourceValues:{speed,turn,maxHp:recompute.state.recordFields.get(0x58),reload:recompute.state.roleFloats.get(0x50),
 attack:recompute.state.roleFloats.get(0x74),defense:recompute.state.roleFloats.get(0x7c),side:recompute.state.roleFloats.get(0x80),back:recompute.state.roleFloats.get(0x84),selectedSkills:recompute.selectedSkillIds},
 measurements,flight,hpChange,continuousFireIntervals:evidence.manual.intervals,
 limitations:'Network coordinates are rounded0.01 and angles0.0001. Source-math comparison excludes observed blocked steps; actual Windows client/framebuffer unmeasured. Projectile360/damage43 remain reconstruction.'};
writeFileSync('recovery/output/tank-numeric-sol-measure.json',JSON.stringify(summary,null,2));
console.log('PASS: source recompute/ordinary distances/turn/stop/intervals, observed same-bullet flights and matching actual HP reduction');
