import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {copyFile, mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRequire} from 'node:module';
import {serviceProto} from '../apps/shared/protocols/serviceProto.ts';
import {ROOM_RECONNECT_WINDOW_MS} from '../apps/shared/room-reconnection.ts';
const {WsClient}=createRequire(import.meta.url)('tsrpc');
const port=Number(process.env.ROOM_RECONNECT_PORT);assert(Number.isInteger(port)&&port>0);
const checkpoint='recovery/output/tank-purchased-trap-restraint-network-2026-10-05T01-37-14-377Z';
const identities=JSON.parse(await readFile(checkpoint+'-identity.private.json','utf8')).accounts;
const directory=await mkdtemp(join(tmpdir(),'cdtank-reconnect-'));
const database=join(directory,'accounts.sqlite');await copyFile(checkpoint+'-checkpoint.sqlite',database);
const output='recovery/output/room-reconnect-network-'+new Date().toISOString().replace(/[:.]/g,'-');
const server=spawn(process.execPath,['scripts/start-server.mjs'],{env:{...process.env,PORT:String(port),ACCOUNT_DB_PATH:database},stdio:['ignore','pipe','pipe']});
let log='', evidence={status:'RUNNING',port,scope:'Four authenticated ordinary participants, fixed Map02/mode1. Lawful saved purchased role checkpoint; no active role, HP, position, clock or event injection. Temporary loss, authenticated same-role recovery, wrong identity rejection, real grace expiry and normal Leave. Reconstructed reconnection policy.'};
for(const stream of [server.stdout,server.stderr])stream.on('data',data=>log+=String(data));
const clients=Array.from({length:4},()=>new WsClient(serviceProto,{server:`ws://127.0.0.1:${port}`,logger:undefined,heartbeat:{interval:5000,timeout:10000}}));
const frames=clients.map(()=>[]),events=clients.map(()=>[]),tokens=[],members=[],inputLog=[];
clients.forEach((client,index)=>{client.listenMsg('RoomSnapshot',snapshot=>frames[index].push(snapshot));client.listenMsg('RoomEvent',event=>events[index].push(event));});
const latest=()=>frames[1].at(-1);
async function wait(predicate,timeout=15000){const end=Date.now()+timeout;while(!predicate()&&Date.now()<end)await new Promise(resolve=>setTimeout(resolve,20));assert(predicate(),log.slice(-600));}
async function send(index,sequence,move=0,fire=false){const message={sequence,move,turn:0,aim:0,fire,useItem:0,clientTime:Date.now()};inputLog.push({index,...message});assert((await clients[index].sendMsg('PlayerInput',message)).isSucc);}
try{
 await wait(()=>log.includes('Server started'));
 for(const [index,client] of clients.entries()){
  assert((await client.connect()).isSucc);const result=await client.callApi('Account',index<2?{token:identities[index].token}:{});assert(result.isSucc);tokens.push(result.res.token);
 }
 const owned=(await clients[0].callApi('OwnedRoles',{})).res,profile=(await clients[0].callApi('RoleProfile',{})).res;
 const created=await clients[0].callApi('CreateRoom',{mode:1,mapId:2,roomName:'断线恢复',name:'Host',tankId:3});assert(created.isSucc,JSON.stringify(created));const roomId=created.res.room.id;
 members.push(created.res.playerId);
 for(let index=1;index<4;index++){const result=await clients[index].callApi('Join',{roomId,clientId:'',name:'Peer',tankId:index<2?3:1});assert(result.isSucc,JSON.stringify(result));members.push(result.res.playerId);}
 for(const client of clients)assert((await client.callApi('Ready',{round:1})).isSucc);
 await wait(()=>latest()?.phase==='PLAYING');
 await send(0,7,1,true);const startTick=latest().tick;await wait(()=>latest().tick>=startTick+8);
 evidence.before=latest();
 await clients[0].disconnect();
 const lostTick=latest().tick;await wait(()=>latest().tick>=lostTick+12);
 const paused=latest().players.find(player=>player.id===members[0]);assert(paused);
 const fireCount=events[1].filter(event=>event.type==='fire'&&event.playerId===members[0]).length;
 await wait(()=>latest().tick>=lostTick+22);
 const settled=latest().players.find(player=>player.id===members[0]);assert.equal(settled.x,paused.x);assert.equal(settled.z,paused.z);
 assert.equal(events[1].filter(event=>event.type==='fire'&&event.playerId===members[0]).length,fireCount);
 evidence.disconnected={paused,settled,ticks:22,fireCount};
 const outsider=await clients[2].callApi('ResumeRoom',{roomId,playerId:members[0]});assert(!outsider.isSucc);
 evidence.wrongAccountRejected=outsider.err.code;
 assert((await clients[0].connect()).isSucc);assert((await clients[0].callApi('Account',{token:tokens[0]})).isSucc);
 const wrong=await clients[0].callApi('ResumeRoom',{roomId:'missing',playerId:members[0]});assert(!wrong.isSucc);
 const resumed=await clients[0].callApi('ResumeRoom',{roomId,playerId:members[0]});assert(resumed.isSucc,JSON.stringify(resumed));
 assert.equal(resumed.res.inputSequence,7);assert.equal(resumed.res.snapshot.match.round,1);
 const same=resumed.res.snapshot.players.find(player=>player.id===members[0]);assert.equal(same.hp,settled.hp);assert.equal(same.x,settled.x);assert.equal(same.z,settled.z);assert.deepEqual(same.roleSkillSources,settled.roleSkillSources);
 assert.deepEqual((await clients[0].callApi('OwnedRoles',{})).res,owned);assert.deepEqual((await clients[0].callApi('RoleProfile',{})).res,profile);
 evidence.resumed=resumed.res;
 const resumingTick=latest().tick;await send(0,8,1);await wait(()=>latest().tick>=resumingTick+8);await send(0,9);
 const moved=latest().players.find(player=>player.id===members[0]);assert(Math.hypot(moved.x-same.x,moved.z-same.z)>1);evidence.afterOrdinaryInput=moved;
 const keys=s=>`${s.roomId}/${s.match.round}/${s.phase}/${s.tick}`;
 const remote=new Map(frames[1].map(snapshot=>[keys(snapshot),snapshot]));let common=0;
 for(const snapshot of frames[0]){const peer=remote.get(keys(snapshot));if(peer){assert.deepEqual(snapshot.players,peer.players);common++;}}
 evidence.commonCompletePlayerStates=common;assert(common>10);
 // A separate ordinary participant does not return; the real window must remove it.
 await clients[3].disconnect();const expiryStart=Date.now();await wait(()=>!latest().players.some(player=>player.id===members[3]),ROOM_RECONNECT_WINDOW_MS+10000);
 evidence.expiry={wallMs:Date.now()-expiryStart,remaining:latest().players.map(player=>player.id)};
 assert(evidence.expiry.wallMs>=ROOM_RECONNECT_WINDOW_MS-100);
 assert((await clients[3].connect()).isSucc);assert((await clients[3].callApi('Account',{token:tokens[3]})).isSucc);
 const expired=await clients[3].callApi('ResumeRoom',{roomId,playerId:members[3]});assert(!expired.isSucc);evidence.expiredRejected=expired.err.code;
 evidence.leave=[];
 for(let index=0;index<3;index++){const result=await clients[index].callApi('Leave',{roomId,round:latest().match.round});assert(result.isSucc,JSON.stringify(result));evidence.leave.push(result);}
 const rooms=await clients[0].callApi('ListRooms',{});assert(rooms.isSucc);assert(!rooms.res.rooms.some(room=>room.id===roomId));
 evidence.status='PASS_FIXED_MAP02_SAME_ACCOUNT_RECONNECT_INPUT_RELEASE_EXPIRY_LEAVE';
 console.log('PASS '+output+'.json');
}catch(error){evidence.status='FAIL';evidence.error=String(error);throw error;}
finally{
 for(const client of clients)await client.disconnect();
 if(server.exitCode===null&&server.signalCode===null){const exit=new Promise(resolve=>server.once('exit',resolve));server.kill();await exit;}
 await rm(directory,{recursive:true,force:true});evidence.frames=frames;evidence.events=events;evidence.inputs=inputLog;evidence.cleanup={serverExit:server.exitCode,serverSignal:server.signalCode,tempRemoved:true};
 await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');await writeFile(output+'-server.log',log);
}
