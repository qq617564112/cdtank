import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {DatabaseSync, backup} from 'node:sqlite';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRequire} from 'node:module';
import {serviceProto} from '../apps/shared/protocols/serviceProto.ts';
const {WsClient}=createRequire(import.meta.url)('tsrpc');
const port=Number(process.env.TANK_MAINTENANCE_PORT);
assert(Number.isInteger(port)&&port>0,'Explicit coordinated TANK_MAINTENANCE_PORT required');
const fixture=JSON.parse(await readFile('recovery/output/browser-home-equipment-common-row-2026-10-05T14-42-06-024Z-checkpoint-fixture.json','utf8'));
const directory=await mkdtemp(join(tmpdir(),'cdtank-maintenance-'));
const database=join(directory,'accounts.sqlite');
const original=new DatabaseSync(fixture.database,{readOnly:true});
try{await backup(original,database);}finally{original.close();}
const db=new DatabaseSync(database);
const account=db.prepare('SELECT id FROM accounts WHERE token=?').get(fixture.token);
const before=db.prepare('SELECT payload FROM role_profiles WHERE account_id=?').get(account.id);
const bytes=new Uint8Array(before.payload),view=new DataView(bytes.buffer);
view.setUint32(0x70,500000,true);view.setUint32(0x74,1000,true);
db.prepare('UPDATE role_profiles SET payload=? WHERE account_id=?').run(bytes,account.id);db.close();
const output='recovery/output/tank-maintenance-network-'+new Date().toISOString().replace(/[:.]/g,'-');
const evidence={status:'RUNNING',port,fixture:{source:fixture.database,copied:true,fundsOnlyBeforeServer:{money:500000,tokens:1000},ownedRecordsInjected:false},requests:[],rejections:[],snapshots:[]};
let server,log='',clients=[];
async function stop(){if(server?.exitCode===null&&server.signalCode===null){const done=new Promise(resolve=>server.once('exit',resolve));server.kill();await done;}}
async function wait(predicate,timeout=15000){const deadline=Date.now()+timeout;while(!predicate()&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,20));assert(predicate(),log.slice(-600));}
async function start(){server=spawn(process.execPath,['scripts/start-server.mjs'],{env:{...process.env,PORT:String(port),ACCOUNT_DB_PATH:database},stdio:['ignore','pipe','pipe']});const offset=log.length;for(const stream of [server.stdout,server.stderr])stream.on('data',chunk=>log+=String(chunk));await wait(()=>log.slice(offset).includes('Server started'));}
function client(){const value=new WsClient(serviceProto,{server:`ws://127.0.0.1:${port}`,logger:undefined,heartbeat:{interval:5000,timeout:10000}});clients.push(value);return value;}
async function api(client,name,request){const result=await client.callApi(name,request);assert(result.isSucc,JSON.stringify(result));return result.res;}
try{
 await start();
 const peers=[0,1,2,3].map(()=>client()),frames=peers.map(()=>[]);
 for(const [index,peer] of peers.entries()){peer.listenMsg('RoomSnapshot',snapshot=>frames[index].push(snapshot));assert((await peer.connect()).isSucc);await api(peer,'Account',index===0?{token:fixture.token}:{});}
 await api(peers[0],'SelectRole',{kind:'tank',instanceId:1});
 const initial=await api(peers[0],'TankMaintenance',{operation:'QUERY'});evidence.initial=initial;
 const target=initial.tanks.find(row=>row.instanceId===1);assert.equal(target.tankId,3);assert.equal(target.remainingMinutes,0);
 assert.deepEqual(target.quotes.map(row=>[row.currency,row.days,row.cost,row.displayCost]),[[0,1,50,'5'],[0,7,250,'25'],[0,30,500,'50'],[1,1,25000,'25000'],[1,7,125000,'125000'],[1,30,250000,'250000']]);
 const created=await api(peers[0],'CreateRoom',{mode:2,mapId:2,roomName:'保养期限',name:'Owner',tankId:3,minPlayers:4,maxPlayers:4});
 for(const peer of peers.slice(1))await api(peer,'Join',{roomId:created.room.id,clientId:'unused',name:'Peer',tankId:1});
 await api(peers[0],'Ready',{round:1});await wait(()=>frames[0].at(-1)?.match?.readyPlayerIds.includes(created.playerId));
 let money=500000,tokens=1000,minutes=0,final;
 for(const [index,quote] of target.quotes.entries()){
  const request={operation:'MAINTAIN',instanceId:1,days:quote.days,currency:quote.currency,requestId:'maintenance_network_'+index};
  final=await api(peers[0],'TankMaintenance',request);
  minutes+=quote.days*1440;if(quote.currency===0)tokens-=quote.cost;else money-=quote.cost;
  assert.equal(final.money,money);assert.equal(final.tokens,tokens);assert.equal(final.maintained.remainingMinutes,minutes);assert.equal(final.replayed,false);
  const expected=structuredClone(initial.owned);const record=expected.equipment.find(row=>new Map(row.fields).get(0x1c)===1);record.fields=record.fields.map(([offset,value])=>[offset,offset===0x34?minutes:value]);assert.deepEqual(final.owned,expected);
  const profile=Uint8Array.from(initial.profile.bytes),profileView=new DataView(profile.buffer);profileView.setUint32(0x70,money,true);profileView.setUint32(0x74,tokens,true);assert.deepEqual(final.profile.bytes,[...profile]);assert.deepEqual(final.profile.strings,initial.profile.strings);
  const replay=await api(peers[0],'TankMaintenance',request);assert.equal(replay.replayed,true);assert.deepEqual(replay.owned,final.owned);assert.equal(replay.money,money);assert.equal(replay.tokens,tokens);
  evidence.requests.push({request,result:final,replay:{replayed:replay.replayed,money:replay.money,tokens:replay.tokens}});
 }
 await wait(()=>frames.every(rows=>!rows.at(-1).match.readyPlayerIds.includes(created.playerId)));
 const recent=frames[1].at(-1);assert.equal(recent.phase,'WAITING');evidence.waitingReadyCancelled=true;
 for(const request of [{operation:'MAINTAIN',instanceId:999,days:1,currency:0,requestId:'maintenance_missing_owner'},{operation:'MAINTAIN',instanceId:1,days:30,currency:0,requestId:'maintenance_insufficient_coin'},{operation:'MAINTAIN',instanceId:1,days:30,currency:1,requestId:'maintenance_insufficient_money'},{operation:'MAINTAIN',instanceId:2,days:1,currency:0,requestId:'maintenance_network_0'}]){
  const result=await peers[0].callApi('TankMaintenance',request);assert(!result.isSucc);evidence.rejections.push({request,error:result.err.message});
 }
 const unchanged=await api(peers[0],'TankMaintenance',{operation:'QUERY'});assert.deepEqual(unchanged.owned,final.owned);assert.equal(unchanged.money,money);assert.equal(unchanged.tokens,tokens);
 for(const peer of peers)await api(peer,'Ready',{round:1});await wait(()=>frames.every(rows=>rows.at(-1)?.phase==='PLAYING'));
 const playing=await peers[0].callApi('TankMaintenance',{operation:'MAINTAIN',instanceId:1,days:1,currency:0,requestId:'maintenance_playing_reject'});assert(!playing.isSucc);evidence.playingRejected=playing.err.message;
 await new Promise(resolve=>setTimeout(resolve,300));const tickFrames=new Map(frames[1].filter(row=>row.phase==='PLAYING').map(row=>[row.tick,row]));const paired=[...new Map(frames[0].filter(row=>row.phase==='PLAYING').map(row=>[row.tick,row])).values()].filter(row=>tickFrames.has(row.tick));assert(paired.length>0);for(const row of paired){assert.deepEqual(row.players,tickFrames.get(row.tick).players);assert.deepEqual(row.match,tickFrames.get(row.tick).match);}evidence.commonTicks=paired.length;evidence.snapshots=paired.map(row=>({tick:row.tick,players:row.players,match:row.match}));
 for(const peer of peers)await api(peer,'Leave',{roomId:created.room.id,round:1});
 for(const peer of peers)await peer.disconnect();await stop();
 await start();const restored=client();assert((await restored.connect()).isSucc);await api(restored,'Account',{token:fixture.token});const query=await api(restored,'TankMaintenance',{operation:'QUERY'});assert.deepEqual(query.owned,final.owned);assert.deepEqual(query.profile,final.profile);assert.equal(query.money,100000);assert.equal(query.tokens,200);assert.equal(query.tanks.find(row=>row.instanceId===1).remainingMinutes,109440);evidence.restored=query;evidence.actualRestart=true;
 evidence.status='PASS';console.log('PASS '+output+'.json');
}catch(error){evidence.status='FAIL';evidence.error=String(error);throw error;}
finally{for(const peer of clients)await peer.disconnect().catch(()=>{});await stop();await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');await writeFile(output+'.log',log);await rm(directory,{recursive:true,force:true});await writeFile(output+'-cleanup.json',JSON.stringify({serverStopped:server?.exitCode!==null||server?.signalCode!==null,tempRemoved:true})+'\n');}
