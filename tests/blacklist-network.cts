import assert from 'node:assert/strict';
import {spawn, type ChildProcess} from 'node:child_process';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {WsClient} from 'tsrpc';
import {AccountStore} from '../apps/server/src/account-store';
import {serviceProto} from '../apps/shared/protocols/serviceProto';
import type {ReqBlacklist} from '../apps/shared/protocols/PtlBlacklist';
async function main(): Promise<void> {
 const directory=mkdtempSync(join(tmpdir(),'cdtank-blacklist-')),database=join(directory,'accounts.sqlite'),port=3209;
 const store=new AccountStore(database),accounts=[store.open(),store.open(),store.open()];
 accounts.forEach((a,i)=>store.setDisplayName(a.accountId,['甲','乙','丙'][i]));
 const profile={bytes:new Uint8Array(0x170).fill(23),strings:['资料甲','不变'] as [string,string]};
 store.replaceRoleProfile(accounts[2].accountId,profile);store.friends(accounts[0].accountId,{operation:'ADD',targetAccountId:accounts[1].accountId});store.close();
 const clients=Array.from({length:5},()=>new WsClient(serviceProto,{server:`ws://127.0.0.1:${port}`,logger:undefined}));
 const messages:unknown[][]=clients.map(()=>[]),evidence:unknown[]=[];let server:ChildProcess|undefined,log='';
 clients.forEach((c,i)=>{c.listenMsg('LobbyWhisper',m=>messages[i].push(m));c.listenMsg('RoomWhisper',m=>messages[i].push(m));});
 const counts=()=>messages.map(m=>m.length);
 async function wait(check:()=>boolean):Promise<void>{const deadline=Date.now()+10000;while(!check()&&Date.now()<deadline)await new Promise(r=>setTimeout(r,20));assert(check(),log.slice(-1200));}
 async function start():Promise<void>{const offset=log.length;server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env:{...process.env,PORT:String(port),ACCOUNT_DB_PATH:database,MATCH_TIME_LIMIT_SECONDS:'3'},stdio:['ignore','pipe','pipe']});server.stdout!.on('data',v=>{log+=String(v);});server.stderr!.on('data',v=>{log+=String(v);});await wait(()=>log.slice(offset).includes(`Server started at ${port}.`));}
 async function stop():Promise<void>{await Promise.allSettled(clients.map(c=>c.disconnect()));if(server&&server.exitCode===null){const end=new Promise<void>(r=>server!.once('exit',()=>r()));server.kill();await end;}}
 async function auth(client:number,account:number):Promise<void>{assert((await clients[client].connect()).isSucc);assert((await clients[client].callApi('Account',{token:accounts[account].token})).isSucc);}
 async function block(client:number,operation:'QUERY'|'ADD'|'REMOVE',target=0){const req:ReqBlacklist=operation==='QUERY'?{operation}:{operation,targetAccountId:accounts[target].accountId};const result=await clients[client].callApi('Blacklist',req);assert(result.isSucc,JSON.stringify(result));evidence.push({client,req,response:result.res});return result.res.blocked;}
 async function rejected(client:number,req:ReqBlacklist,code:string){const result=await clients[client].callApi('Blacklist',req);assert(!result.isSucc&&result.err.code===code,JSON.stringify(result));evidence.push({client,req,code});}
 async function whisper(client:number,target:number,blocked:boolean,room?:{id:string;round:number}){
  const before=counts(),text=`消息${evidence.length}`;
  const result=room?await clients[client].callApi('RoomWhisper',{roomId:room.id,round:room.round,targetName:['甲','乙','丙'][target],text}):await clients[client].callApi('LobbyWhisper',{targetAccountId:accounts[target].accountId,text});
  if(blocked)assert(!result.isSucc&&result.err.code==='WHISPER_BLOCKED',JSON.stringify(result));else assert(result.isSucc,JSON.stringify(result));
  for(const c of clients.filter(c=>c.isConnected))assert((await c.callApi('ListRooms',{})).isSucc);
  await new Promise(r=>setTimeout(r,40));
  if(blocked)assert.deepEqual(counts(),before);else assert(counts().reduce((n,c,i)=>n+c-before[i],0)>0);
  evidence.push({client,target,api:room?'RoomWhisper':'LobbyWhisper',blocked,before,after:counts()});
 }
 try{
  await start();await auth(0,0);await auth(1,1);await auth(2,2);await auth(3,0);assert((await clients[4].connect()).isSucc);
  await rejected(4,{operation:'QUERY'},'ACCOUNT_REQUIRED');await rejected(0,{operation:'ADD',targetAccountId:accounts[0].accountId},'BLACKLIST_SELF');await rejected(0,{operation:'REMOVE',targetAccountId:accounts[0].accountId},'BLACKLIST_SELF');await rejected(0,{operation:'ADD',targetAccountId:'absent'},'BLACKLIST_TARGET_NOT_FOUND');
  await whisper(0,1,false);await block(1,'ADD',0);assert.equal((await block(1,'ADD',0)).length,1);assert.deepEqual(await block(0,'QUERY'),[]);assert.deepEqual(await block(2,'QUERY'),[]);
  await whisper(0,1,true);await whisper(3,1,true);await whisper(1,0,false);await whisper(2,1,false);
  await block(0,'ADD',1);await whisper(1,0,true);await block(0,'REMOVE',1);
  assert.deepEqual(await block(2,'REMOVE',0),[]);await whisper(0,1,true);
  const roomA=await clients[0].callApi('CreateRoom',{mode:4,mapId:7,name:'甲',tankId:1,roomName:'屏蔽房甲'});assert(roomA.isSucc,JSON.stringify(roomA));
  await whisper(0,1,true,{id:roomA.res.room.id,round:1});await whisper(0,2,false,{id:roomA.res.room.id,round:1});
  const roomB=await clients[1].callApi('CreateRoom',{mode:4,mapId:7,name:'乙',tankId:1,roomName:'屏蔽房乙'});assert(roomB.isSucc,JSON.stringify(roomB));
  await whisper(0,1,true,{id:roomA.res.room.id,round:1});await whisper(1,0,false,{id:roomB.res.room.id,round:1});
  const phases:string[]=[];clients[0].listenMsg('RoomSnapshot',snapshot=>{phases.push(snapshot.phase);});
  assert((await clients[0].callApi('Cpu',{round:1,operation:'ADD',tankId:1})).isSucc);
  assert((await clients[0].callApi('Ready',{round:1,isReady:true})).isSucc);await wait(()=>phases.includes('PLAYING'));
  await whisper(0,1,true,{id:roomA.res.room.id,round:1});await wait(()=>phases.includes('FINISHED'));
  await whisper(0,1,true,{id:roomA.res.room.id,round:1});evidence.push({naturalPhases:phases});
  await block(1,'REMOVE',0);assert.deepEqual(await block(1,'REMOVE',0),[]);await whisper(0,1,false,{id:roomA.res.room.id,round:1});
  await block(1,'ADD',0);await stop();await start();await auth(1,1);
  assert.deepEqual(await block(1,'QUERY'),[{accountId:accounts[0].accountId,name:'甲',online:false,inRoom:false}]);
  await auth(0,0);await whisper(0,1,true);await block(1,'REMOVE',0);await whisper(0,1,false);await clients[0].disconnect();assert.equal((await block(1,'ADD',0)).length,1);
  await stop();const restored=new AccountStore(database);assert(restored.isBlocked(accounts[1].accountId,accounts[0].accountId));assert(!restored.isBlocked(accounts[0].accountId,accounts[1].accountId));assert.deepEqual(restored.roleProfile(accounts[2].accountId),profile);assert.deepEqual(restored.friends(accounts[0].accountId,{operation:'QUERY'}),[accounts[1].accountId]);restored.close();
  writeFileSync('recovery/output/blacklist-network.json',JSON.stringify({status:'PASS',port,actualServerRestart:true,profileUnchanged:true,friendsUnchanged:true,evidence},null,2)+'\n');console.log('PASS blacklist authority, multi-connection whisper direction/room rejection, unblock, SQLite restart and unchanged friends/profile');
 }finally{await stop();writeFileSync('recovery/output/blacklist-network.log',log);rmSync(directory,{recursive:true,force:true});}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
