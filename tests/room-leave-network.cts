import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {WsClient} from 'tsrpc';
import {serviceProto} from '../apps/shared/protocols/serviceProto';
import type {MsgRoomSnapshot} from '../apps/shared/protocols';

async function main() {
  const directory = mkdtempSync(join(tmpdir(), 'cdtank-leave-'));
  const server = spawn(process.execPath, ['--import','tsx','apps/server/src/index.ts'], {
    env: {...process.env, PORT: '3196', ACCOUNT_DB_PATH: join(directory,'accounts.sqlite')},
    stdio: ['ignore','pipe','pipe'],
  });
  let log = '';
  server.stdout.on('data', data => {log += data;}); server.stderr.on('data', data => {log += data;});
  const clients = [0,1].map(() => new WsClient(serviceProto, {server:'ws://127.0.0.1:3196',logger:undefined,
    heartbeat:{interval:5000,timeout:10000}}));
  const snapshots: (MsgRoomSnapshot | undefined)[] = [];
  const snapshotCounts = [0,0];
  clients.forEach((client,i) => client.listenMsg('RoomSnapshot', snapshot => {snapshots[i]=snapshot; snapshotCounts[i]++;}));
  const wait = async (condition:()=>boolean) => {
    const deadline = Date.now()+15000;
    while (!condition() && Date.now()<deadline) await new Promise(resolve=>setTimeout(resolve,20));
    assert(condition(),log.slice(-2000));
  };
  try {
    await wait(()=>log.includes('Server started at 3196.'));
    const accountIds: string[]=[];
    for (const client of clients) {
      assert((await client.connect()).isSucc);
      const account = await client.callApi('Account',{}); assert(account.isSucc); accountIds.push(account.res.token);
    }
    const absent = await clients[0].callApi('Leave',{roomId:'R1',round:1});
    assert(!absent.isSucc && absent.err.code==='NOT_JOINED');
    const owner = await clients[0].callApi('CreateRoom',{mode:1,mapId:7,roomName:'退出验证',name:'Owner',tankId:1}); assert(owner.isSucc);
    const roomId=owner.res.room.id, round=owner.res.room.round; assert(round !== undefined);
    const guest = await clients[1].callApi('Join',{roomId,clientId:'',name:'Guest',tankId:1}); assert(guest.isSucc);
    assert((await clients[0].callApi('Cpu',{round,operation:'ADD',tankId:1})).isSucc);
    assert((await clients[0].callApi('Ready',{round,isReady:true})).isSucc);
    await wait(()=>snapshots[1]?.players.length===3 && !!snapshots[1]?.match?.readyPlayerIds.includes(owner.res.playerId));
    const beforeRefusalCount = snapshotCounts[1];
    for (const request of [{roomId,round:round-1},{roomId:'R1',round}]) {
      const refused=await clients[0].callApi('Leave',request); assert(!refused.isSucc && refused.err.code==='LEAVE_CONFLICT');
    }
    await wait(()=>snapshotCounts[1] > beforeRefusalCount + 1);
    assert.equal(snapshots[1]!.players.length,3);
    assert(snapshots[1]!.match!.readyPlayerIds.includes(owner.res.playerId));
    const departed = await clients[0].callApi('Leave',{roomId,round}); assert(departed.isSucc); assert.deepEqual(departed.res,{roomId,round});
    await wait(()=>snapshots[1]?.players.length===2 && snapshots[1]?.match?.cpuManagerId===undefined);
    assert(!snapshots[1]?.players.some(player=>player.id===owner.res.playerId));
    assert(!snapshots[1]?.match?.readyPlayerIds.includes(owner.res.playerId));
    assert(clients[0].isConnected);
    const repeated=await clients[0].callApi('Leave',{roomId,round}); assert(!repeated.isSucc && repeated.err.code==='NOT_JOINED');
    const inventory=await clients[0].callApi('Inventory',{}); assert(inventory.isSucc,'account authentication survives departure');
    const rejoin=await clients[0].callApi('Join',{roomId,clientId:'',name:'Owner again',tankId:1}); assert(rejoin.isSucc);
    await wait(()=>snapshots[1]?.players.length===3 && !!snapshots[1]?.players.some(player=>player.id===rejoin.res.playerId));
    assert.notEqual(rejoin.res.playerId,owner.res.playerId);
    assert((await clients[0].callApi('Leave',{roomId,round})).isSucc);
    assert((await clients[1].callApi('Leave',{roomId,round})).isSucc);
    const rooms=await clients[0].callApi('ListRooms',{}); assert(rooms.isSucc); assert(!rooms.res.rooms.some(room=>room.id===roomId));
    writeFileSync('recovery/output/room-leave-network.json',JSON.stringify({status:'PASS',scope:'M5-03-X',roomId,round,
      checks:['not joined','stale round and foreign room refusal preserves member','confirmed departure','ready cleanup and absent creator manager',
      'duplicate refuses','authenticated transport preserved','ordinary rejoin','last human leaves removes CPU room'],accountCount:accountIds.length},null,2));
    console.log('PASS room leave network');
  } finally {
    await Promise.all(clients.map(client=>client.disconnect()));
    if(server.exitCode===null && server.signalCode===null) {const ended=new Promise(resolve=>server.once('exit',resolve));server.kill();await ended;}
    writeFileSync('recovery/output/room-leave-network.log',log);
    rmSync(directory,{recursive:true,force:true});
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
