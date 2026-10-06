import {strict as assert} from 'node:assert';
import {spawn} from 'node:child_process';
import {WsClient} from 'tsrpc';
import {serviceProto} from '../apps/shared/protocols/serviceProto';
import type {MsgRoomSnapshot} from '../apps/shared/protocols/MsgRoomSnapshot';
import type {MsgRoomEvent} from '../apps/shared/protocols/MsgRoomEvent';

async function main(): Promise<void> {
  const port = 3109;
  const server = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/index.ts'], {
    env: {...process.env, PORT: String(port), MATCH_MIN_PLAYERS: '2'}, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  const clients = Array.from({length: 3}, () => new WsClient(serviceProto, {
    server: `ws://127.0.0.1:${port}`, logger: undefined,
  }));
  const snapshots: MsgRoomSnapshot[][] = clients.map(() => []);
  const events: MsgRoomEvent[][] = clients.map(() => []);
  clients.forEach((client, index) => client.listenMsg('RoomEvent', message => {
    events[index].push(message);
  }));
  clients.forEach((client, index) => client.listenMsg('RoomSnapshot', message => {
    snapshots[index].push(message);
  }));
  const waitUntil = (condition: () => boolean): Promise<void> => new Promise((resolve, reject) => {
    const deadline = Date.now() + 8000;
    const timer = setInterval(() => {
      if (condition()) {
        clearInterval(timer);
        resolve();
      } else if (Date.now() >= deadline) {
        clearInterval(timer);
        reject(new Error(`Network test timeout\n${log}`));
      }
    }, 20);
  });
  server.stdout.on('data', chunk => {log += String(chunk);});
  server.stderr.on('data', chunk => {log += String(chunk);});
  try {
    await waitUntil(() => log.includes(`Server started at ${port}.`));
    for (const client of clients) {
      assert.equal((await client.connect()).isSucc, true);
    }
    const cpuRoom = await clients[0].callApi('CreateRoom', {mode: 1, mapId: 7,
      roomName: 'CPU password room', name: 'Owner', tankId: 1, password: 'cpu-pass'});
    assert(cpuRoom.isSucc);
    const cpu = await clients[0].callApi('Cpu', {round: 1, operation: 'ADD', tankId: 105});
    assert(cpu.isSucc);
    await waitUntil(() => snapshots[0].some(s => s.roomId === cpuRoom.res.room.id
      && s.players.some(p => p.id === cpu.res.playerId && p.isCpu)));
    const guest = await clients[1].callApi('Join', {roomId: cpuRoom.res.room.id,
      name: 'Guest', tankId: 1, clientId: '', password: 'cpu-pass'});
    assert(guest.isSucc);
    assert(!(await clients[1].callApi('Cpu', {round: 1, operation: 'ADD', tankId: 1})).isSucc);
    assert(!(await clients[0].callApi('Cpu', {round: 0, operation: 'REMOVE', playerId: cpu.res.playerId})).isSucc);
    assert((await clients[0].callApi('Cpu', {round: 1, operation: 'REMOVE', playerId: cpu.res.playerId})).isSucc);
    await waitUntil(() => snapshots[0].at(-1)?.roomId === cpuRoom.res.room.id
      && snapshots[0].at(-1)?.players.length === 2);
    await clients[0].disconnect(); await clients[1].disconnect();
    assert((await clients[0].connect()).isSucc); assert((await clients[1].connect()).isSucc);
    snapshots.forEach(values => {values.length = 0;});
    events.forEach(values => {values.length = 0;});
    const rooms = await clients[0].callApi('ListRooms', {});
    assert(rooms.isSucc);
    const [first, second] = rooms.res.rooms;
    assert(first && second);
    const join = async (index: number, roomId: string) => {
      const result = await clients[index].callApi('Join', {
        clientId: 'same-untrusted-client-id', name: `Tester${index}`, tankId: 1, roomId,
      });
      assert(result.isSucc);
      return result.res;
    };
    const a = await join(0, first.id);
    const b = await join(1, first.id);
    const c = await join(2, second.id);
    const chatCount = (index: number) => events[index].filter(event => event.type === 'chat').length;
    await clients[0].sendMsg('Chat', {channel: 0, text: '  集合进攻 <b>中文</b>  '});
    await waitUntil(() => chatCount(0) === 1 && chatCount(1) === 1);
    assert.equal(chatCount(2), 0, 'Chat must stay within its room');
    const chat = events[1].find(event => event.type === 'chat')!;
    assert.equal(chat.playerId, a.playerId);
    assert.equal(chat.message, 'Tester0: 集合进攻 <b>中文</b>');
    for (const message of [{channel: 1, text: 'unsupported'}, {channel: 0, text: '   '},
      {channel: 0, text: 'fake\nname'}, {channel: 0, text: 'x'.repeat(101)}]) {
      await clients[0].sendMsg('Chat', message);
    }
    await clients[0].sendMsg('Chat', {channel: 0, text: '结束校验'});
    await waitUntil(() => chatCount(1) === 2);
    assert.equal(chatCount(0), 2);
    assert.equal(chatCount(2), 0);
    assert.equal((await clients[1].callApi('ChangeTeam', {round: 1, team: 0})).isSucc, true);
    await waitUntil(() => snapshots[0].some(snapshot => snapshot.players.find(player => player.id === b.playerId)?.team === 0));
    assert.equal((await clients[1].callApi('ChangeTeam', {round: 1, team: 2})).isSucc, false);
    assert.equal((await clients[1].callApi('ChangeTeam', {round: 1, team: 1})).isSucc, true);
    assert.equal((await clients[0].callApi('Ready', {round: 1})).isSucc, true);
    assert.equal((await clients[0].callApi('Ready', {round: 1, isReady: false})).isSucc, true);
    await waitUntil(() => snapshots[0].some(snapshot => snapshot.match?.readyPlayerIds.length === 0));
    assert.equal((await clients[0].callApi('Ready', {round: 1, isReady: true})).isSucc, true);
    assert.equal((await clients[1].callApi('Ready', {round: 1})).isSucc, true);
    assert.equal((await clients[1].callApi('ChangeTeam', {round: 1, team: 0})).isSucc, false);
    assert.equal((await clients[0].callApi('Ready', {round: 1, isReady: false})).isSucc, false);
    assert.notEqual(a.playerId, b.playerId, 'Connection identity must not use client-supplied ID');
    assert.notEqual(b.playerId, c.playerId);
    assert.equal((await join(0, first.id)).playerId, a.playerId, 'Repeated join should reuse this connection');
    await waitUntil(() => snapshots.every(list => list.length > 2));
    assert(snapshots[0].every(snapshot => snapshot.roomId === first.id));
    assert(snapshots[0].every(snapshot => snapshot.mode === a.room.mode));
    assert(snapshots[1].every(snapshot => snapshot.roomId === first.id));
    assert(snapshots[2].every(snapshot => snapshot.roomId === second.id));
    assert(snapshots[2].every(snapshot => snapshot.mode === c.room.mode));
    const latest = (index: number) => snapshots[index][snapshots[index].length - 1];
    const initial = latest(1).players.find(player => player.id === a.playerId)!;
    assert(initial);
    const startTick = latest(1).tick;
    assert.equal((await clients[0].sendMsg('PlayerInput', {
      sequence: 1, move: 1, turn: 0, aim: 0, fire: true, useItem: 1, clientTime: Date.now(),
    })).isSucc, true);
    await waitUntil(() => latest(1).tick >= startTick + 5 && latest(1).bullets.length > 0);
    await waitUntil(() => events[0].some(event => event.type === 'fire'));
    assert(events[0].filter(event => event.type === 'fire').every(event => event.skillId === 2001));
    await waitUntil(() => snapshots[0].some(first => first.roomId === a.room.id
      && first.tick > startTick && snapshots[1].some(second => second.tick === first.tick
        && second.roomId === first.roomId && first.players.find(player => player.id === a.playerId)?.reload?.remaining! > 0)));
    const pair = snapshots[0].find(first => first.roomId === a.room.id && first.tick > startTick
      && first.players.find(player => player.id === a.playerId)?.reload?.remaining! > 0
      && snapshots[1].some(second => second.roomId === first.roomId && second.tick === first.tick))!;
    const peer = snapshots[1].find(second => second.roomId === pair.roomId && second.tick === pair.tick)!;
    assert.deepEqual(pair.players.find(player => player.id === a.playerId)!.reload,
      peer.players.find(player => player.id === a.playerId)!.reload);
    assert.equal(peer.players.find(player => player.id === a.playerId)!.reload!.source, 'rebuilt');
    const moved = latest(1).players.find(player => player.id === a.playerId)!;
    assert.equal(moved.selectedAmmoSlot, 1, 'The remote peer must receive default-ammo selection from the same normal input');
    assert.equal(latest(0).players.find(player => player.id === a.playerId)!.selectedAmmoSlot, 1);
    assert.equal(latest(1).players.find(player => player.id === b.playerId)!.selectedAmmoSlot, 1);
    assert((moved.x-initial.x)*Math.sin(initial.yaw)+(moved.z-initial.z)*Math.cos(initial.yaw)>1, 'Another connection must see authoritative forward movement');
    assert(Math.abs(initial.x)>260 || Math.abs(initial.z)>260, 'Use source map spawn rather than prototype arena');
    assert.equal((await clients[0].sendMsg('PlayerInput', {
      sequence: 2, move: 0, turn: 0, aim: 0, fire: false, useItem: 2, clientTime: Date.now(),
    })).isSucc, true);
    const stopTick = latest(1).tick;
    await waitUntil(() => latest(1).tick >= stopTick + 2);
    const stopPosition = latest(1).players.find(player => player.id === a.playerId)!.z;
    assert.equal(latest(1).players.find(player => player.id === a.playerId)!.selectedAmmoSlot, 1,
      'A shortcut without owned inventory must preserve the selected ammo');
    assert.equal((await clients[0].sendMsg('PlayerInput', {
      sequence: 1, move: 1, turn: 0, aim: 0, fire: true, useItem: 0, clientTime: Date.now(),
    })).isSucc, true);
    const replayTick = latest(1).tick;
    await waitUntil(() => latest(1).tick >= replayTick + 3);
    assert.equal(latest(1).players.find(player => player.id === a.playerId)!.z, stopPosition);
    assert.equal((await clients[0].sendMsg('PlayerAction', {sequence: 3, action: 1, value: 999, clientTime: Date.now()})).isSucc, true);
    const scoreTick = latest(1).tick;
    await waitUntil(() => latest(1).tick >= scoreTick + 2);
    assert.equal(latest(1).players.find(player => player.id === a.playerId)!.score, 0);
    clients[0].disconnect();
    await waitUntil(() => !latest(1).players.some(player => player.id === a.playerId));
    assert.equal(latest(1).phase, 'FINISHED');
    assert.equal(latest(1).match!.result!.reason, 'FORFEIT');
    assert.equal(latest(1).match!.result!.players.length, 2, 'Settlement retains the departed player');
    assert.equal((await clients[0].connect()).isSucc, true);
    const replacement = await join(0, first.id);
    assert.notEqual(replacement.playerId, a.playerId);
    assert.equal((await clients[0].callApi('Rematch', {round: 2})).isSucc, false);
    assert.equal((await clients[0].callApi('Ready', {round: 1})).isSucc, false);
    assert.equal((await clients[0].callApi('Rematch', {round: 1})).isSucc, true);
    assert.equal((await clients[0].callApi('Rematch', {round: 1})).isSucc, true);
    await waitUntil(() => latest(1).match!.rematchPlayerIds.length === 1);
    assert.equal(latest(1).phase, 'FINISHED');
    const restarted = await clients[1].callApi('Rematch', {round: 1});
    assert(restarted.isSucc);
    assert.equal(restarted.res.round, 2);
    await waitUntil(() => latest(1).phase === 'PLAYING' && latest(1).match!.round === 2);
    assert.equal(latest(1).match!.result, undefined);
    assert(latest(1).players.every(player => player.alive && player.hp === player.maxHp && player.score === 0));
    assert(latest(1).players.every(player => player.reload?.remaining === 0 && player.reload.startedAt === 0));
    assert.equal((await clients[1].callApi('Rematch', {round: 1})).isSucc, false);
    for (const mode of [3, 4, 5]) {
      const room = rooms.res.rooms.find(room => room.mode === mode)!;
      assert(room);
      await clients[2].disconnect();
      assert.equal((await clients[2].connect()).isSucc, true);
      snapshots[2].length = 0;
      const joined = await join(2, room.id);
      assert.equal(joined.room.mode, mode);
      await waitUntil(() => snapshots[2].some(snapshot => snapshot.roomId === room.id));
      assert(snapshots[2].filter(snapshot => snapshot.roomId === room.id).every(snapshot => snapshot.mode === mode));
    }
    await clients[2].disconnect();
    assert.equal((await clients[2].connect()).isSucc, true);
    const catalog = await clients[2].callApi('ListMaps', {});
    assert(catalog.isSucc);
    assert.equal(catalog.res.maps.length, 26);
    assert.equal((await clients[2].callApi('CreateRoom', {
      mode: 5, mapId: 2, roomName: '非法组合', name: 'Creator', tankId: 1,
    })).isSucc, false);
    const request = {mode: 1, mapId: 4, roomName: '早安联机', name: 'Creator', tankId: 1, password: 'join-secret'};
    const created = await clients[2].callApi('CreateRoom', request);
    assert(created.isSucc);
    assert.equal(created.res.room.mapId, 4);
    assert.equal(created.res.room.mode, 1);
    const repeat = await clients[2].callApi('CreateRoom', request);
    assert(repeat.isSucc);
    assert.equal(repeat.res.room.id, created.res.room.id);
    assert.equal(repeat.res.playerId, created.res.playerId);
    const listed = await clients[2].callApi('ListRooms', {});
    assert(listed.isSucc);
    assert.equal(listed.res.rooms.find(room => room.id === created.res.room.id)!.playerCount, 1);
    assert.equal(listed.res.rooms.find(room => room.id === created.res.room.id)!.hasPassword, true);
    assert(!JSON.stringify(listed.res).includes(request.password));
    const rejected = await clients[0].callApi('Join', {clientId: '', name: 'Guest', tankId: 1,
      roomId: created.res.room.id, password: 'wrong'});
    assert.equal(rejected.isSucc, false);
    if (!rejected.isSucc) assert.equal(rejected.err.code, 'ROOM_JOIN_REJECTED');
    const accepted = await clients[0].callApi('Join', {clientId: '', name: 'Guest', tankId: 1,
      roomId: created.res.room.id, password: request.password});
    assert(accepted.isSucc);
    assert.equal(accepted.res.room.id, created.res.room.id);
    await waitUntil(() => snapshots[2].some(snapshot => snapshot.roomId === created.res.room.id));
    console.log('PASS: room chat identity/isolation/validation, independent identities, room isolation, ready, movement/fire, stale inputs, score ownership, forfeit, idempotent consensus rematch and round conflict errors');
  } finally {
    for (const client of clients) {
      client.disconnect();
    }
    server.kill('SIGTERM');
  }
}

main().catch(error => {console.error(error); process.exitCode = 1;});
