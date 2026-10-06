import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {WsClient} from 'tsrpc';
import {AccountStore} from '../apps/server/src/account-store';
import {serviceProto} from '../apps/shared/protocols/serviceProto';
import type {ReqFriendChat} from '../apps/shared/protocols/PtlFriendChat';
async function main(){
 const directory=mkdtempSync(join(tmpdir(),'cdtank-friend-chat-')),database=join(directory,'accounts.sqlite'),port=3211;
 const store=new AccountStore(database),accounts=[store.open(),store.open(),store.open()];accounts.forEach((a,i)=>store.setDisplayName(a.accountId,['甲','乙','丙'][i]));store.close();
 const server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env:{...process.env,PORT:String(port),ACCOUNT_DB_PATH:database,MATCH_TIME_LIMIT_SECONDS:'3'},stdio:['ignore','pipe','pipe']});let log='';server.stdout.on('data',v=>{log+=String(v);});server.stderr.on('data',v=>{log+=String(v);});
 const clients=Array.from({length:6},()=>new WsClient(serviceProto,{server:`ws://127.0.0.1:${port}`,logger:undefined}));const messages:unknown[][]=clients.map(()=>[]),evidence:unknown[]=[];clients.forEach((c,i)=>c.listenMsg('FriendChat',m=>messages[i].push(m)));
 const counts=()=>messages.map(m=>m.length);async function wait(f:()=>boolean){const deadline=Date.now()+10000;while(!f()&&Date.now()<deadline)await new Promise(r=>setTimeout(r,20));assert(f(),log.slice(-1200));}
 async function settle(){for(const c of clients.filter(c=>c.isConnected))assert((await c.callApi('ListRooms',{})).isSucc);await new Promise(r=>setTimeout(r,40));}
 async function send(index:number,req:ReqFriendChat,targets:number[],recipientCount:number){const before=counts(),result=await clients[index].callApi('FriendChat',req);assert(result.isSucc,JSON.stringify(result));assert.equal(result.res.recipientCount,recipientCount);assert.equal(result.res.message.accountId,accounts[0].accountId);assert.equal(result.res.message.senderName,'甲');assert.equal(result.res.message.text,req.text.trim());await settle();assert.deepEqual(counts(),before.map((n,i)=>n+Number(targets.includes(i))));for(const i of targets)assert.deepEqual(messages[i].at(-1),result.res.message);evidence.push({index,req,response:result.res,targets,before,after:counts()});}
 async function reject(index:number,req:ReqFriendChat,code:string){const before=counts(),result=await clients[index].callApi('FriendChat',req);assert(!result.isSucc&&result.err.code===code,JSON.stringify(result));await settle();assert.deepEqual(counts(),before);evidence.push({index,req,code,before,after:counts()});}
 async function friend(target:number,operation:'ADD'|'REMOVE'='ADD'){assert((await clients[0].callApi('Friends',{operation,targetAccountId:accounts[target].accountId})).isSucc);}
 try{await wait(()=>log.includes(`Server started at ${port}.`));for(const c of clients)assert((await c.connect()).isSucc);for(const [client,account]of [[0,0],[1,1],[2,2],[3,0],[4,1]])assert((await clients[client].callApi('Account',{token:accounts[account].token})).isSucc);
 await reject(5,{text:'身份'},'ACCOUNT_REQUIRED');await reject(0,{text:'无好友'},'FRIEND_CHAT_NO_RECIPIENTS');await friend(1);await send(0,{text:'  好友  '},[0,1,3,4],1);await reject(1,{text:'单向'},'FRIEND_CHAT_NO_RECIPIENTS');
 for(const req of [{text:''},{text:'中'.repeat(73)},{text:'控制\n'},{text:'a',roomId:'R1'},{text:'a',round:1}])await reject(0,req,'FRIEND_CHAT_REJECTED');await send(0,{text:'中'.repeat(72)},[0,1,3,4],1);
 assert((await clients[1].callApi('Blacklist',{operation:'ADD',targetAccountId:accounts[0].accountId})).isSucc);await reject(0,{text:'全屏蔽'},'FRIEND_CHAT_NO_RECIPIENTS');await friend(2);await send(0,{text:'只未屏蔽好友'},[0,2,3],1);assert((await clients[1].callApi('Blacklist',{operation:'REMOVE',targetAccountId:accounts[0].accountId})).isSucc);await send(0,{text:'两个好友'},[0,1,2,3,4],2);
 const room=await clients[0].callApi('CreateRoom',{mode:4,mapId:7,name:'冒名',tankId:1,roomName:'好友甲房'});assert(room.isSucc);const origin={roomId:room.res.room.id,round:1};await reject(0,{text:'缺origin'},'FRIEND_CHAT_IN_ROOM');await reject(0,{text:'过期',...origin,round:2},'ROUND_CONFLICT');await reject(3,{text:'非当前conn',...origin},'NOT_JOINED');await send(0,{text:'WAITING跨大厅',...origin},[0,1,2,3,4],2);
 const other=await clients[1].callApi('CreateRoom',{mode:4,mapId:7,name:'乙',tankId:1,roomName:'好友乙房'});assert(other.isSucc);await send(3,{text:'大厅到不同房间'},[0,1,2,3,4],2);
 const phases:string[]=[];clients[0].listenMsg('RoomSnapshot',s=>phases.push(s.phase));assert((await clients[0].callApi('Cpu',{round:1,operation:'ADD',tankId:1})).isSucc);assert((await clients[0].callApi('Ready',{round:1,isReady:true})).isSucc);await wait(()=>phases.includes('PLAYING'));await send(0,{text:'PLAYING好友',...origin},[0,1,2,3,4],2);await wait(()=>phases.includes('FINISHED'));await send(0,{text:'FINISHED好友',...origin},[0,1,2,3,4],2);assert((await clients[0].callApi('Rematch',{round:1})).isSucc);await reject(0,{text:'旧局',...origin},'ROUND_CONFLICT');await send(0,{text:'再战好友',...origin,round:2},[0,1,2,3,4],2);evidence.push({naturalPhases:phases});
 await friend(2,'REMOVE');await clients[1].disconnect();await clients[4].disconnect();await reject(0,{text:'唯一好友离线',...origin,round:2},'FRIEND_CHAT_NO_RECIPIENTS');
 writeFileSync('recovery/output/friend-chat-network.json',JSON.stringify({status:'PASS',port,evidence},null,2)+'\n');console.log('PASS friend chat authority, unilateral blocked recipients, multi-connections/cross-position, all phases and rematch');
 }finally{await Promise.allSettled(clients.map(c=>c.disconnect()));const end=new Promise<void>(r=>server.once('exit',()=>r()));server.kill();await end;writeFileSync('recovery/output/friend-chat-network.log',log);rmSync(directory,{recursive:true,force:true});}
}main().catch(e=>{console.error(e);process.exitCode=1;});
