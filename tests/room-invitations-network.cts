import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {WsClient} from 'tsrpc';
import {serviceProto} from '../apps/shared/protocols/serviceProto';
import type {MsgRoomInvitation} from '../apps/shared/protocols/MsgRoomInvitation';
async function main() {
 const directory=mkdtempSync(join(tmpdir(),'cdtank-invite-'));
 const server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env:{...process.env,PORT:'3197',ACCOUNT_DB_PATH:join(directory,'accounts.sqlite')},stdio:['ignore','pipe','pipe']});
 let log='';server.stdout.on('data',data=>{log+=data;});server.stderr.on('data',data=>{log+=data;});
 const clients=[0,1,2,3].map(()=>new WsClient(serviceProto,{server:'ws://127.0.0.1:3197',logger:undefined,heartbeat:{interval:5000,timeout:10000}}));
 const received: MsgRoomInvitation[][]=clients.map(()=>[]);
 clients.forEach((client,i)=>client.listenMsg('RoomInvitation',message=>{received[i].push(message);}));
 const wait=async (check:()=>boolean)=>{const deadline=Date.now()+15000;while(!check()&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,20));assert(check(),log.slice(-1500));};
 try {
  await wait(()=>log.includes('Server started at 3197.'));
  for(let i=0;i<4;i++){assert((await clients[i].connect()).isSucc);if(i<3)assert((await clients[i].callApi('Account',{})).isSucc);}
  const owner=await clients[0].callApi('CreateRoom',{mode:1,mapId:7,roomName:'招募房',name:'Owner',tankId:1,password:'secret',minPlayers:2,maxPlayers:3});assert(owner.isSucc);
  const roomId=owner.res.room.id,round=owner.res.room.round;assert(round!==undefined);
  assert((await clients[2].callApi('CreateRoom',{mode:1,mapId:7,roomName:'隔离房',name:'Other',tankId:1})).isSucc);
  const invalid=await clients[0].callApi('RoomInvite',{roomId,round:0});assert(!invalid.isSucc&&invalid.err.code==='INVITE_REJECTED');
  assert(!(await clients[1].callApi('RoomInvite',{roomId,round})).isSucc);
  const sent=await clients[0].callApi('RoomInvite',{roomId,round});assert(sent.isSucc);assert.equal(sent.res.recipientCount,1);
  await wait(()=>received[1].length===1);assert.deepEqual(received.map(x=>x.length),[0,1,0,0]);
  assert.equal(received[1][0].invitationId,sent.res.invitationId);assert.equal(received[1][0].room.id,roomId);assert.equal(received[1][0].room.hasPassword,true);
  assert(!JSON.stringify(received[1][0]).includes('secret'));assert(sent.res.expiresAt>Date.now());
  const duplicate=await clients[0].callApi('RoomInvite',{roomId,round});assert(!duplicate.isSucc&&duplicate.err.code==='INVITE_COOLDOWN');
  const wrong=await clients[1].callApi('Join',{roomId,clientId:'',name:'Guest',tankId:1,password:'wrong'});assert(!wrong.isSucc);
  const guest=await clients[1].callApi('Join',{roomId,clientId:'',name:'Guest',tankId:1,password:'secret'});assert(guest.isSucc);
  assert((await clients[0].callApi('Cpu',{round,operation:'ADD',tankId:1})).isSucc);
  const full=await clients[0].callApi('RoomInvite',{roomId,round});assert(!full.isSucc&&full.err.code==='INVITE_REJECTED');
  assert((await clients[1].callApi('Leave',{roomId,round})).isSucc);
  assert((await clients[0].callApi('Leave',{roomId,round})).isSucc);
  const stale=await clients[1].callApi('Join',{roomId,clientId:'',name:'Guest',tankId:1,password:'secret'});assert(!stale.isSucc);
  await clients[0].disconnect();
  const alone=await clients[1].callApi('CreateRoom',{mode:1,mapId:7,roomName:'无大厅玩家',name:'Guest',tankId:1});assert(alone.isSucc);
  const empty=await clients[1].callApi('RoomInvite',{roomId:alone.res.room.id,round:alone.res.room.round!});assert(!empty.isSucc&&empty.err.code==='INVITE_EMPTY');
  writeFileSync('recovery/output/room-invitations-network.json',JSON.stringify({status:'PASS',checks:['old round/not joined rejection','authenticated lobby only','other room and unauthenticated exclusion','secret omitted','duplicate cooldown','wrong/right password Join','full room rejection','stale invitation Join refuses','no recipient refusal'],notification:received[1][0]},null,2));console.log('PASS room invitations network');
 } finally {
  await Promise.all(clients.map(client=>client.disconnect()));if(server.exitCode===null&&server.signalCode===null){const ended=new Promise(resolve=>server.once('exit',resolve));server.kill();await ended;}
  writeFileSync('recovery/output/room-invitations-network.log',log);rmSync(directory,{recursive:true,force:true});
 }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
