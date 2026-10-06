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
 const directory=mkdtempSync(join(tmpdir(),'cdtank-purchased-part-ammo-')),port=3285;
 const database=join(directory,'accounts.sqlite'); let log='';
 const server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env:{...process.env,PORT:String(port),ACCOUNT_DB_PATH:database,MATCH_TIME_LIMIT_SECONDS:'75'},stdio:['ignore','pipe','pipe']});
 server.stdout.on('data',data=>{log+=String(data);});server.stderr.on('data',data=>{log+=String(data);});
 const clients=[0,1].map(()=>new WsClient(serviceProto,{server:`ws://127.0.0.1:${port}`,logger:undefined,heartbeat:{interval:5000,timeout:10000}}));
 const frames:MsgRoomSnapshot[][]=[[],[]],events:MsgRoomEvent[][]=[[],[]],received:{page:number;tick:number;serverTime:number;wallTime:number}[]=[];
 clients.forEach((client,index)=>{client.listenMsg('RoomSnapshot',snapshot=>{frames[index].push(snapshot);received.push({page:index,tick:snapshot.tick,serverTime:snapshot.serverTime,wallTime:Date.now()});});client.listenMsg('RoomEvent',event=>{events[index].push(event);});});
 const latest=()=>frames[0].at(-1)!;
 async function wait(check:()=>boolean,timeout=15000){const deadline=Date.now()+timeout;while(!check()&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,20));assert(check(),log.slice(-1500));}
 const evidence:Record<string,unknown>={status:'RUNNING',port,scope:'Actual funds-only empty Account BUY tank3/15001 and Equipment PART0; no pet required; ordinary held fire consumes complete normal magazine, installed Delay−2 affects intervals/last reload/refill, dual snapshots. Ownership initialization and acquisition rules reconstructed; no active injection.',startingProfileFixture:{money:100000,moneyOffset:0x70,otherBytes:0,strings:['',''],originalInitialValuesConfirmed:false}};
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
  const tankBuy=await clients[0].callApi('TankShop',{operation:'BUY',tankId:3,currency:'MONEY',requestId:'part_ammo_tank3_buy'});assert(tankBuy.isSucc);
  const tankFields=new Map(tankBuy.res.purchased!.fields);assert((await clients[0].callApi('SelectRole',{kind:'tank',instanceId:tankFields.get(0x1c)!})).isSucc);evidence.tankPurchase=tankBuy.res;
  assert.equal(tankFields.get(0x6c),2);
  const paid=await clients[0].callApi('Shop',{operation:'BUY',itemTableId:15001,quantity:1,currency:'MONEY',requestId:'part_ammo_delay_buy'});assert(paid.isSucc);assert.equal(paid.res.money,97000);assert.equal(paid.res.purchased!.ownedQuantity,1);
  const instanceId=paid.res.purchased!.instanceId;evidence.purchase=paid.res;
  const equipped=await clients[0].callApi('Equipment',{operation:'EQUIP',target:'PART',slot:0,instanceId});evidence.equipment=equipped;assert(equipped.isSucc);assert.equal(equipped.res.slots[0],instanceId);
  const inventory=await clients[0].callApi('Inventory',{});assert(inventory.isSucc);assert.equal(inventory.res.records.find(row=>row.instanceId===instanceId)!.state,2);evidence.inventory=inventory.res;
  const ordinary=recomputeRoleAmmo({tank:TANKS.find(t=>t.id===3)!.recomputeBase,sources:{currentSkillIds:combatItemSkills.get(2001)!.skillIds,extraSkill:{baseId:0,rank:0},itemIds:[0x58,0x5c,0x60].map(o=>tankFields.get(o)!).concat([15001,0,0,0,0,0,0])},skills:combatSkills,items:combatItemSkills,limits:combatLimits,roleValue9:0})!;
  assert(ordinary.selectedSkillIds.includes(13081));evidence.expected=ordinary;
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
  await input(true);await wait(()=>fires().length>=ordinary.capacity+1,30000);await input(false);
  await wait(()=>player().ammoMagazine?.remaining===ordinary.capacity-1);
  const changes:{tick:number;serverTime:number;remaining:number;reloadDuration:number|undefined}[]=[];
  let previous=ordinary.capacity;
  for(const snapshot of frames[0].filter(s=>s.phase==='PLAYING')){
   const measured=snapshot.players.find(p=>p.id===id)!;
   const remaining=measured.ammoMagazine!.remaining;
   if(remaining!==previous){changes.push({tick:snapshot.tick,serverTime:snapshot.serverTime,remaining,reloadDuration:measured.reload?.duration});previous=remaining;}
  }
  const consumed=changes.filter(row=>row.remaining<ordinary.capacity);
  const firstMagazine=consumed.slice(0,ordinary.capacity);
  assert.deepEqual(firstMagazine.map(row=>row.remaining),Array.from({length:ordinary.capacity},(_,i)=>ordinary.capacity-i-1));
  const gaps=firstMagazine.slice(1).map((row,i)=>({simulatedSeconds:(row.tick-firstMagazine[i].tick)*.05,serverSeconds:(row.serverTime-firstMagazine[i].serverTime)/1000}));
  for(const gap of gaps){assert(gap.simulatedSeconds>=ordinary.normalSeconds-.06&&gap.simulatedSeconds<=ordinary.normalSeconds+.12,'Installed Delay ordinary interval');}
  for(const row of firstMagazine){assert.equal(row.reloadDuration,row.remaining===0?ordinary.lastBulletSeconds:ordinary.normalSeconds);}
  const empty=firstMagazine.at(-1)!,refill=changes.find(row=>row.remaining>0&&row.tick>empty.tick)!;assert(refill,'Ordinary refill with held fire');
  assert([ordinary.capacity,ordinary.capacity-1].includes(refill.remaining));
  const refillGap={simulationSeconds:(refill.tick-empty.tick)*.05,serverSeconds:(refill.serverTime-empty.serverTime)/1000};
  assert(refillGap.simulationSeconds>=ordinary.lastBulletSeconds-.06&&refillGap.simulationSeconds<=ordinary.lastBulletSeconds+.12,'Installed Delay last-round refill');
  assert.equal(fires().length,ordinary.capacity+1);evidence.changes=changes;evidence.intervals=gaps;evidence.refill={...refillGap,publishedRemaining:refill.remaining,sameTickHeldFire:refill.remaining===ordinary.capacity-1};
  const persisted=new AccountStore(database);try{const stock=persisted.inventory(accounts[0].accountId).records.find(r=>r.instanceId===instanceId)!;assert.equal(stock.ownedQuantity,1);assert.equal(stock.state,2);evidence.persistedStock=stock;}finally{persisted.close();}
  await wait(()=>frames[1].some(s=>s.tick===latest().tick)||frames[1].at(-1)!.tick>=latest().tick-1);const common=frames[0].filter(a=>a.phase==='PLAYING'&&frames[1].some(b=>b.roomId===a.roomId&&b.tick===a.tick&&b.phase===a.phase));for(const a of common){const b=frames[1].find(b=>b.roomId===a.roomId&&b.tick===a.tick&&b.phase===a.phase)!;assert.deepEqual(a.players,b.players);}assert(common.length>50);evidence.commonTicks=common.length;
  await wait(()=>events[1].filter(e=>e.playerId===id&&['fire','ammoConsumed','itemRejected'].includes(e.type)).length===ownEvents().filter(e=>['fire','ammoConsumed','itemRejected'].includes(e.type)).length);assert.deepEqual(events[1].filter(e=>e.playerId===id&&['fire','ammoConsumed','itemRejected'].includes(e.type)),ownEvents().filter(e=>['fire','ammoConsumed','itemRejected'].includes(e.type)));
  evidence.frames=frames;evidence.events=events;evidence.received=received;evidence.simulationTickSeconds=.05;evidence.status='PASS';
  for(const client of clients)assert((await client.callApi('Leave',{roomId:host.res.room.id,round:1})).isSucc);
 }catch(error){evidence.status='FAIL';evidence.error=String(error);evidence.frames=frames;evidence.events=events;evidence.received=received;evidence.simulationTickSeconds=.05;throw error;}
 finally{
  for(const client of clients)await client.disconnect();
  if(server.exitCode===null){const ended=new Promise(resolve=>server.once('exit',resolve));server.kill();await ended;}
  rmSync(directory,{recursive:true,force:true});evidence.cleaned=true;
  writeFileSync(`recovery/output/tank-purchased-part-ammo-network-${outputStamp}.json`,JSON.stringify(evidence,null,2));
  writeFileSync(`recovery/output/tank-purchased-part-ammo-network-${outputStamp}.log`,log);
 }
 console.log('PASS: actual BUY15001 Equipment passive Delay, finite ordinary consumption/interval/last reload/refill and dual sync without pet');
}

main().catch(error=>{console.error(error);process.exitCode=1;});
