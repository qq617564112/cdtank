import {writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {AccountStore} from '../apps/server/src/account-store';
import {World} from '../apps/server/src/world';
import {predictControlledBattleMovement} from '../apps/server/src/battle/dynamic-movement';
import type {PlayerState} from '../apps/server/src/battle/player-state';
import type {Battlefield} from '../apps/server/src/battlefield';
import type {MsgRoomEvent} from '../apps/shared/protocols';
let now=100000;const dir=mkdtempSync(join(tmpdir(),'vip07-diagnostic-'));const store=new AccountStore(join(dir,'accounts.sqlite'));
try{
 const account=store.open();store.replaceInventory(account.accountId,[{instanceId:77,itemTableId:1,ownedQuantity:3,battleQuantity:0,state:0,field8:9,float24Bits:0x7fc01234,float28Bits:0,float2cBits:0}]);store.assign(account.accountId,77,4);
 const world=new World(()=>now,{consumeItem:(id,instance,quantity,definition)=>store.consumeItem(account.accountId,instance,quantity,definition)});
 const joined=world.createAndJoin('human-3',3,7,'CPU验收','Observer',1),snapshot=()=>world.snapshot(joined.roomId)!;
 const count=Math.max(4,world.listMaps().find(m=>m.mode===3&&m.mapId===7)!.sourceMinPlayers);for(let i=1;i<count;i++)world.manageCpu(joined.playerId,1,'ADD',i%2?1:105);
 const guest=world.joinRoom(joined.roomId,'guest-3','Guest',1);world.leave(guest.playerId);world.bindInventory(joined.playerId,store.inventory(account.accountId));world.configureAutopilot(joined.playerId,1,true);world.ready(joined.playerId,1);
 const room=(world as unknown as {rooms:Map<string,{players:Map<string,PlayerState>;battlefield:Battlefield}>}).rooms.get(joined.roomId)!;
 const initial=snapshot(),frames:unknown[]=[],events:(MsgRoomEvent & {tick:number})[]=[];let ticks=0;const maxDistance=new Map(initial.players.map(p=>[p.id,0]));
 while(ticks<6200&&snapshot().phase==='PLAYING'){
  const before=snapshot();now+=50;const step=world.step(50);events.push(...step.events.map(e=>({tick:ticks,...e})));
  const after=snapshot();const players=[...room.players.values()].map(p=>{const predicted=predictControlledBattleMovement(p,p.input,room.battlefield,room.players.values(),.05);const prior=before.players.find(a=>a.id===p.id)!;const start=initial.players.find(a=>a.id===p.id)!;const distance=Math.hypot(p.x-start.x,p.z-start.z);maxDistance.set(p.id,Math.max(maxDistance.get(p.id)!,distance));return{id:p.id,team:p.team,vip:p.vip,hp:p.hp,alive:p.alive,status:p.combat.status,input:{...p.input},target:(p.cpu??p.autopilot)?.objectiveTargetId,before:{x:prior.x,y:prior.y,z:prior.z,yaw:prior.yaw},actual:{x:p.x,y:p.y,z:p.z,yaw:p.yaw,aim:p.aim},delta:Math.hypot(p.x-prior.x,p.z-prior.z),nextPredicted:predicted?{position:predicted.pose.position,yaw:predicted.yaw}:null,attributesReady:p.attributesReady,movement:{move:p.attributes.record.move,turn:p.attributes.record.turn,recovered:p.recoveredMovement}};});
  frames.push({tick:ticks,time:now,phase:after.phase,players,events:step.events});ticks++;
 }
 const final=snapshot();const output={status:'DIAGNOSTIC',scope:'Single first-round original fixture normal World/CPU/owned inventory/autopilot 50ms inputs; readonly state/prediction after each step; no state/position/damage/result injection',sourceEnvironment:{mapId:7,families:[...new Set(initial.match.sceneObjects.map(o=>o.sourceModel))],placements:initial.match.sceneObjects.map(o=>({id:o.id,sourcePlacementId:o.sourcePlacementId,sourceModel:o.sourceModel}))},initial,final,ticks,elapsedSeconds:ticks*.05,maxDistance:Object.fromEntries(maxDistance),ownerMovedAssertion:(maxDistance.get(joined.playerId)??0)>20,events,frames};writeFileSync('recovery/output/vip07-diagnostic.json',JSON.stringify(output,null,2)+'\n');console.log(JSON.stringify({ticks,elapsedSeconds:output.elapsedSeconds,reason:final.match?.result?.reason,maxDistance:output.maxDistance,ownerMovedAssertion:output.ownerMovedAssertion,fire:events.filter(e=>e.type==='fire').length}));world.leave(joined.playerId);
}finally{store.close();rmSync(dir,{recursive:true,force:true});}
