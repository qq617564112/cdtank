import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {WsClient} from 'tsrpc';
import {serviceProto} from '../apps/shared/protocols/serviceProto';
import type {MsgRoomSnapshot,MsgRoomEvent} from '../apps/shared/protocols';
async function main(){
 const dir=mkdtempSync(join(tmpdir(),'cdtank-env07-')),port=3213;let log='';
 const server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env:{...process.env,PORT:String(port),ACCOUNT_DB_PATH:join(dir,'accounts.sqlite'),MATCH_TIME_LIMIT_SECONDS:'90'},stdio:['ignore','pipe','pipe']});server.stdout.on('data',d=>{log+=String(d);});server.stderr.on('data',d=>{log+=String(d);});
 const clients=Array.from({length:3},()=>new WsClient(serviceProto,{server:`ws://127.0.0.1:${port}`,logger:undefined,heartbeat:{interval:5000,timeout:10000}}));
 const snapshots:MsgRoomSnapshot[][]=clients.map(()=>[]),events:MsgRoomEvent[][]=clients.map(()=>[]);clients.forEach((c,i)=>{c.listenMsg('RoomSnapshot',s=>snapshots[i].push(s));c.listenMsg('RoomEvent',e=>events[i].push(e));});
 const latest=(i=0)=>snapshots[i].at(-1)!;async function wait(f:()=>boolean,ms=10000){const deadline=Date.now()+ms;while(!f()&&Date.now()<deadline)await new Promise(r=>setTimeout(r,30));assert(f(),log.slice(-1000));}
 const evidence:{[key:string]:unknown}={port,scope:'Actual index ordinary auth/CreateRoom/Join/CPU/Ready/Autopilot; no injected positions/damage/state/events/results'};
 try{await wait(()=>log.includes(`Server started at ${port}.`));for(const c of clients){assert((await c.connect()).isSucc);assert((await c.callApi('Account',{})).isSucc);}
 const room=await clients[0].callApi('CreateRoom',{mode:1,mapId:7,name:'ENV甲',tankId:1,roomName:'地图7环境验收'});assert(room.isSucc,JSON.stringify(room));const roomId=room.res.room.id;
 const guest=await clients[1].callApi('Join',{roomId,clientId:'ignored',name:'ENV乙',tankId:1});assert(guest.isSucc);assert((await clients[1].callApi('ChangeTeam',{round:1,team:1})).isSucc);
 for(let i=0;i<4;i++)assert((await clients[0].callApi('Cpu',{round:1,operation:'ADD',tankId:1})).isSucc);
 await wait(()=>latest()?.players.length===6&&latest(1)?.players.length===6);evidence.waiting=latest();
 for(const c of clients.slice(0,2)){assert((await c.callApi('Autopilot',{round:1,enabled:true})).isSucc);assert((await c.callApi('Ready',{round:1,isReady:true})).isSucc);}
 await wait(()=>latest()?.phase==='PLAYING');assert.equal(latest().match!.sceneObjects!.length,10);assert(latest().match!.sceneObjects!.every(o=>o.id.startsWith('ENV:')&&o.hp===200));assert.equal(latest().match!.objectives.length,0);evidence.initial=latest();console.log('PLAYING: natural CPU/autopilot collateral observation, legal90s deadline');
 await wait(()=>latest()?.phase==='FINISHED',100000);evidence.finished=latest();evidence.environmentEvents=events.slice(0,2).map(es=>es.filter(e=>e.type==='sceneObjectHit'||e.type==='sceneObjectDestroyed'));evidence.fireEvents=events[0].filter(e=>e.type==='fire').length;evidence.allEvents=events;
 const env0=events[0].filter(e=>e.type==='sceneObjectHit'||e.type==='sceneObjectDestroyed'),env1=events[1].filter(e=>e.type==='sceneObjectHit'||e.type==='sceneObjectDestroyed');assert.deepEqual(env0,env1);assert.equal(events[2].filter(e=>e.type.startsWith('sceneObject')).length,0);
 const common=snapshots[0].filter(s=>snapshots[1].some(t=>t.tick===s.tick&&t.phase===s.phase));for(const s of common){const t=snapshots[1].find(t=>t.tick===s.tick&&t.phase===s.phase)!;assert.deepEqual(s.match!.sceneObjects,t.match!.sceneObjects);}evidence.commonSnapshotCount=common.length;
 assert.equal(latest().match!.objectives.length,0);assert(latest().players.every(p=>p.objectivesDestroyed===0));assert.equal(latest().match!.result!.reason,'TIME_LIMIT');
 const damaged=latest().match!.sceneObjects!.filter(o=>o.hp<200),destroyed=damaged.filter(o=>o.hp===0);evidence.damaged=damaged;evidence.destroyed=destroyed;
 assert(damaged.length>0,'No reachable ENV damaged by this bounded natural CPU run');assert(destroyed.length>0,'No ENV destroyed in this bounded natural CPU run');
 for(const object of destroyed){const hits=env0.filter(e=>e.type==='sceneObjectHit'&&e.targetId===object.id);assert.equal(hits.reduce((s,e)=>s+e.value,0),200);assert.equal(env0.filter(e=>e.type==='sceneObjectDestroyed'&&e.targetId===object.id).length,1);}
 for(const c of clients.slice(0,2))assert((await c.callApi('Rematch',{round:1})).isSucc);await wait(()=>latest()?.match?.round===2&&latest(1)?.match?.round===2);assert(latest().match!.sceneObjects!.every(o=>o.hp===200&&o.destroyedAt===undefined));evidence.rematch=latest();
 const before=events.map(es=>es.length);for(const c of clients.slice(0,2))assert((await c.callApi('Leave',{roomId,round:2})).isSucc);await new Promise(r=>setTimeout(r,150));for(const c of clients)assert((await c.callApi('ListRooms',{})).isSucc);await new Promise(r=>setTimeout(r,150));assert.equal(events[2].filter(e=>e.roomId===roomId).length,0);evidence.leave={before,after:events.map(es=>es.length),thirdRoomEventCount:0};evidence.status='PASS';
 console.log('PASS: map7 real ENV collateral/destroy, dual snapshots/events, no objectives, natural TIME_LIMIT/rematch/Leave isolation');
 }catch(error){evidence.status='FAIL';evidence.error=String(error);evidence.latest=snapshots.map(ss=>ss.at(-1));evidence.allEvents=events;evidence.snapshots=snapshots.map(ss=>ss.length);throw error;}finally{await Promise.allSettled(clients.map(c=>c.disconnect()));const end=new Promise<void>(r=>server.once('exit',()=>r()));server.kill();await end;writeFileSync('recovery/output/environment07-network.json',JSON.stringify(evidence,null,2)+'\n');writeFileSync('recovery/output/environment07-network.log',log);rmSync(dir,{recursive:true,force:true});}
}main().catch(e=>{console.error(e);process.exitCode=1;});
