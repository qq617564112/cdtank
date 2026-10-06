import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import type {MsgRoomSnapshot, MsgRoomEvent} from '../apps/shared/protocols';

const source = process.argv[2];
assert(source, 'Pass the preserved raw network path');
const raw = JSON.parse(readFileSync(source, 'utf8')) as {
  status: string; cleaned: boolean; frames: MsgRoomSnapshot[][]; events: MsgRoomEvent[][];
  received: {page: number; tick: number; serverTime: number; wallTime: number}[];
  expected: {capacity: number; normalSeconds: number; lastBulletSeconds: number; selectedSkillIds: number[]};
};
assert.equal(raw.status, 'FAIL');
assert(raw.cleaned);
assert(raw.expected.selectedSkillIds.includes(13081));
const fires = raw.events[0].filter(event => event.type === 'fire' && event.skillId === 2001);
assert.equal(fires.length, raw.expected.capacity + 1);
const id = fires[0].playerId;
assert(fires.every(event => event.playerId === id));
const changes: {tick: number; serverTime: number; wallTime: number; remaining: number; duration: number}[] = [];
let previous = raw.expected.capacity;
for (const snapshot of raw.frames[0].filter(snapshot => snapshot.phase === 'PLAYING')) {
  const player = snapshot.players.find(player => player.id === id)!;
  assert.equal(player.tankId, 3); assert.equal(player.petId, undefined);
  assert.equal(player.ammoMagazine!.capacity, raw.expected.capacity);
  if (player.ammoMagazine!.remaining !== previous) {
    changes.push({tick: snapshot.tick, serverTime: snapshot.serverTime,
      wallTime: raw.received.find(sample => sample.page === 0 && sample.tick === snapshot.tick)!.wallTime,
      remaining: player.ammoMagazine!.remaining, duration: player.reload!.duration});
    previous = player.ammoMagazine!.remaining;
  }
}
assert.deepEqual(changes.map(change => change.remaining), [6, 5, 4, 3, 2, 1, 0, 6]);
const intervals = changes.slice(1).map((change, index) => {
  const before = changes[index];
  const expected = before.remaining === 0 ? raw.expected.lastBulletSeconds : raw.expected.normalSeconds;
  const simulationSeconds = (change.tick - before.tick) * .05;
  const serverSeconds = (change.serverTime - before.serverTime) / 1000;
  const wallSeconds = (change.wallTime - before.wallTime) / 1000;
  assert(simulationSeconds >= expected - .06 && simulationSeconds <= expected + .12);
  assert(serverSeconds >= expected - .001);
  return {simulationSeconds, serverSeconds, wallSeconds, expected};
});
for (const change of changes) {
  assert.equal(change.duration, change.remaining === 0 ? raw.expected.lastBulletSeconds : raw.expected.normalSeconds);
}
const common = raw.frames[0].filter(a => a.phase === 'PLAYING' && raw.frames[1].some(b =>
  b.roomId === a.roomId && b.tick === a.tick && b.phase === a.phase));
for (const a of common) {
  const b = raw.frames[1].find(b => b.roomId === a.roomId && b.tick === a.tick && b.phase === a.phase)!;
  assert.deepEqual(a.players, b.players);
}
assert(common.length > 200);
assert.deepEqual(raw.events[1].filter(event => event.type === 'fire' && event.playerId === id), fires);
const analysis = {status: 'PASS_INSTALLED_DELAY_CONSUMER', source, rawStatus: raw.status,
  expected: raw.expected, changes, intervals, commonTicks: common.length, sameTickRefillAndHeldFire: true,
  cleaned: raw.cleaned,
  scope: 'Actual purchase/equip source, first magazine finite consumption, normal intervals and last-round refill plus held fire, dual snapshots/events. Full-capacity intermediate not published. No post-run persisted stock read or normal Leave reached; disconnect cleanup only. Original raw FAIL preserved.'};
writeFileSync(source.replace(/\.json$/, '-analysis.json'), JSON.stringify(analysis, null, 2) + '\n');
console.log(`PASS: installed Delay consumer; ${common.length} common ticks, ordinary and last intervals; original raw FAIL retained`);
