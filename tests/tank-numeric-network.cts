import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {WsClient} from 'tsrpc';
import {serviceProto} from '../apps/shared/protocols/serviceProto';
import {TANKS,PET_BASES} from '../apps/server/src/config';
import {combatItems,combatSkills,combatLimits} from '../apps/server/src/battle/catalog';
import {AccountStore} from '../apps/server/src/account-store';
import type {MsgRoomSnapshot, MsgRoomEvent} from '../apps/shared/protocols';

async function main(): Promise<void> {
 const outputStamp=new Date().toISOString().replace(/[:.]/g,'-');
 const directory=mkdtempSync(join(tmpdir(),'cdtank-tank-numeric-')),port=3250;
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
  async function segment(name:string,input:{move:number;turn:number;aim:number;fire:boolean},ticks:number){
   const start=frames[0].length;
   assert((await clients[0].sendMsg('PlayerInput',{sequence:++sequence,...input,useItem:0,clientTime:Date.now()})).isSucc);
   await wait(()=>frames[0].length>=start+ticks,ticks*50+5000);
   const samples=frames[0].slice(start,start+ticks);return {name,input,samples};
  }
  const segments=[];
  segments.push(await segment('forward',{move:1,turn:0,aim:0,fire:false},8));
  segments.push(await segment('stop',{move:0,turn:0,aim:0,fire:false},8));
  segments.push(await segment('reverse',{move:-1,turn:0,aim:0,fire:false},8));
  segments.push(await segment('bodyRight',{move:0,turn:1,aim:0,fire:false},16));
  segments.push(await segment('bodyLeft',{move:0,turn:-1,aim:0,fire:false},16));segments.push(await segment('turretRight',{move:0,turn:0,aim:1,fire:false},16));segments.push(await segment('turretLeft',{move:0,turn:0,aim:-1,fire:false},16));
  segments.push(await segment('continuousFire',{move:0,turn:0,aim:0,fire:true},420));
  await segment('stopFire',{move:0,turn:0,aim:0,fire:false},4);
  const beforeSwitch=latest().players.find(p=>p.id===id)!;assert((await clients[0].sendMsg('PlayerInput',{sequence:++sequence,move:0,turn:0,aim:0,fire:false,useItem:2,clientTime:Date.now()})).isSucc);await wait(()=>latest().players.find(p=>p.id===id)?.ammoItemId===2007);assert((await clients[0].sendMsg('PlayerInput',{sequence:++sequence,move:0,turn:0,aim:0,fire:false,useItem:1,clientTime:Date.now()})).isSucc);await wait(()=>latest().players.find(p=>p.id===id)?.ammoItemId===2001);const afterSwitch=latest().players.find(p=>p.id===id)!;assert.equal(afterSwitch.ammoMagazine!.remaining,beforeSwitch.ammoMagazine!.remaining);evidence.ammoSwitch={before:beforeSwitch,after:afterSwitch};
  analyze(evidence,frames,events,id,segments);
  evidence.frames=frames;evidence.events=events;evidence.status='PASS';
  for(const client of clients)assert((await client.callApi('Leave',{roomId:host.res.room.id,round:1})).isSucc);
 }catch(error){evidence.status='FAIL';evidence.error=String(error);evidence.frames=frames;evidence.events=events;throw error;}
 finally{
  for(const client of clients)await client.disconnect();
  if(server.exitCode===null){const ended=new Promise(resolve=>server.once('exit',resolve));server.kill();await ended;}
  rmSync(directory,{recursive:true,force:true});evidence.cleaned=true;
  writeFileSync(`recovery/output/tank-numeric-network-${outputStamp}.json`,JSON.stringify(evidence,null,2));
  writeFileSync(`recovery/output/tank-numeric-network-${outputStamp}.log`,log);
 }
 console.log('PASS: tank1/base part0/default2001/map7 ordinary distance/turn/reload/magazine and dual network synchronization');
}

function analyze(evidence:Record<string,unknown>,frames:MsgRoomSnapshot[][],events:MsgRoomEvent[][],id:string,segments:{name:string;input:{move:number;turn:number;aim:number;fire:boolean};samples:MsgRoomSnapshot[]}[]):void {
  const measured=segments.map(segment=>{
   const values=segment.samples.map(s=>({tick:s.tick,...s.players.find(p=>p.id===id)!}));
   return {...segment,samples:undefined,values,clocks:segment.samples.map(s=>({tick:s.tick,serverTime:s.serverTime})),steps:values.slice(1).map((v,i)=>({ticks:v.tick-values[i].tick,distance:Math.hypot(v.x-values[i].x,v.z-values[i].z),yaw:v.yaw-values[i].yaw,aim:v.aim-values[i].aim}))};
  });
  for(const row of measured.filter(s=>s.name==='forward'||s.name==='reverse'))assert(row.steps.some(s=>s.distance>0));for(const row of measured.filter(s=>s.name.startsWith('body')))assert(row.steps.some(s=>Math.abs(s.yaw)>0));for(const row of measured.filter(s=>s.name.startsWith('turret')))assert(row.steps.some(s=>Math.abs(s.aim)>0));
  const observations=measured.map(row=>{const first=row.values[0],last=row.values.at(-1)!,wallSeconds=(row.clocks.at(-1)!.serverTime-row.clocks[0].serverTime)/1000,seconds=(last.tick-first.tick)/20;return{name:row.name,seconds,wallSeconds,bodyYaw:{first:first.bodyYaw,last:last.bodyYaw},distance:row.steps.reduce((n,s)=>n+s.distance,0),yaw:row.steps.reduce((n,s)=>n+Math.atan2(Math.sin(s.yaw),Math.cos(s.yaw)),0),aim:last.aim-first.aim};});
  const tank=TANKS.find(t=>t.id===1)!.recomputeBase,pet=PET_BASES.find(p=>p.id===1)!;const clamp=(value:number,id:number)=>Math.max(combatLimits.get(id)!.lower,Math.min(combatLimits.get(id)!.upper,value));const ammoSkills=combatItems.get(2001)!.skillIds.map(id=>combatSkills.get(id)!).filter(Boolean),delay=ammoSkills.reduce((sum,skill)=>sum+skill.attributes.Delay,tank.reloadDuration),loadTime=ammoSkills.reduce((sum,skill)=>sum+skill.attributes.LoadTime,0),scaled=clamp(delay,16)*Math.fround(.1),normalSeconds=Math.fround(scaled),lastSeconds=Math.fround(scaled*loadTime*Math.fround(.03)),capacity=clamp(ammoSkills.reduce((sum,skill)=>sum+skill.attributes.MaxBullet,tank.field90),17);const mastery=Math.max(1,[pet.field7c,pet.field80,pet.field84,pet.field88][tank.tankType-1]-1),expectedSpeed=Math.fround((mastery+clamp(tank.field84,14)-3)*10+50),expectedTurn=Math.fround((mastery+clamp(tank.field88,15)-3)*Math.fround(4*Math.PI/180)+Math.fround(.1919862));for(const o of observations.filter(o=>o.name==='forward'||o.name==='reverse'))assert(Math.abs(o.distance/o.seconds-expectedSpeed)<.3,`${o.name}speed ${o.distance/o.seconds} expected${expectedSpeed}`);for(const o of observations.filter(o=>o.name.startsWith('body')||o.name.startsWith('turret')))assert(Math.abs(Math.abs((o.name.startsWith('body')?o.yaw:o.aim)/o.seconds)-expectedTurn)<.002,`${o.name}turn`);evidence.expected={speed:expectedSpeed,turn:expectedTurn,normalSeconds,lastSeconds,capacity,delay,loadTime};
  const fires=events[0].filter(e=>e.type==='fire'&&e.playerId===id);assert(fires.length>=7);const fireClocks=frames[0].map(s=>{const p=s.players.find(p=>p.id===id)!;return{tick:s.tick,serverTime:s.serverTime,startedAt:p.reload?.startedAt??0,duration:p.reload?.duration??0,source:p.reload?.source};}).filter((v,i,a)=>v.startedAt>0&&(i===0||v.startedAt!==a[i-1].startedAt));assert(fireClocks.length>=7);const firstMagazine=fireClocks.slice(0,7),intervals=firstMagazine.slice(1).map((v,i)=>(v.startedAt-firstMagazine[i].startedAt)/1000);assert(firstMagazine.every(v=>v.source==='original-normal'));assert(Math.abs(firstMagazine[0].duration-normalSeconds)<1e-6);assert.equal(frames[0].find(s=>s.phase==='PLAYING')!.players.find(p=>p.id===id)!.ammoMagazine!.capacity,capacity);for(let i=0;i<5;i++)assert(intervals[i]>=firstMagazine[i].duration-1e-6&&intervals[i]<=firstMagazine[i].duration+.075);assert(Math.abs(firstMagazine[5].duration-lastSeconds)<1e-6);assert(intervals[5]>=firstMagazine[5].duration-1e-6&&intervals[5]<=firstMagazine[5].duration+.075);
  const common=frames[0].filter(s=>frames[1].some(t=>t.tick===s.tick));assert(common.length>50);for(const a of common){const b=frames[1].find(s=>s.tick===a.tick)!;assert.deepEqual(a.players,b.players);}evidence.manual={observations,measured,fires,firstMagazine,intervals,commonTicks:common.length};
}

if(process.argv[2]==='--analyze'){
 const path=process.argv[3],evidence=JSON.parse(readFileSync(path,'utf8')),frames=evidence.frames as MsgRoomSnapshot[][],events=evidence.events as MsgRoomEvent[][],id=evidence.ammoSwitch.before.id;
 let offset=0;const rows:[string,number,number,number,boolean,number][]=[['forward',1,0,0,false,8],['stop',0,0,0,false,8],['reverse',-1,0,0,false,8],['bodyRight',0,1,0,false,16],['bodyLeft',0,-1,0,false,16],['turretRight',0,0,1,false,16],['turretLeft',0,0,-1,false,16],['continuousFire',0,0,0,true,420]];
 const segments=rows.map(([name,move,turn,aim,fire,count])=>{const samples=frames[0].slice(offset,offset+count);offset+=count;return{name,input:{move,turn,aim,fire},samples};});
 analyze(evidence,frames,events,id,segments);evidence.status='PASS';delete evidence.error;evidence.rawCapture=path;const output=path.replace('.json','-analysis.json');writeFileSync(output,JSON.stringify(evidence,null,2));console.log('PASS: '+output);
}else main().catch(error=>{console.error(error);process.exitCode=1;});
