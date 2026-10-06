import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {WsClient} from 'tsrpc';
import {serviceProto} from '../apps/shared/protocols/serviceProto';
import type {MsgRoomSnapshot,MsgRoomEvent} from '../apps/shared/protocols';
async function main(){
 const dir=mkdtempSync(join(tmpdir(),'cdtank-vip07-')),port=3214;let log='';
 const server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env:{...process.env,PORT:String(port),ACCOUNT_DB_PATH:join(dir,'accounts.sqlite')},stdio:['ignore','pipe','pipe']});server.stdout.on('data',d=>{log+=String(d);});server.stderr.on('data',d=>{log+=String(d);});
 const clients=Array.from({length:3},()=>new WsClient(serviceProto,{server:`ws://127.0.0.1:${port}`,logger:undefined,heartbeat:{interval:5000,timeout:10000}}));
 const snapshots:MsgRoomSnapshot[][]=clients.map(()=>[]),events:MsgRoomEvent[][]=clients.map(()=>[]);clients.forEach((c,i)=>{c.listenMsg('RoomSnapshot',s=>snapshots[i].push(s));c.listenMsg('RoomEvent',e=>events[i].push(e));});
 const latest=(i=0)=>snapshots[i].at(-1)!;async function wait(f:()=>boolean,ms=10000){const deadline=Date.now()+ms;while(!f()&&Date.now()<deadline)await new Promise(r=>setTimeout(r,30));assert(f(),log.slice(-1000));}
 const evidence:{[key:string]:unknown}={port,scope:'Actual index mode3/map7 two authenticated humans tank1, CPU tank105+1; normal CreateRoom/Join/CPU/Autopilot/Ready/Rematch/Leave; source spawns and natural combat'};
 try{await wait(()=>log.includes(`Server started at ${port}.`));for(const c of clients){assert((await c.connect()).isSucc);assert((await c.callApi('Account',{})).isSucc);}
 const room=await clients[0].callApi('CreateRoom',{mode:3,mapId:7,name:'VIP甲',tankId:1,roomName:'地图7擒王验收'});assert(room.isSucc,JSON.stringify(room));const roomId=room.res.room.id,ownerId=room.res.playerId;
 const guest=await clients[1].callApi('Join',{roomId,clientId:'ignored',name:'VIP乙',tankId:1});assert(guest.isSucc);assert((await clients[1].callApi('ChangeTeam',{round:1,team:1})).isSucc);
 for(const tankId of [105,1])assert((await clients[0].callApi('Cpu',{round:1,operation:'ADD',tankId})).isSucc);
 await wait(()=>latest()?.players.length===4&&latest(1)?.players.length===4);evidence.waiting=latest();
 for(const c of clients.slice(0,2))assert((await c.callApi('Autopilot',{round:1,enabled:true})).isSucc);
 for(const c of clients.slice(0,2))assert((await c.callApi('Ready',{round:1,isReady:true})).isSucc);
 await wait(()=>snapshots[0].some(s=>s.phase==='PLAYING'));const initial=snapshots[0].find(s=>s.phase==='PLAYING')!;evidence.initial=initial;evidence.sourceEnvironment={mapId:7,families:[...new Set(initial.match!.sceneObjects!.map(o=>o.sourceModel))],placements:initial.match!.sceneObjects!.map(o=>({id:o.id,sourcePlacementId:o.sourcePlacementId,sourceModel:o.sourceModel}))};
 await wait(()=>latest()?.phase==='FINISHED',320000);evidence.finished=latest();assert.equal(latest().match!.result!.reason,'OBJECTIVE');
 const firstRound=snapshots[0].filter(s=>s.match?.round===1),start=initial.players.find(p=>p.id===ownerId)!;const maxDistance=Math.max(...firstRound.map(s=>{const p=s.players.find(p=>p.id===ownerId)!;return Math.hypot(p.x-start.x,p.z-start.z);}));
 const ownerFire=events[0].filter(e=>e.type==='fire'&&e.playerId===ownerId),ownerHit=events[0].filter(e=>e.type==='hit'&&e.playerId===ownerId);evidence.owner={id:ownerId,vip:start.isVIP,maxDistance,fire:ownerFire.length,hits:ownerHit.length};assert(maxDistance>20,'owner did not naturally move >20');assert(ownerFire.length>0,'owner did not naturally fire');assert(ownerHit.length>0,'owner did not naturally hit');
 assert(events[0].some(e=>e.type==='destroy'&&initial.players.some(p=>p.id===e.targetId&&p.isVIP)),'no natural VIP death');const firstEvents=events.slice(0,2).map(es=>es.filter(e=>e.roomId===roomId));assert.deepEqual(firstEvents[0],firstEvents[1]);
 for(const c of clients.slice(0,2))assert((await c.callApi('Rematch',{round:1})).isSucc);await wait(()=>latest()?.match?.round===2&&latest(1)?.match?.round===2);evidence.rematch=latest();assert.equal(latest().roomId,roomId);assert(latest().players.every(p=>p.alive));
 await wait(()=>snapshots[0].some(s=>s.match?.round===2&&s.phase==='PLAYING'));evidence.round2Playing=snapshots[0].find(s=>s.match?.round===2&&s.phase==='PLAYING');await wait(()=>latest()?.match?.round===2&&latest()?.phase==='FINISHED',320000);evidence.round2Finished=latest();assert.equal(latest().match!.result!.reason,'OBJECTIVE');
 for(const c of clients.slice(0,2))assert((await c.callApi('Leave',{roomId,round:2})).isSucc);assert.equal(events[2].filter(e=>e.roomId===roomId).length,0);evidence.status='PASS';console.log(JSON.stringify({status:'PASS',owner:evidence.owner,reason:latest().match?.result?.reason,round:2}));
 }catch(error){evidence.status='FAIL';evidence.error=String(error);throw error;}finally{evidence.snapshots=snapshots;evidence.allEvents=events;await Promise.allSettled(clients.map(c=>c.disconnect()));const end=new Promise<void>(r=>server.once('exit',()=>r()));server.kill();await end;writeFileSync('recovery/output/vip07-network.json',JSON.stringify(evidence,null,2)+'\n');writeFileSync('recovery/output/vip07-network.log',log);rmSync(dir,{recursive:true,force:true});}
}main().catch(e=>{console.error(e);process.exitCode=1;});
