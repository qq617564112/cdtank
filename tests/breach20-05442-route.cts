import {writeFileSync} from 'node:fs';
import {World} from '../apps/server/src/world';
import type {RoomState} from '../apps/server/src/rooms/state';
import {BotPathPlanner} from '../apps/server/src/battle/cpu/navigation';
import {createOriginalBotNavigation} from '../apps/server/src/battle/cpu/original-navigation';
const world=new World();const joined=world.createAndJoin('route42',5,20,'Route42','Player',1);
for(let i=0;i<3;i++)world.manageCpu(joined.playerId,1,'ADD',1);world.ready(joined.playerId,1);
const room=(world as unknown as {rooms:Map<string,RoomState>}).rooms.get(joined.roomId)!;
const snapshot=world.snapshot(joined.roomId)!;const me=snapshot.players.find(p=>p.id===joined.playerId)!;
const start={x:me.x,y:me.y,z:me.z};const target=snapshot.match.objectives.find(o=>o.id==='SCN:279')!;
const policy=createOriginalBotNavigation(room.battlefield,{width:73,depth:76});
const candidates=[];let result,goal;
for(let i=0;i<8;i++){
 const angle=i*Math.PI/4;const candidate={x:target.x+160*Math.sin(angle),y:0,z:target.z+160*Math.cos(angle)};
 const cell=room.battlefield.navigation.sample(candidate.x,candidate.z);if(!cell?.valid){candidates.push({candidate,reason:'invalidNAV'});continue;}candidate.y=cell.height;
 const planner=new BotPathPlanner(room.battlefield,start,candidate,policy);let route;
 for(let j=0;j<10000&&route===undefined;j++)route=planner.advance(1000,20);
 candidates.push({candidate,route});if(route?.length){result=route;goal=candidate;break;}
}
if(!result?.length)throw Error('No original footprint route to05442 firing approach '+JSON.stringify({start,candidates}));
writeFileSync('recovery/output/breach20-05442-route.json',JSON.stringify({sourcePlacement:279,start,target,goal,route:result,scope:'Read-only original NAV/ordinary World coverage planning with24-unit steering clearance; actual role footprint49x52 unchanged'},null,2)+'\n');
console.log(JSON.stringify({start,goal,route:result}));world.leave(joined.playerId);
