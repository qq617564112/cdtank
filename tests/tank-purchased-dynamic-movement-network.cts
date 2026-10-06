import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {WsClient} from 'tsrpc';
import {serviceProto} from '../apps/shared/protocols/serviceProto';
import type {MsgRoomSnapshot, MsgRoomEvent, MsgPlayerInput} from '../apps/shared/protocols';
import {AccountStore} from '../apps/server/src/account-store';
import {TANKS, PET_BASES, MAPS} from '../apps/server/src/config';
import {combatSkills, combatItemSkills, combatLimits} from '../apps/server/src/battle/catalog';
import {recomputeQualifiedRoleMovement} from '../apps/server/src/battle/roles/recompute-movement';
import {ROLE_INITIAL_MOVEMENT_SCALES} from '../apps/server/src/battle/roles/record-defaults';
import {RoleAttributeState} from '../apps/server/src/battle/roles/attribute-state';
import {RoleCombatState} from '../apps/server/src/battle/roles/combat-state';
import {predictBattleMovement, type MovingParticipant} from '../apps/server/src/battle/movement';
import {predictControlledBattleMovement, type DynamicMovingParticipant} from '../apps/server/src/battle/dynamic-movement';
import {createRoomBattlefield} from '../apps/server/src/battlefield';

type Frame = {wallTime: number; snapshot: MsgRoomSnapshot};
type Player = MsgRoomSnapshot['players'][number];

async function main(): Promise<void> {
  const forwardOnly = process.argv.includes('--forward-only');
  const autopilotExitOnly = process.argv.includes('--autopilot-exit-only');
  const autopilotOnly = process.argv.includes('--autopilot-only') || autopilotExitOnly;
  assert(!(forwardOnly && autopilotOnly), 'Select one first-acceptance scope');
  const mode = autopilotOnly ? 2 : 5, mapId = autopilotOnly ? 2 : 20;
  const modeMap = MAPS.find(map => map.mode === mode && map.mapId === mapId);
  assert(modeMap && modeMap.sourceMinPlayers <= 4 && modeMap.maxPlayers >= 4);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const prefix = `recovery/output/tank-purchased-dynamic-movement-network-${stamp}`;
  const directory = mkdtempSync(join(tmpdir(), 'cdtank-purchased-dynamic-'));
  const database = join(directory, 'accounts.sqlite'), port = 3292;
  let log = '';
  const server = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/index.ts'], {
    env: {...process.env, PORT: String(port), ACCOUNT_DB_PATH: database, MATCH_TIME_LIMIT_SECONDS: '90'},
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', data => {log += String(data);});
  server.stderr.on('data', data => {log += String(data);});
  const clients = Array.from({length: 4}, () => new WsClient(serviceProto, {
    server: `ws://127.0.0.1:${port}`, logger: undefined, heartbeat: {interval: 5000, timeout: 10000},
  }));
  const frames: Frame[][] = clients.map(() => []), events: MsgRoomEvent[][] = clients.map(() => []);
  clients.forEach((client, index) => {
    client.listenMsg('RoomSnapshot', snapshot => {frames[index].push({wallTime: Date.now(), snapshot});});
    client.listenMsg('RoomEvent', event => {events[index].push(event);});
  });
  const latest = () => frames[0].at(-1)!.snapshot;
  async function wait(check: () => boolean, timeout = 12000): Promise<void> {
    const deadline = Date.now() + timeout;
    while (!check() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
    assert(check(), `Deadline: ${log.slice(-1200)}`);
  }
  const evidence: Record<string, unknown> = {
    status: 'RUNNING', mode, mapId, purchases: [], inputs: [], forwardOnly, autopilotOnly, autopilotExitOnly,
    scope: 'Empty Accounts, funds-only profile fixture; real BUY3/pet2/SelectRole. Four normal humans, repeated source spawn, ordinary approach, dynamic refusal, reverse clearance, dual snapshots and Leave. Source OBB constructor dimensions49/24/52, original prediction/controller; acquisition initial values, authority lifecycle and control mapping reconstructed. No active pose/HP/events edits. Snapshot-only copied predictors are instruments, not original executable or new protocol fields.',
    startingProfileFixture: {bytes: 368, moneyOffset: 0x70, money: 100000, otherBytes: 0,
      strings: ['', ''], originalAccountInitialValuesConfirmed: false},
  };
  try {
    await wait(() => log.includes(`Server started at ${port}.`));
    const accountIds: string[] = [];
    const expected: NonNullable<ReturnType<typeof recomputeQualifiedRoleMovement>>[] = [];
    for (const [index, client] of clients.entries()) {
      assert((await client.connect()).isSucc);
      const account = await client.callApi('Account', {}); assert(account.isSucc);
      accountIds.push(account.res.accountId);
      const owned = await client.callApi('OwnedRoles', {}); assert(owned.isSucc);
      assert.deepEqual(owned.res, {base: [], equipment: []});
      const inventory = await client.callApi('Inventory', {}); assert(inventory.isSucc);
      assert.deepEqual(inventory.res.records, []);
      const store = new AccountStore(database);
      try {
        const bytes = new Uint8Array(0x170);
        new DataView(bytes.buffer).setUint32(0x70, 100000, true);
        store.replaceRoleProfile(account.res.accountId, {bytes, strings: ['', '']});
      } finally {store.close();}
      const tankBuy = await client.callApi('TankShop', {operation: 'BUY', tankId: 3,
        currency: 'MONEY', requestId: `dynamic_tank_${index}`}); assert(tankBuy.isSucc);
      const petBuy = await client.callApi('PetShop', {operation: 'BUY', petId: 2,
        currency: 'MONEY', requestId: `dynamic_pet_${index}`}); assert(petBuy.isSucc);
      const tankFields = new Map(tankBuy.res.purchased!.fields), petFields = new Map(petBuy.res.purchased!.fields);
      assert((await client.callApi('SelectRole', {kind: 'tank', instanceId: tankFields.get(0x1c)!})).isSucc);
      assert((await client.callApi('SelectRole', {kind: 'pet', instanceId: petFields.get(0)!})).isSucc);
      const tank = TANKS.find(row => row.id === tankFields.get(0x24))!;
      const pet = PET_BASES.find(row => row.id === petFields.get(8))!;
      const parameters = recomputeQualifiedRoleMovement({tank: tank.recomputeBase, pet,
        ownedField34: tankFields.get(0x34), tankType: tank.recomputeBase.tankType,
        sources: {currentSkillIds: combatItemSkills.get(2001)!.skillIds,
          extraSkill: {baseId: 0, rank: 0}, itemIds: [0x58, 0x5c, 0x60].map(offset => tankFields.get(offset)!)},
        skills: combatSkills, items: combatItemSkills, limits: combatLimits, roleValue9: 0,
        movementScales: ROLE_INITIAL_MOVEMENT_SCALES});
      assert(parameters); expected.push(parameters);
      (evidence.purchases as unknown[]).push({index, tank: tankBuy.res, pet: petBuy.res, parameters});
    }
    const host = await clients[0].callApi('CreateRoom', {mode, mapId, roomName: autopilotOnly ? '购入托管' : '双车碰撞',
      name: '购买主车', tankId: 3, minPlayers: 4, maxPlayers: 4});
    evidence.roomCreation = host; assert(host.isSucc, JSON.stringify(host));
    const ids = [host.res.playerId];
    for (const client of clients.slice(1)) {
      const joined = await client.callApi('Join', {roomId: host.res.room.id,
        clientId: 'ignored', name: '购买静车', tankId: 3}); assert(joined.isSucc);
      ids.push(joined.res.playerId);
    }
    for (const client of clients) assert((await client.callApi('Ready', {round: 1})).isSucc);
    await wait(() => frames[0].at(-1)?.snapshot.roomId === host.res.room.id && latest().phase === 'PLAYING');
    assert(latest().players.every(player => player.tankId === 3 && player.petId === 2 && !player.isVIP));
    evidence.initial = latest();
    // Read-only copied snapshot geometry distinguishes dynamic refusal from a NAV wall.
    // Wire angles/positions are rounded, so predictions identify the cause rather than
    // serve as an exact per-tick position oracle.
    const field = createRoomBattlefield(mapId);
    function copied(player: Player): DynamicMovingParticipant {
      const index = ids.indexOf(player.id), parameters = expected[index];
      const flags = new Uint8Array(13); flags[9] = 1; flags[10] = 1;
      return {...player, movementCommand: 0, tank: TANKS.find(row => row.id === player.tankId)!,
        attributesReady: false, recoveredMovement: parameters,
        attributes: new RoleAttributeState({move: parameters.speed, turn: parameters.turn,
          hp: player.hp, maxHp: player.maxHp, maxBullet: player.ammoMagazine!.capacity}, () => {}),
        combat: new RoleCombatState({status: player.alive ? 2 : 3, flags, arrays: new Map()})};
    }
    let sequence = 0, blockedInput: MsgPlayerInput | undefined;
    if (autopilotOnly) {
      const start = latest().tick;
      const enabled = await clients[0].callApi('Autopilot', {round: 1, enabled: true});
      evidence.autopilotEnabled = enabled; assert(enabled.isSucc);
      await wait(() => latest().players.find(player => player.id === ids[0])?.isAutopilot === true);
      const durationTicks = autopilotExitOnly ? 10 : 160;
      await wait(() => latest().tick >= start + durationTicks);
      const samples = frames[0].filter(frame => frame.snapshot.phase === 'PLAYING'
        && frame.snapshot.tick > start && frame.snapshot.tick <= start + durationTicks);
      const steps = samples.slice(1).flatMap((frame, index) => {
        const previous = samples[index], before = previous.snapshot.players.find(player => player.id === ids[0])!;
        const after = frame.snapshot.players.find(player => player.id === ids[0])!;
        if (frame.snapshot.tick !== previous.snapshot.tick + 1 || !before.alive || !after.alive) return [];
        const bodyAngle = Math.atan2(Math.sin((after.bodyYaw ?? after.yaw) - (before.bodyYaw ?? before.yaw)),
          Math.cos((after.bodyYaw ?? after.yaw) - (before.bodyYaw ?? before.yaw)));
        return [{tick: frame.snapshot.tick, distance: Math.hypot(after.x - before.x, after.z - before.z),
          bodyAngle, simulationSeconds: .05, serverSeconds: (frame.snapshot.serverTime - previous.snapshot.serverTime) / 1000,
          wallSeconds: (frame.wallTime - previous.wallTime) / 1000}];
      });
      const moving = steps.filter(step => step.distance > 1);
      const turning = steps.filter(step => Math.abs(step.bodyAngle) > .005);
      const stationaryTurning = turning.filter(step => step.distance < .01);
      evidence.autopilot = {samples, steps, movingSteps: moving.length, turningSteps: turning.length,
        expected: expected[0], positionTolerance: .03, angleTolerance: .001};
      if (!autopilotExitOnly) {
      assert(moving.length >= 3, 'Actual purchased-source AI must translate');
      assert(stationaryTurning.length >= 3, 'Actual purchased-source AI must turn while stationary');
      assert(moving.every(step => Math.abs(step.distance - expected[0].speed * .05) < .03),
        'AI ordinary input consumes recovered speed, with public snapshot rounding tolerance');
      assert(stationaryTurning.every(step => Math.abs(Math.abs(step.bodyAngle) - expected[0].turn * .05) < .001),
        'AI ordinary input consumes recovered turn, with public snapshot rounding tolerance');
      }
      const disabled = await clients[0].callApi('Autopilot', {round: 1, enabled: false});
      evidence.autopilotDisabled = disabled; assert(disabled.isSucc);
      assert((await clients[0].sendMsg('PlayerInput', {sequence: ++sequence, move: 0, turn: 0,
        aim: 0, fire: false, useItem: 0, clientTime: Date.now()})).isSucc);
      const stopTick = latest().tick;
      await wait(() => latest().tick >= stopTick + 8);
      const stopped = frames[0].filter(frame => frame.snapshot.tick >= stopTick + 3
        && frame.snapshot.tick <= stopTick + 8);
      assert(stopped.length >= 5);
      const first = stopped[0].snapshot.players.find(player => player.id === ids[0])!;
      assert(stopped.every(frame => {
        const player = frame.snapshot.players.find(player => player.id === ids[0])!;
        return !player.isAutopilot && player.x === first.x && player.z === first.z
          && player.yaw === first.yaw && player.bodyYaw === first.bodyYaw;
      }), 'Disabled AI and fresh stop input return authority to the normal player');
      evidence.autopilotStopped = stopped;
    } else {
    if (forwardOnly) {
      const start = frames[0].at(-1)!;
      // The source heading points away from the repeated-spawn peer. Moving
      // forward creates room for a normal hull turn before the contact approach.
      const input: MsgPlayerInput = {sequence: ++sequence, move: 1, turn: 0,
        aim: 0, fire: false, useItem: 0, clientTime: Date.now()};
      assert((await clients[0].sendMsg('PlayerInput', input)).isSucc);
      (evidence.inputs as unknown[]).push({tick: start.snapshot.tick, input});
      await wait(() => latest().tick >= start.snapshot.tick + 20);
      assert((await clients[0].sendMsg('PlayerInput', {...input, sequence: ++sequence, move: 0})).isSucc);
      const after = frames[0].at(-1)!;
      const owner = after.snapshot.players.find(player => player.id === ids[0])!;
      const peer = after.snapshot.players.find(player => player.id === ids[3])!;
      assert(Math.hypot(owner.x - peer.x, owner.z - peer.z) > 120,
        'Normal forward clearance must create turning space');
      evidence.clearance = {start, after};
    }
    const approachStart = latest().tick;
    while (latest().tick - approachStart < 400) {
      const snapshot = latest(), owner = snapshot.players.find(player => player.id === ids[0])!;
      const peer = snapshot.players.find(player => player.id === ids[3])!;
      const bearing = Math.atan2(peer.x - owner.x, peer.z - owner.z);
      const error = Math.atan2(Math.sin(bearing - owner.yaw), Math.cos(bearing - owner.yaw));
      const aligned = Math.abs(error) < expected[0].turn * .05 * .5;
      const input: MsgPlayerInput = {sequence: ++sequence, move: (forwardOnly ? aligned : Math.abs(error) < .15) ? 1 : 0,
        turn: aligned ? 0 : Math.sign(error),
        aim: 0, fire: false, useItem: 0, clientTime: Date.now()};
      const shadow = copied(owner), peers = snapshot.players.map(copied);
      const navOnly = predictBattleMovement(shadow as MovingParticipant, input, field, .05)!;
      const controlled = predictControlledBattleMovement(shadow, input, field, peers, .05)!;
      const navChange = Math.hypot(navOnly.pose.position.x - owner.x, navOnly.pose.position.z - owner.z)
        + Math.abs(Math.atan2(Math.sin(navOnly.yaw - owner.yaw), Math.cos(navOnly.yaw - owner.yaw)));
      assert((await clients[0].sendMsg('PlayerInput', input)).isSucc);
      (evidence.inputs as unknown[]).push({tick: snapshot.tick, input});
      if (controlled.command === 0 && navChange > .005 && (!forwardOnly || input.move === 1)) {
        evidence.refusalPrediction = {snapshot, navOnly, controlled, navChange};
        blockedInput = input;
        break;
      }
      await wait(() => latest().tick > snapshot.tick || latest().phase !== 'PLAYING');
      assert.equal(latest().phase, 'PLAYING');
    }
    assert(blockedInput, 'Ordinary approach must reach dynamic refusal with NAV permitting the input');
    if (forwardOnly) {
      assert.equal(blockedInput.move, 1); assert.equal(blockedInput.turn, 0);
    }
    const refusalTick = latest().tick;
    await wait(() => latest().tick >= refusalTick + 10);
    const refusal = frames[0].filter(frame => frame.snapshot.tick >= refusalTick + 3
      && frame.snapshot.tick <= refusalTick + 10 && frame.snapshot.phase === 'PLAYING');
    assert(refusal.length >= 6);
    const positions = refusal.map(frame => frame.snapshot.players.find(player => player.id === ids[0])!);
    const stable = positions[0];
    assert(positions.every(player => player.x === stable.x && player.z === stable.z
      && player.yaw === stable.yaw && player.bodyYaw === stable.bodyYaw), 'Held input refused without pose commit');
    evidence.refusal = refusal;
    const before = frames[0].at(-1)!, beforePlayer = before.snapshot.players.find(player => player.id === ids[0])!;
    const reverse: MsgPlayerInput = {sequence: ++sequence, move: -1, turn: 0,
      aim: 1, fire: true, useItem: 0, clientTime: Date.now()};
    assert((await clients[0].sendMsg('PlayerInput', reverse)).isSucc);
    (evidence.inputs as unknown[]).push({tick: before.snapshot.tick, input: reverse});
    await wait(() => latest().tick >= before.snapshot.tick + 10);
    assert((await clients[0].sendMsg('PlayerInput', {sequence: ++sequence, move: 0, turn: 0,
      aim: 0, fire: false, useItem: 0, clientTime: Date.now()})).isSucc);
    const after = frames[0].at(-1)!, afterPlayer = after.snapshot.players.find(player => player.id === ids[0])!;
    const distance = Math.hypot(afterPlayer.x - beforePlayer.x, afterPlayer.z - beforePlayer.z);
    assert(distance > 1, 'Ordinary reverse clears the dynamic refusal');
    assert(Math.abs(afterPlayer.aim - beforePlayer.aim) > .05, 'Turret input remains independent');
    assert(events[0].some(event => event.type === 'fire' && event.playerId === ids[0]));
    evidence.reverse = {before, after, distance, simulationSeconds: (after.snapshot.tick - before.snapshot.tick) * .05,
      serverSeconds: (after.snapshot.serverTime - before.snapshot.serverTime) / 1000,
      wallSeconds: (after.wallTime - before.wallTime) / 1000};
    }
    const common = frames[0].filter(a => a.snapshot.roomId === host.res.room.id && a.snapshot.phase === 'PLAYING'
      && frames[3].some(b => b.snapshot.roomId === a.snapshot.roomId && b.snapshot.tick === a.snapshot.tick));
    assert(common.length >= 15);
    for (const a of common) {
      const b = frames[3].find(b => b.snapshot.roomId === a.snapshot.roomId && b.snapshot.tick === a.snapshot.tick)!;
      assert.deepEqual(a.snapshot.players, b.snapshot.players);
    }
    evidence.commonTicks = common.length;
    const leaves = [];
    for (const client of clients) {
      const response = await client.callApi('Leave', {roomId: host.res.room.id, round: 1});
      leaves.push(response); assert(response.isSucc);
    }
    evidence.leaves = leaves; evidence.accountIds = accountIds;
    evidence.status = autopilotExitOnly ? 'PASS_PURCHASED_AUTOPILOT_EXIT' : autopilotOnly ? 'PASS_PURCHASED_AUTOPILOT_MOVEMENT'
      : forwardOnly ? 'PASS_PURCHASED_DYNAMIC_FORWARD_CONTACT' : 'PASS_PURCHASED_DYNAMIC_MOVEMENT';
  } catch (error) {
    evidence.status = 'FAIL'; evidence.error = String(error); throw error;
  } finally {
    for (const client of clients) await client.disconnect();
    if (server.exitCode === null) {
      const ended = new Promise(resolve => server.once('exit', resolve)); server.kill(); await ended;
    }
    rmSync(directory, {recursive: true, force: true});
    evidence.frames = frames; evidence.events = events; evidence.cleaned = true;
    writeFileSync(`${prefix}.json`, JSON.stringify(evidence, null, 2)); writeFileSync(`${prefix}.log`, log);
    console.log(prefix);
  }
}
main().catch(error => {console.error(error); process.exitCode = 1;});
