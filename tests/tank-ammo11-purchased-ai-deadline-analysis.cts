import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import type {MsgRoomSnapshot, MsgRoomEvent} from '../apps/shared/protocols';
import {TANKS} from '../apps/server/src/config';
import {combatSkills, combatItemSkills, combatLimits} from '../apps/server/src/battle/catalog';
import {recomputeRoleAmmo} from '../apps/server/src/battle/roles/recompute-ammo';

interface Frame {snapshot: MsgRoomSnapshot; wallTime: number;}
interface Raw {
  status: string;
  source: {tankFields: [number, number][]; ordinary: ReturnType<typeof recomputeRoleAmmo>;
    special: ReturnType<typeof recomputeRoleAmmo>};
  frames: Frame[][];
  events: MsgRoomEvent[][];
  clientPlayerInputCount: number;
  leave: {isSucc: boolean}[];
}
const rawPath = 'recovery/output/tank-ammo11-purchased-ai-network-2026-10-05T04-27-49-730Z.json';
const raw = JSON.parse(readFileSync(rawPath, 'utf8')) as Raw;
assert(raw.status.startsWith('PASS_'));
assert.equal(raw.clientPlayerInputCount, 0);
assert(raw.leave.length === 2 && raw.leave.every(result => result.isSucc));
const fields = new Map(raw.source.tankFields);
const tank = TANKS.find(row => row.id === fields.get(0x24)); assert(tank);
const oracle = (ammoId: number) => recomputeRoleAmmo({tank: tank.recomputeBase,
  sources: {currentSkillIds: combatItemSkills.get(ammoId)!.skillIds,
    extraSkill: {baseId: 0, rank: 0},
    itemIds: [0x58, 0x5c, 0x60].map(offset => {assert(fields.has(offset)); return fields.get(offset)!;})},
  skills: combatSkills, items: combatItemSkills, limits: combatLimits, roleValue9: 0});
assert.deepEqual(oracle(2001), raw.source.ordinary);
assert.deepEqual(oracle(2011), raw.source.special);
const special = raw.source.special; assert(special);
const fires = raw.events[0].filter(event => event.type === 'fire');
const targetId = fires[0].playerId;
const player = (frame: Frame) => frame.snapshot.players.find(row => row.id === targetId)!;
const frames = raw.frames[0].filter(frame => frame.snapshot.phase === 'PLAYING');
const shots: Frame[] = [];
let previousStart = 0;
for (const frame of frames) {
  const start = player(frame).reload?.startedAt ?? 0;
  if (start && start !== previousStart) {shots.push(frame); previousStart = start;}
}
assert.equal(shots.length, 3);
const [first, last, ordinary] = shots;
assert.equal(player(first).ammoItemId, 2011);
assert.equal(player(first).ammoMagazine?.remaining, 1);
assert.equal(player(last).ammoItemId, 2011);
assert.equal(player(last).ammoMagazine?.remaining, 0);
assert.equal(player(first).reload?.duration, special.normalSeconds);
assert.equal(player(last).reload?.duration, special.lastBulletSeconds);
assert.equal(player(ordinary).ammoItemId, 2001);
assert.equal(player(ordinary).ammoMagazine?.remaining, special.capacity - 1);
const normalDeadline = player(first).reload!.startedAt + special.normalSeconds * 1000;
const lastDeadline = player(last).reload!.startedAt + special.lastBulletSeconds * 1000;
const normalEligible = frames.find(frame => frame.snapshot.serverTime >= normalDeadline)!;
const lastEligible = frames.find(frame => frame.snapshot.serverTime >= lastDeadline)!;
assert(normalEligible && lastEligible);
assert.equal(last.snapshot.tick, normalEligible.snapshot.tick);
assert(ordinary.snapshot.serverTime >= lastDeadline);
assert.equal(player(lastEligible).reload?.startedAt, player(last).reload?.startedAt);
assert.equal(player(lastEligible).reload?.remaining, 0);
assert.equal(player(lastEligible).ammoItemId, 2001);
assert.equal(player(lastEligible).ammoMagazine?.remaining, special.capacity);
for (const frame of frames.filter(frame => frame.snapshot.tick >= last.snapshot.tick
    && frame.snapshot.tick < ordinary.snapshot.tick)) {
  assert.equal(player(frame).reload?.startedAt, player(last).reload?.startedAt);
  assert.equal(player(frame).reload?.duration, special.lastBulletSeconds);
}
const elapsed = (a: Frame, b: Frame) => ({simulationSeconds: (b.snapshot.tick - a.snapshot.tick) * .05,
  serverSeconds: (b.snapshot.serverTime - a.snapshot.serverTime) / 1000,
  wallSeconds: (b.wallTime - a.wallTime) / 1000});
const key = (frame: Frame) => `${frame.snapshot.roomId}/${frame.snapshot.phase}/${frame.snapshot.tick}`;
const peers = new Map(raw.frames[1].map(frame => [key(frame), frame]));
const common = frames.filter(frame => peers.has(key(frame)));
for (const frame of common) assert.deepEqual(frame.snapshot.players, peers.get(key(frame))!.snapshot.players);
const core = (events: MsgRoomEvent[]) => events.filter(event => event.playerId === targetId
  && ['fire', 'ammoConsumed'].includes(event.type));
assert.deepEqual(core(raw.events[0]), core(raw.events[1]));
assert.deepEqual(fires.map(event => event.skillId), [2011, 2011, 2001]);
const describe = (frame: Frame) => ({tick: frame.snapshot.tick, serverTime: frame.snapshot.serverTime,
  wallTime: frame.wallTime, player: player(frame)});
const result = {status: 'PASS_EXISTING_PURCHASED_AI_AMMO11_NORMAL_LAST_DEADLINE_PENDING_MAIN_REVIEW',
  tasks: ['M2-02'], raw: rawPath, analyzer: 'tests/tank-ammo11-purchased-ai-deadline-analysis.cts',
  scope: 'Existing real BUY2011 Autopilot raw, first independent normal/last deadline analysis only; no new network run.',
  source: raw.source, shots: shots.map(describe), normalDeadline, lastDeadline,
  normal: {firstEligible: describe(normalEligible), elapsed: elapsed(first, last), lateMs: last.snapshot.serverTime - normalDeadline},
  last: {firstEligible: describe(lastEligible), elapsed: elapsed(last, ordinary), lateMs: ordinary.snapshot.serverTime - lastDeadline,
    ordinaryFireAfterEligible: elapsed(lastEligible, ordinary)},
  completePlayersObservations: common.length, commonUniqueKeys: new Set(common.map(key)).size,
  coreEvents: core(raw.events[0]), leaveReuse: raw.leave,
  limits: ['Tick206 becomes eligible and automatically returns ordinary without firing; tick207 autonomous fire is later.',
    'No generated AI command log; extra tick cannot establish the exact controller decision cause.',
    'Snapshot wall time is receipt observation, not server execution or real-time upper-bound performance.',
    'Original server finite inventory projection/selection is reconstructed; original count==1 last decision reused.',
    'Existing source/AI policy/BUY/FX/lifecycle/persistence reused without repetition.']};
writeFileSync('recovery/output/tank-ammo11-purchased-ai-deadline-analysis.json', JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({status: result.status, normal: result.normal.elapsed, last: result.last.elapsed,
  normalLateMs: result.normal.lateMs, lastLateMs: result.last.lateMs, common: common.length}));
