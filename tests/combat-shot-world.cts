import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {TSBuffer} from 'tsbuffer';
import {World} from '../apps/server/src/world';
import {createRoleFreeAim} from '../apps/server/src/battle/roles/free-aim';
import {serviceProto} from '../apps/shared/protocols/serviceProto';
import type {MsgRoomEvent} from '../apps/shared/protocols/MsgRoomEvent';

// Accepted ordinary inputs must carry the source endpoint through the real wire schema.
let clock = 100000;
const world = new World(() => clock);
const joined = world.createAndJoin('shot-wire', 4, 7, 'Shot', 'Player', 1);
world.ready(joined.playerId, 1);
const player = () => world.snapshot(joined.roomId)!.players.find(value => value.id === joined.playerId)!;
world.updateInput(joined.playerId, {sequence: 1, move: 0, turn: 0, aim: 0,
  fire: true, useItem: 0, clientTime: clock});
clock += 50;
const accepted = world.step(50).events.filter(event => event.type === 'fire');
assert.equal(accepted.length, 1);
const fire = accepted[0];
const after = player();
const endpoint = createRoleFreeAim(fire,
  {x: Math.sin(after.yaw + after.aim), y: 0, z: Math.cos(after.yaw + after.aim)}, clock / 1000);
assert(fire.shotDisplay);
assert.equal(fire.shotDisplay.itemId, 2001);
// Public snapshots round yaw to four decimals; their projected1000-unit endpoint
// is therefore an observation bound, while the payload itself retains exact f32.
for (const axis of ['x', 'y', 'z'] as const) {
  if (!fire.targetId) assert(Math.abs(fire.shotDisplay[axis] - endpoint[axis]) < 0.11);
  assert.equal(fire.shotDisplay[axis], Math.fround(fire.shotDisplay[axis]));
}
if (fire.targetId) assert.equal(fire.shotDisplay.y, 25);
assert.notDeepEqual([fire.shotDisplay.x, fire.shotDisplay.y, fire.shotDisplay.z], [fire.x, fire.y, fire.z]);
const codec = new TSBuffer(serviceProto.types);
const encoded = codec.encode(fire, 'MsgRoomEvent/MsgRoomEvent');
assert(encoded.isSucc, JSON.stringify(encoded));
const decoded = codec.decode<MsgRoomEvent>(encoded.buf, 'MsgRoomEvent/MsgRoomEvent');
assert(decoded.isSucc, JSON.stringify(decoded));
assert.deepEqual(decoded.value, fire);
// The old optional payload remains valid on unrelated events.
const plain = {...fire, type: 'hit', shotDisplay: undefined};
const plainEncoded = codec.encode(plain, 'MsgRoomEvent/MsgRoomEvent');
assert(plainEncoded.isSucc);
const plainDecoded = codec.decode<MsgRoomEvent>(plainEncoded.buf, 'MsgRoomEvent/MsgRoomEvent');
assert(plainDecoded.isSucc);
assert.equal(plainDecoded.value.shotDisplay, undefined);
clock += 50;
assert.equal(world.step(50).events.filter(event => event.type === 'fire').length, 0,
  'Reload rejection cannot produce another display');
world.leave(joined.playerId);
// Autonomous participants reach scene/player/free branches through ordinary inputs.
const battle = new World(() => clock);
const match = battle.createAndJoin('target-branches', 4, 7, 'Targets', 'AI player', 1);
for (let i = 0; i < 3; i++) battle.manageCpu(match.playerId, 1, 'ADD', 1);
battle.configureAutopilot(match.playerId, 1, true);
battle.ready(match.playerId, 1);
const branches = {FREE: fire.targetId ? 0 : 1, PLAYER: 0, SCENE: fire.targetId ? 1 : 0};
const samples: MsgRoomEvent[] = [fire];
for (let tick = 0; tick < 3000; tick++) {
  clock += 50;
  for (const event of battle.step(50).events.filter(event => event.type === 'fire')) {
    const kind = !event.shotDisplay ? 'PLAYER' : event.targetId ? 'SCENE' : 'FREE';
    branches[kind]++;
    if (!samples.some(sample => (!sample.shotDisplay ? 'PLAYER' : sample.targetId ? 'SCENE' : 'FREE') === kind)) samples.push(event);
    if (kind === 'PLAYER') assert(event.targetId.startsWith('P'));
    if (kind === 'SCENE') assert.equal(event.shotDisplay!.y, 25);
    const wire = codec.encode(event, 'MsgRoomEvent/MsgRoomEvent');
    assert(wire.isSucc);
    const received = codec.decode<MsgRoomEvent>(wire.buf, 'MsgRoomEvent/MsgRoomEvent');
    assert(received.isSucc);
    const expected = {...event};
    if (!expected.shotDisplay) delete expected.shotDisplay;
    assert.deepEqual(received.value, expected);
  }
  if (battle.snapshot(match.roomId)!.phase === 'FINISHED') break;
}
assert(branches.PLAYER > 0 && branches.SCENE > 0, JSON.stringify(branches));
battle.leave(match.playerId);
writeFileSync('recovery/output/combat-shot-target-world.json', JSON.stringify({status: 'PASS',
  scope: 'Ordinary World PlayerInput accepted fire, free/scene endpoint, wire roundtrip, optional player/unrelated event and reload rejection; natural CPU target branches. Query geometry remains rebuilt.',
  branches, samples, fire, wireBytes: encoded.buf.length}, null, 2) + '\n');
console.log('PASS: ordinary accepted shot publishes target-qualified display through the generated wire schema');
