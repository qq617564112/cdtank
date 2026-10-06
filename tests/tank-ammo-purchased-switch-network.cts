import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {WsClient} from 'tsrpc';
import {serviceProto} from '../apps/shared/protocols/serviceProto';
import {AccountStore} from '../apps/server/src/account-store';
import {TANKS} from '../apps/server/src/config';
import {combatSkills, combatItemSkills, combatLimits} from '../apps/server/src/battle/catalog';
import {recomputeRoleAmmo} from '../apps/server/src/battle/roles/recompute-ammo';
import type {MsgRoomSnapshot, MsgRoomEvent} from '../apps/shared/protocols';

async function main(): Promise<void> {
 const outputStamp=new Date().toISOString().replace(/[:.]/g,'-');
 const directory=mkdtempSync(join(tmpdir(),'cdtank-ammo-purchased-switch-')),port=3270;
 const database=join(directory,'accounts.sqlite'); let log='';
 const server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env:{...process.env,PORT:String(port),ACCOUNT_DB_PATH:database,MATCH_TIME_LIMIT_SECONDS:'75'},stdio:['ignore','pipe','pipe']});
 server.stdout.on('data',data=>{log+=String(data);});server.stderr.on('data',data=>{log+=String(data);});
 const clients=[0,1].map(()=>new WsClient(serviceProto,{server:`ws://127.0.0.1:${port}`,logger:undefined,heartbeat:{interval:5000,timeout:10000}}));
 const frames:MsgRoomSnapshot[][]=[[],[]],events:MsgRoomEvent[][]=[[],[]],received:{page:number;tick:number;serverTime:number;wallTime:number}[]=[];
 clients.forEach((client,index)=>{client.listenMsg('RoomSnapshot',snapshot=>{frames[index].push(snapshot);received.push({page:index,tick:snapshot.tick,serverTime:snapshot.serverTime,wallTime:Date.now()});});client.listenMsg('RoomEvent',event=>{events[index].push(event);});});
 const latest=()=>frames[0].at(-1)!;
 async function wait(check:()=>boolean,timeout=15000){const deadline=Date.now()+timeout;while(!check()&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,20));assert(check(),log.slice(-1500));}
 const evidence:Record<string,unknown>={status:'RUNNING',port,scope:'Fresh Account API, empty ownership/inventory, explicit funds-only profile fixture; TankShop BUY tank3/SelectRole, no pet ownership; Shop BUY2007 then Kitbag, ordinary PlayerInput partial default magazine/special exhaustion/default return and dual sync; no active state injection',startingProfileFixture:{money:100000,moneyOffset:0x70,otherBytes:0,strings:['',''],originalInitialValuesConfirmed:false}};
 try{
  await wait(()=>log.includes(`Server started at ${port}.`));
  const accounts=[];
  for(const client of clients){
   assert((await client.connect()).isSucc);const account=await client.callApi('Account',{});assert(account.isSucc);accounts.push(account.res);
   const owned=await client.callApi('OwnedRoles',{});assert(owned.isSucc);assert.deepEqual(owned.res,{base:[],equipment:[]});
   const stock=await client.callApi('Inventory',{});assert(stock.isSucc);assert.deepEqual(stock.res.records,[]);
  }
  const funds=new AccountStore(database);
  try{const bytes=new Uint8Array(0x170);new DataView(bytes.buffer).setUint32(0x70,100000,true);funds.replaceRoleProfile(accounts[0].accountId,{bytes,strings:['','']});}finally{funds.close();}
  const tankBuy=await clients[0].callApi('TankShop',{operation:'BUY',tankId:3,currency:'MONEY',requestId:'switch_tank3_buy'});assert(tankBuy.isSucc);
  const tankFields=new Map(tankBuy.res.purchased!.fields);assert((await clients[0].callApi('SelectRole',{kind:'tank',instanceId:tankFields.get(0x1c)!})).isSucc);evidence.tankPurchase=tankBuy.res;
  const expected=(itemId:number)=>recomputeRoleAmmo({tank:TANKS.find(t=>t.id===3)!.recomputeBase,sources:{currentSkillIds:combatItemSkills.get(itemId)!.skillIds,extraSkill:{baseId:0,rank:0},itemIds:[0x58,0x5c,0x60].map(o=>tankFields.get(o)!)},skills:combatSkills,items:combatItemSkills,limits:combatLimits,roleValue9:0})!;
  const ordinary=expected(2001),special=expected(2007);evidence.expected={ordinary,special};
  const paid=await clients[0].callApi('Shop',{operation:'BUY',itemTableId:2007,quantity:1,currency:'MONEY',requestId:'partial_magazine_2007_buy'});assert(paid.isSucc);assert.equal(paid.res.money,97490);assert.equal(paid.res.purchased!.ownedQuantity,1);
  const instanceId=paid.res.purchased!.instanceId;evidence.purchase=paid.res;
  assert((await clients[0].callApi('Kitbag',{operation:'ASSIGN',slot:1,instanceId})).isSucc);
  const host=await clients[0].callApi('CreateRoom',{mode:4,mapId:7,roomName:'数值验证',name:'Measured',tankId:1});assert(host.isSucc);
  const guest=await clients[1].callApi('Join',{roomId:host.res.room.id,clientId:'ignored',name:'Observer',tankId:1});assert(guest.isSucc);
  for(const client of clients)assert((await client.callApi('Ready',{round:1})).isSucc);
  await wait(()=>latest()?.phase==='PLAYING');const id=host.res.playerId;
  let sequence=0;
  const player=()=>latest().players.find(p=>p.id===id)!;
  const ownEvents=()=>events[0].filter(e=>e.playerId===id);
  const fires=()=>ownEvents().filter(e=>e.type==='fire');
  async function input(fire:boolean,useItem=0){assert((await clients[0].sendMsg('PlayerInput',{sequence:++sequence,move:0,turn:0,aim:0,fire,useItem,clientTime:Date.now()})).isSucc);}
  assert.equal(player().tankId,3);assert.equal(player().petId,undefined);assert.deepEqual(player().ammoMagazine,{remaining:ordinary.capacity,capacity:ordinary.capacity});
  await input(true);await wait(()=>fires().length===1);await input(false);await wait(()=>player().ammoMagazine?.remaining===ordinary.capacity-1);evidence.afterOrdinary={player:player(),tick:latest().tick,serverTime:latest().serverTime,wallTime:Date.now()};
  await input(false,2);await wait(()=>player().ammoItemId===2007);await input(true);await wait(()=>ownEvents().some(e=>e.type==='ammoConsumed'&&e.skillId===2007));await wait(()=>fires().length===2);evidence.afterSpecial={player:player(),tick:latest().tick,serverTime:latest().serverTime,wallTime:Date.now()};assert.equal(player().reload!.duration,special.lastBulletSeconds);
  const persisted=new AccountStore(database);const stock=persisted.inventory(accounts[0].accountId).records.find(r=>r.instanceId===instanceId)!;assert.equal(stock.ownedQuantity,0);assert.equal(player().ammoSlots?.find(s=>s.itemTableId===2007)?.quantity,0);evidence.persistedStock=stock;persisted.close();
  await wait(()=>ownEvents().some(e=>e.type==='itemRejected'&&e.skillId===2007),15000);await wait(()=>player().ammoItemId===2001);assert.deepEqual(player().ammoMagazine,{remaining:ordinary.capacity-1,capacity:ordinary.capacity});evidence.afterRejection={player:player(),tick:latest().tick,serverTime:latest().serverTime,wallTime:Date.now()};
  const rejectionTick=latest().tick;await wait(()=>latest().tick>=rejectionTick+40);assert.equal(fires().length,2,'Rejected held input must not fire default ammo');assert.deepEqual(player().ammoMagazine,{remaining:ordinary.capacity-1,capacity:ordinary.capacity});evidence.heldAfterRejection={ticks:latest().tick-rejectionTick,fireCount:fires().length,player:player()};
  await input(true);await wait(()=>fires().length===3);await input(false);await wait(()=>player().ammoMagazine?.remaining===ordinary.capacity-2);evidence.afterFreshInput={player:player(),tick:latest().tick,serverTime:latest().serverTime,wallTime:Date.now()};
  await wait(()=>frames[1].some(s=>s.tick===latest().tick)||frames[1].at(-1)!.tick>=latest().tick-1);const common=frames[0].filter(a=>a.phase==='PLAYING'&&frames[1].some(b=>b.roomId===a.roomId&&b.tick===a.tick&&b.phase===a.phase));for(const a of common){const b=frames[1].find(b=>b.roomId===a.roomId&&b.tick===a.tick&&b.phase===a.phase)!;assert.deepEqual(a.players,b.players);}assert(common.length>50);evidence.commonTicks=common.length;
  await wait(()=>events[1].filter(e=>e.playerId===id&&['fire','ammoConsumed','itemRejected'].includes(e.type)).length===ownEvents().filter(e=>['fire','ammoConsumed','itemRejected'].includes(e.type)).length);assert.deepEqual(events[1].filter(e=>e.playerId===id&&['fire','ammoConsumed','itemRejected'].includes(e.type)),ownEvents().filter(e=>['fire','ammoConsumed','itemRejected'].includes(e.type)));
  evidence.frames=frames;evidence.events=events;evidence.received=received;evidence.simulationTickSeconds=.05;evidence.status='PASS';
  for(const client of clients)assert((await client.callApi('Leave',{roomId:host.res.room.id,round:1})).isSucc);
 }catch(error){evidence.status='FAIL';evidence.error=String(error);evidence.frames=frames;evidence.events=events;evidence.received=received;evidence.simulationTickSeconds=.05;throw error;}
 finally{
  for(const client of clients)await client.disconnect();
  if(server.exitCode===null){const ended=new Promise(resolve=>server.once('exit',resolve));server.kill();await ended;}
  rmSync(directory,{recursive:true,force:true});evidence.cleaned=true;
  writeFileSync(`recovery/output/tank-ammo-purchased-switch-network-${outputStamp}.json`,JSON.stringify(evidence,null,2));
  writeFileSync(`recovery/output/tank-ammo-purchased-switch-network-${outputStamp}.log`,log);
 }
 console.log('PASS: actual tank3/BUY2007 without pet from initially empty ownership, partial default magazine preserved on exhaustion, held fire rejected, fresh input consumes and dual sync');
}

main().catch(error=>{console.error(error);process.exitCode=1;});
