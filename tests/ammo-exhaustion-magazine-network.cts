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
 const outputStamp=new Date().toISOString().replace(/[:.]/g,'-');
 const directory=mkdtempSync(join(tmpdir(),'cdtank-ammo-exhaustion-magazine-')),port=3252;
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
 seed.replaceInventory(accounts[0].accountId,[{instanceId:77,itemTableId:2007,ownedQuantity:1,battleQuantity:1,state:0,field8:0,float24Bits:0,float28Bits:0,float2cBits:0}]);
 seed.close();let log='';
 const server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env:{...process.env,PORT:String(port),ACCOUNT_DB_PATH:database,MATCH_TIME_LIMIT_SECONDS:'75'},stdio:['ignore','pipe','pipe']});
 server.stdout.on('data',data=>{log+=String(data);});server.stderr.on('data',data=>{log+=String(data);});
 const clients=accounts.map(()=>new WsClient(serviceProto,{server:`ws://127.0.0.1:${port}`,logger:undefined,heartbeat:{interval:5000,timeout:10000}}));
 const frames:MsgRoomSnapshot[][]=[[],[]],events:MsgRoomEvent[][]=[[],[]];
 clients.forEach((client,index)=>{client.listenMsg('RoomSnapshot',snapshot=>{frames[index].push(snapshot);});client.listenMsg('RoomEvent',event=>{events[index].push(event);});});
 const latest=()=>frames[0].at(-1)!;
 async function wait(check:()=>boolean,timeout=15000){const deadline=Date.now()+timeout;while(!check()&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,20));assert(check(),log.slice(-1500));}
 const evidence:Record<string,unknown>={status:'RUNNING',port,scope:'Actual authenticated API and ordinary PlayerInput; explicit base owned fixtures; no pose/HP/damage/event/result injection',fixture:{base:[...base],equipment:[...equipment],parts:[0,0,0,0,0],tankId:1,petId:1,ammoId:2001,mapId:7}};
 try{
  await wait(()=>log.includes(`Server started at ${port}.`));
  for(let i=0;i<2;i++){assert((await clients[i].connect()).isSucc);assert((await clients[i].callApi('Account',{token:accounts[i].token})).isSucc);}
  assert((await clients[0].callApi('Kitbag',{operation:'ASSIGN',slot:1,instanceId:77})).isSucc);
  const host=await clients[0].callApi('CreateRoom',{mode:4,mapId:7,roomName:'数值验证',name:'Measured',tankId:1});assert(host.isSucc);
  const guest=await clients[1].callApi('Join',{roomId:host.res.room.id,clientId:'ignored',name:'Observer',tankId:1});assert(guest.isSucc);
  for(const client of clients)assert((await client.callApi('Ready',{round:1})).isSucc);
  await wait(()=>latest()?.phase==='PLAYING');const id=host.res.playerId;
  let sequence=0;
  const player=()=>latest().players.find(p=>p.id===id)!;
  const ownEvents=()=>events[0].filter(e=>e.playerId===id);
  const fires=()=>ownEvents().filter(e=>e.type==='fire');
  async function input(fire:boolean,useItem=0){assert((await clients[0].sendMsg('PlayerInput',{sequence:++sequence,move:0,turn:0,aim:0,fire,useItem,clientTime:Date.now()})).isSucc);}
  assert.deepEqual(player().ammoMagazine,{remaining:6,capacity:6});
  await input(true);await wait(()=>fires().length===1);await input(false);await wait(()=>player().ammoMagazine?.remaining===5);evidence.afterOrdinary=player();
  await input(false,2);await wait(()=>player().ammoItemId===2007);await input(true);await wait(()=>ownEvents().some(e=>e.type==='ammoConsumed'&&e.skillId===2007));await wait(()=>fires().length===2);evidence.afterSpecial=player();
  const persisted=new AccountStore(database);const stock=persisted.inventory(accounts[0].accountId).records.find(r=>r.instanceId===77)!;assert.equal(stock.ownedQuantity,0);assert.equal(player().ammoSlots?.find(s=>s.itemTableId===2007)?.quantity,0);evidence.persistedStock=stock;persisted.close();
  await wait(()=>ownEvents().some(e=>e.type==='itemRejected'&&e.skillId===2007),15000);await wait(()=>player().ammoItemId===2001);assert.deepEqual(player().ammoMagazine,{remaining:5,capacity:6});evidence.afterRejection=player();
  const rejectionTick=latest().tick;await wait(()=>latest().tick>=rejectionTick+40);assert.equal(fires().length,2,'Rejected held input must not fire default ammo');assert.deepEqual(player().ammoMagazine,{remaining:5,capacity:6});evidence.heldAfterRejection={ticks:latest().tick-rejectionTick,fireCount:fires().length,player:player()};
  await input(true);await wait(()=>fires().length===3);await input(false);await wait(()=>player().ammoMagazine?.remaining===4);evidence.afterFreshInput=player();
  await wait(()=>frames[1].some(s=>s.tick===latest().tick)||frames[1].at(-1)!.tick>=latest().tick-1);const common=frames[0].filter(a=>a.phase==='PLAYING'&&frames[1].some(b=>b.roomId===a.roomId&&b.tick===a.tick&&b.phase===a.phase));for(const a of common){const b=frames[1].find(b=>b.roomId===a.roomId&&b.tick===a.tick&&b.phase===a.phase)!;assert.deepEqual(a.players,b.players);}assert(common.length>50);evidence.commonTicks=common.length;
  await wait(()=>events[1].filter(e=>e.playerId===id&&['fire','ammoConsumed','itemRejected'].includes(e.type)).length===ownEvents().filter(e=>['fire','ammoConsumed','itemRejected'].includes(e.type)).length);assert.deepEqual(events[1].filter(e=>e.playerId===id&&['fire','ammoConsumed','itemRejected'].includes(e.type)),ownEvents().filter(e=>['fire','ammoConsumed','itemRejected'].includes(e.type)));
  evidence.frames=frames;evidence.events=events;evidence.status='PASS';
  for(const client of clients)assert((await client.callApi('Leave',{roomId:host.res.room.id,round:1})).isSucc);
 }catch(error){evidence.status='FAIL';evidence.error=String(error);evidence.frames=frames;evidence.events=events;throw error;}
 finally{
  for(const client of clients)await client.disconnect();
  if(server.exitCode===null){const ended=new Promise(resolve=>server.once('exit',resolve));server.kill();await ended;}
  rmSync(directory,{recursive:true,force:true});evidence.cleaned=true;
  writeFileSync(`recovery/output/ammo-exhaustion-magazine-network-${outputStamp}.json`,JSON.stringify(evidence,null,2));
  writeFileSync(`recovery/output/ammo-exhaustion-magazine-network-${outputStamp}.log`,log);
 }
 console.log('PASS: special-ammo exhaustion preserves default magazine and rejects held fire');
}

main().catch(error=>{console.error(error);process.exitCode=1;});
