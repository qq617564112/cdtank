import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {WsClient} from 'tsrpc';
import {serviceProto} from '../apps/shared/protocols/serviceProto';
import type {MsgRoomSnapshot, MsgRoomEvent} from '../apps/shared/protocols';
import {combatSkills} from '../apps/server/src/battle/catalog';

async function main(): Promise<void> {
  const vipOnly = false;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const output = `recovery/output/invincibility-purchased-ai-network-${stamp}`;
  const checkpoint = 'recovery/output/tank-purchased-trap-restraint-network-2026-10-05T01-37-14-377Z';
  const directory = mkdtempSync(join(tmpdir(), 'cdtank-invincibility-purchased-ai-'));
  const database = join(directory, 'accounts.sqlite'), port = 3347;
  copyFileSync(checkpoint + '-checkpoint.sqlite', database);
  const accounts = JSON.parse(readFileSync(checkpoint + '-identity.private.json', 'utf8')).accounts;
  let log = '';
  const server = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/index.ts'], {
    env: {...process.env, PORT: String(port), ACCOUNT_DB_PATH: database},
    stdio: ['ignore', 'pipe', 'pipe']});
  server.stdout.on('data', data => {log += String(data);});
  server.stderr.on('data', data => {log += String(data);});
  const clients = Array.from({length: vipOnly ? 4 : 2}, () => new WsClient(serviceProto, {
    server: `ws://127.0.0.1:${port}`, logger: undefined,
    heartbeat: {interval: 5000, timeout: 10000}}));
  const frames: {snapshot: MsgRoomSnapshot; wallTime: number}[][] = clients.map(() => []);
  const events: MsgRoomEvent[][] = clients.map(() => []);
  clients.forEach((client, index) => {
    client.listenMsg('RoomSnapshot', snapshot => {frames[index].push({snapshot, wallTime: Date.now()});});
    client.listenMsg('RoomEvent', event => {events[index].push(event);});
  });
  const evidence: Record<string, unknown> = {status: 'RUNNING', checkpoint: checkpoint + '-checkpoint.sqlite',
    scope: 'M2-01/I08-AI genuine BUY8 and purchasedpet2 life source to ordinary Autopilot threshold/near-threat selection, finite CAS consumption and disable/Leave. Existing AI strategy rebuilt; manual immunity/effects/restart evidence reused; no live state injection.',
    vipOnly, simulationTickSeconds: .05};
  const latest = () => frames[0].at(-1)!.snapshot;
  async function wait(condition: () => boolean): Promise<void> {
    const deadline = Date.now() + 15000;
    while (!condition() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
    assert(condition(), 'Deadline: ' + log.slice(-600));
  }
  try {
    await wait(() => log.includes(`Server started at ${port}.`));
    for (const [index, client] of clients.entries()) {
      assert((await client.connect()).isSucc);
      const account = await client.callApi('Account', index < 2 ? {token: accounts[index].token} : {});
      assert(account.isSucc);
      if (index >= 2) {
        const observerOwned = await client.callApi('OwnedRoles', {}); assert(observerOwned.isSucc);
        assert.deepEqual(observerOwned.res, {base: [], equipment: []});
      }
    }
    const owned = await clients[0].callApi('OwnedRoles', {}); assert(owned.isSucc);
    const tankFields = new Map(owned.res.equipment.find(row => new Map(row.fields).get(0x24) === 3)!.fields);
    assert([0x58, 0x5c, 0x60].every(offset => tankFields.has(offset)));
    const petFields = new Map(owned.res.base.find(row => new Map(row.fields).get(8) === 2)!.fields);
    evidence.source = {petFields:[...petFields],tankFields:[...tankFields],skill:combatSkills.get(8),
      boundGear:'not established; no selected pet substitution', lifeSource:'owned pet+2c independent qualified normal maxHp'};
    const bought = await clients[0].callApi('Shop',{operation:'BUY',itemTableId:8,quantity:1,
      currency:'MONEY',requestId:'purchased_ai_invincibility_first'});
    evidence.purchase=bought;assert(bought.isSucc);
    const assignment=await clients[0].callApi('Kitbag',{operation:'ASSIGN',slot:4,
      instanceId:bought.res.purchased!.instanceId});
    evidence.assignment=assignment;assert(assignment.isSucc);
    const host = await clients[0].callApi('CreateRoom', {mode: vipOnly ? 3 : 4, mapId: 7,
      roomName: '已购生命自主无敌', name: 'Measured', tankId: 3,
      minPlayers: vipOnly ? 4 : 2, maxPlayers: vipOnly ? 4 : 2});
    assert(host.isSucc);
    const guest = await clients[1].callApi('Join', {roomId: host.res.room.id,
      clientId: 'ignored', name: 'Observer', tankId: 3}); assert(guest.isSucc);
    for (const client of clients.slice(2)) {
      const observer = await client.callApi('Join', {roomId: host.res.room.id,
        clientId: 'ignored', name: '普通队员', tankId: 1});
      assert(observer.isSucc);
    }
    for (const client of clients) assert((await client.callApi('Ready', {round: 1})).isSucc);
    await wait(() => frames.every(rows => rows.at(-1)?.snapshot.phase === 'PLAYING'));
    const id = host.res.playerId;
    const player = () => latest().players.find(row => row.id === id)!;
    assert.equal(player().tankId,3);assert.equal(player().petId,2);assert.equal(player().isVIP,false);
    assert.equal(player().maxHp,petFields.get(0x2c));
    evidence.initial=player();
    let shooterSequence=0;
    async function shooterInput(aim=0,fire=false):Promise<void>{
      assert((await clients[1].sendMsg('PlayerInput',{sequence:++shooterSequence,move:0,turn:0,
        aim,fire,useItem:0,clientTime:Date.now()})).isSucc);
    }
    const shooter=()=>latest().players.find(p=>p.id===guest.res.playerId)!;
    let aimed=false;
    for(let tick=0;tick<200;tick++){
      const target=player(), actor=shooter();
      const desired=Math.atan2(target.x-actor.x,target.z-actor.z);
      const difference=Math.atan2(Math.sin(desired-actor.yaw-actor.aim),Math.cos(desired-actor.yaw-actor.aim));
      if(Math.abs(difference)<.025){aimed=true;break;}
      await shooterInput(Math.sign(difference));await new Promise(resolve=>setTimeout(resolve,50));
    }
    assert(aimed);await shooterInput(0,true);
    await wait(()=>player().alive && player().hp<=player().maxHp*.5);
    await shooterInput();
    const settleTick=latest().tick;await wait(()=>latest().tick>=settleTick+12);
    assert(player().alive && player().hp<=player().maxHp*.5);
    const beforeHp=player().hp, beforeScore=player().score;
    evidence.beforeEnable={snapshot:latest(),wallTime:Date.now()};
    const enabled=await clients[0].callApi('Autopilot',{round:1,enabled:true});
    evidence.enabled=enabled;assert(enabled.isSucc);
    evidence.targetClientPlayerInputCount=0;
    await wait(()=>events[0].some(event=>event.playerId===id&&event.type==='itemUsed'&&event.skillId===8)
      && !!player().invincibility);
    const used=events[0].find(event=>event.playerId===id&&event.type==='itemUsed'&&event.skillId===8)!;
    assert.equal(used.value,0);assert.equal(player().hp,beforeHp);
    assert.equal(player().maxHp,petFields.get(0x2c));
    evidence.afterAutouse={snapshot:latest(),wallTime:Date.now()};evidence.used=used;
    const disabled=await clients[0].callApi('Autopilot',{round:1,enabled:false});
    evidence.disabled=disabled;assert(disabled.isSucc);
    const stock=await clients[0].callApi('Inventory',{});assert(stock.isSucc);
    assert.equal(stock.res.records.find(row=>row.instanceId===bought.res.purchased!.instanceId)!.ownedQuantity,0);
    evidence.stockAfter=stock.res;
    await wait(()=>events[1].some(event=>event.playerId===id&&event.type==='itemUsed'&&event.skillId===8));
    const core=(rows:MsgRoomEvent[])=>rows.filter(event=>event.playerId===id&&event.type==='itemUsed'&&event.skillId===8);
    assert.deepEqual(core(events[0]),core(events[1]));
    const common = frames[0].filter(a => a.snapshot.phase === 'PLAYING'
      && frames[1].some(b => b.snapshot.tick === a.snapshot.tick && b.snapshot.phase === 'PLAYING'));
    for (const a of common) {
      const b = frames[1].find(b => b.snapshot.tick === a.snapshot.tick && b.snapshot.phase === 'PLAYING')!;
      assert.deepEqual(a.snapshot.players, b.snapshot.players);
    }
    assert(common.length > 10); evidence.commonTicks = common.length;
    evidence.leave = [];
    for (const client of clients) {
      const leave = await client.callApi('Leave', {roomId: host.res.room.id, round: 1});
      (evidence.leave as unknown[]).push(leave); assert(leave.isSucc);
    }
    evidence.status = 'PASS_LIMITED_PURCHASED_LIFE_AUTOPILOT_INVINCIBILITY_CONSUMER';
  } catch (error) {evidence.status = 'FAIL'; evidence.error = String(error); throw error;}
  finally {
    for (const client of clients) await client.disconnect();
    if (server.exitCode === null && server.signalCode === null) {
      const ended = new Promise(resolve => server.once('exit', resolve)); server.kill(); await ended;
    }
    evidence.frames = frames; evidence.events = events;
    rmSync(directory, {recursive: true, force: true}); evidence.cleaned = true;
    writeFileSync(output + '.json', JSON.stringify(evidence, null, 2));
    writeFileSync(output + '-server.log', log);
  }
  console.log('PASS ' + output + '.json');
}
void main().catch(error => {console.error(error); process.exitCode = 1;});
