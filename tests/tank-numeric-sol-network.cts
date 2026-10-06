import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {WsClient} from 'tsrpc';
import {serviceProto} from '../apps/shared/protocols/serviceProto';
import {AccountStore} from '../apps/server/src/account-store';
import type {MsgRoomSnapshot, MsgRoomEvent} from '../apps/shared/protocols';

async function main(): Promise<void> {
 const directory=mkdtempSync(join(tmpdir(),'cdtank-tank-numeric-sol-')),port=3417;
 const database=join(directory,'accounts.sqlite'),seed=new AccountStore(database);
 const template=JSON.parse(readFileSync('recovery/output/world-role-attributes-native.json','utf8')).rows
  .find((row:{tankId:number;part:number})=>row.tankId===1&&row.part===0);
 const base=new Map<number,number>(Object.keys(template.base).map(key=>[Number(key),0]));
 const equipment=new Map<number,number>(Object.keys(template.equipment).map(key=>[Number(key),0]));
 base.set(0,73);base.set(8,1);base.set(0x2c,600);base.set(0x34,5);base.set(0x3c,10);
 equipment.set(0x1c,74);equipment.set(0x24,1);equipment.set(0x3c,100);equipment.set(0x40,70);
 equipment.set(0x4c,15);equipment.set(0x50,30);equipment.set(0x58,2001);
 const accounts=[seed.open(),seed.open()];
 for(const account of accounts){
  seed.replaceRoleRecords(account.accountId,{base:[{name:'Explicit base pet1 fixture',fields:base}],equipment:[{name:'Explicit base tank1 fixture',fields:equipment}]});
  const bytes=new Uint8Array(0x170),view=new DataView(bytes.buffer);view.setUint32(0xa4,73,true);view.setUint32(0xa8,74,true);
  seed.replaceRoleProfile(account.accountId,{bytes,strings:['','']});
 }
 seed.close();let log='';
 const server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env:{...process.env,PORT:String(port),ACCOUNT_DB_PATH:database,MATCH_TIME_LIMIT_SECONDS:'75'},stdio:['ignore','pipe','pipe']});
 server.stdout.on('data',data=>{log+=String(data);});server.stderr.on('data',data=>{log+=String(data);});
 const clients=accounts.map(()=>new WsClient(serviceProto,{server:`ws://127.0.0.1:${port}`,logger:undefined}));
 const frames:MsgRoomSnapshot[][]=[[],[]],events:MsgRoomEvent[][]=[[],[]];
 clients.forEach((client,index)=>{client.listenMsg('RoomSnapshot',snapshot=>{frames[index].push(snapshot);});client.listenMsg('RoomEvent',event=>{events[index].push(event);});});
 const latest=()=>frames[0].at(-1)!;
 async function wait(check:()=>boolean,timeout=15000){const deadline=Date.now()+timeout;while(!check()&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,20));assert(check(),log.slice(-1500));}
 const evidence:Record<string,unknown>={status:'RUNNING',port,scope:'Actual authenticated API and ordinary PlayerInput; explicit base owned fixtures; no pose/HP/damage/event/result injection',fixture:{base:[...base],equipment:[...equipment],parts:[0,0,0,0,0],tankId:1,petId:1,ammoId:2001,mapId:7}};
 try{
  await wait(()=>log.includes(`Server started at ${port}.`));
  for(let i=0;i<2;i++){assert((await clients[i].connect()).isSucc);assert((await clients[i].callApi('Account',{token:accounts[i].token})).isSucc);}
  const host=await clients[0].callApi('CreateRoom',{mode:4,mapId:7,roomName:'数值验证',name:'Measured',tankId:1});assert(host.isSucc);
  const guest=await clients[1].callApi('Join',{roomId:host.res.room.id,clientId:'ignored',name:'Observer',tankId:1});assert(guest.isSucc);
  for(const client of clients)assert((await client.callApi('Ready',{round:1})).isSucc);
  await wait(()=>latest()?.phase==='PLAYING');const id=host.res.playerId;
  let sequence=0;
  async function segment(name:string,input:{move:number;turn:number;aim:number;fire:boolean},ticks:number){
   const start=frames[0].length;
   assert((await clients[0].sendMsg('PlayerInput',{sequence:++sequence,...input,useItem:0,clientTime:Date.now()})).isSucc);
   await wait(()=>frames[0].length>=start+ticks);
   const samples=frames[0].slice(start,start+ticks);return {name,input,samples};
  }
  const segments=[];
  segments.push(await segment('forward',{move:1,turn:0,aim:0,fire:false},18));
  segments.push(await segment('stop',{move:0,turn:0,aim:0,fire:false},8));
  segments.push(await segment('reverse',{move:-1,turn:0,aim:0,fire:false},18));
  segments.push(await segment('bodyTurn',{move:0,turn:1,aim:0,fire:false},18));
  segments.push(await segment('turretAim',{move:0,turn:0,aim:1,fire:false},18));
  segments.push(await segment('continuousFire',{move:0,turn:0,aim:0,fire:true},90));
  await segment('stopFire',{move:0,turn:0,aim:0,fire:false},4);
  const measured=segments.map(segment=>{
   const values=segment.samples.map(s=>({tick:s.tick,...s.players.find(p=>p.id===id)!}));
   return {...segment,samples:undefined,values,steps:values.slice(1).map((v,i)=>({ticks:v.tick-values[i].tick,distance:Math.hypot(v.x-values[i].x,v.z-values[i].z),yaw:v.yaw-values[i].yaw,aim:v.aim-values[i].aim}))};
  });
  assert(measured[0].steps.some(step=>step.distance>0),'Ordinary forward must move');
  assert(measured[2].steps.some(step=>step.distance>0),'Ordinary reverse must move');
  assert(measured[3].steps.some(step=>Math.abs(step.yaw)>0),'Ordinary turn must rotate');
  assert(measured[4].steps.some(step=>Math.abs(step.aim)>0),'Ordinary aim must rotate');
  const fires=events[0].filter(e=>e.type==='fire'&&e.playerId===id);assert(fires.length>=3);
  const reload=latest().players.find(p=>p.id===id)!.reload!;assert.equal(reload.source,'original-normal');
  const fireClocks=frames[0].map(s=>({tick:s.tick,startedAt:s.players.find(p=>p.id===id)?.reload?.startedAt??0}))
   .filter((v,i,a)=>v.startedAt>0&&(i===0||v.startedAt!==a[i-1].startedAt));
  const intervals=fireClocks.slice(1).map((v,i)=>(v.startedAt-fireClocks[i].startedAt)/1000);
  for(const interval of intervals){assert(interval+1e-6>=reload.duration);assert(interval<=reload.duration+.051);}
  const bullets=frames[0].flatMap(s=>s.bullets.filter(b=>b.ownerId===id).map(b=>({tick:s.tick,...b})));
  assert(bullets.length>1);for(const bullet of bullets)assert(Math.abs(Math.hypot(bullet.vx,bullet.vy,bullet.vz)-360)<.02);
  evidence.manual={initial:segments[0].samples[0],measured,fires,fireClocks,intervals,reload,bullets};
  // Two account-owned roles now fight through the same ordinary AI input gate.
  for(const client of clients)assert((await client.callApi('Autopilot',{round:1,enabled:true})).isSucc);
  await wait(()=>events[0].some(e=>e.type==='hit'&&(e.playerId===id||e.targetId===id)),60000);
  const hit=events[0].find(e=>e.type==='hit'&&(e.playerId===id||e.targetId===id))!;
  await wait(()=>events[1].some(e=>e.type==='hit'&&e.playerId===hit.playerId&&e.targetId===hit.targetId&&e.value===hit.value));
  const common=frames[0].filter(s=>frames[1].some(t=>t.tick===s.tick));assert(common.length>50);
  for(const a of common){const b=frames[1].find(s=>s.tick===a.tick)!;assert.deepEqual(a.players,b.players);assert.deepEqual(a.bullets,b.bullets);}
  assert.deepEqual(events[0],events[1]);evidence.autonomous={hit,observedHp:latest().players.map(p=>({id:p.id,hp:p.hp,maxHp:p.maxHp})),commonTicks:common.length};
  evidence.frames=frames;evidence.events=events;evidence.status='PASS';
  for(const client of clients)assert((await client.callApi('Leave',{roomId:host.res.room.id,round:1})).isSucc);
 }catch(error){evidence.status='FAIL';evidence.error=String(error);evidence.frames=frames;evidence.events=events;throw error;}
 finally{
  for(const client of clients)await client.disconnect();
  if(server.exitCode===null){const ended=new Promise(resolve=>server.once('exit',resolve));server.kill();await ended;}
  rmSync(directory,{recursive:true,force:true});evidence.cleaned=true;
  writeFileSync('recovery/output/tank-numeric-sol-network.json',JSON.stringify(evidence,null,2));
  writeFileSync('recovery/output/tank-numeric-sol-server.log',log);
 }
 console.log('PASS: tank1/base part0/default2001/map7 ordinary distance/turn/reload/bullet/HP and dual network synchronization');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
