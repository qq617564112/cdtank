import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {TANKS} from '../apps/server/src/config';
import {combatSkills, combatItemSkills, combatLimits} from '../apps/server/src/battle/catalog';
import {recomputeRoleAmmo} from '../apps/server/src/battle/roles/recompute-ammo';
import type {MsgRoomSnapshot, MsgRoomEvent} from '../apps/shared/protocols';

const raw = 'recovery/output/ammo-stock-purchase-network-2026-10-04T19-13-58-728Z.json';
const run = JSON.parse(readFileSync(raw, 'utf8'));
assert.equal(run.status, 'PASS');
const fields = new Map<number, number>(run.purchases[0].tank.purchased.fields);
assert.equal(fields.get(0x24), 3);
assert([0x58, 0x5c, 0x60].every(offset => fields.has(offset)));
const tank = TANKS.find(row => row.id === 3)!;
const result = recomputeRoleAmmo({tank: tank.recomputeBase,
  sources: {currentSkillIds: combatItemSkills.get(2002)!.skillIds,
    extraSkill: {baseId: 0, rank: 0}, itemIds: [0x58, 0x5c, 0x60].map(offset => fields.get(offset)!)},
  skills: combatSkills, items: combatItemSkills, limits: combatLimits, roleValue9: 0})!;
assert.equal(result.capacity, 7); assert.equal(result.normalSeconds, 2.1000001430511475); assert.equal(result.lastBulletSeconds, 6.300000190734863);
const frames = (run.snapshots[0] as MsgRoomSnapshot[]).filter(frame => frame.match?.round === 1 && frame.phase === 'PLAYING');
const playerId = frames[0].players.find(row => row.ammoSlots?.some(slot => slot.itemTableId === 2002))!.id;
const player = (frame: MsgRoomSnapshot) => frame.players.find(row => row.id === playerId)!;
const selected = frames.find(frame => player(frame).ammoItemId === 2002)!;
assert.deepEqual(player(selected).ammoMagazine, {remaining: 2, capacity: 7});
const shots = frames.filter((frame, i) => player(frame).ammoItemId === 2002
  && player(frame).reload!.startedAt > 0
  && (i === 0 || player(frame).reload!.startedAt !== player(frames[i - 1]).reload!.startedAt));
assert.equal(shots.length, 2);
assert.equal(player(shots[0]).reload!.duration, result.normalSeconds);
assert.equal(player(shots[1]).reload!.duration, result.lastBulletSeconds);
assert.deepEqual(player(shots[0]).ammoMagazine, {remaining: 1, capacity: 7});
assert.deepEqual(player(shots[1]).ammoMagazine, {remaining: 0, capacity: 7});
const firstDeadline = player(shots[0]).reload!.startedAt + result.normalSeconds * 1000;
assert(player(shots[1]).reload!.startedAt >= firstDeadline);
assert(!frames.some(frame => frame.tick > shots[0].tick && frame.tick < shots[1].tick && frame.serverTime >= firstDeadline));
const lastDeadline = player(shots[1]).reload!.startedAt + result.lastBulletSeconds * 1000;
const returned = frames.find(frame => frame.tick > shots[1].tick && player(frame).ammoItemId === 2001)!;
assert(returned.serverTime >= lastDeadline);
assert(!frames.some(frame => frame.tick > shots[1].tick && frame.tick < returned.tick && frame.serverTime >= lastDeadline));
assert.equal(player(returned).reload!.startedAt, player(shots[1]).reload!.startedAt);
const other = new Map((run.snapshots[1] as MsgRoomSnapshot[]).filter(frame => frame.match?.round === 1 && frame.phase === 'PLAYING').map(frame => [frame.tick, frame]));
const common = frames.filter(frame => other.has(frame.tick));
for (const frame of common) assert.deepEqual(frame.players, other.get(frame.tick)!.players);
const core = (rows: MsgRoomEvent[]) => rows.filter(e => e.playerId === playerId && e.skillId === 2002 && ['fire', 'ammoConsumed'].includes(e.type));
assert.equal(core(run.events[0]).length, 4); assert.deepEqual(core(run.events[0]), core(run.events[1]));
const summary = (frame: MsgRoomSnapshot) => ({tick: frame.tick, serverTime: frame.serverTime, player: player(frame)});
writeFileSync('recovery/output/tank-ammo02-existing-deadline-analysis.json', JSON.stringify({
  status: 'PASS_LIMITED_EXISTING_PURCHASED2002_CAPACITY_DEADLINE_SCOPE', raw,
  source: {tankId: 3, fields: [...fields], tankBase: tank.recomputeBase,
    skillIds: combatItemSkills.get(2002)!.skillIds, result,
    policy: 'Original ammo formula; paid acquisition/owned initial fields and installation/consumption are rebuilt. No selected pet used as boundGear.'},
  selected: summary(selected), first: summary(shots[0]), second: summary(shots[1]), returned: summary(returned),
  normal: {deadline: firstDeadline, simulationSeconds: (shots[1].tick - shots[0].tick) * .05,
    serverSeconds: (player(shots[1]).reload!.startedAt - player(shots[0]).reload!.startedAt) / 1000,
    firstEligibleOvershootMs: player(shots[1]).reload!.startedAt - firstDeadline},
  last: {deadline: lastDeadline, simulationSeconds: (returned.tick - shots[1].tick) * .05,
    serverSeconds: (returned.serverTime - player(shots[1]).reload!.startedAt) / 1000,
    firstEligibleOvershootMs: returned.serverTime - lastDeadline},
  commonTicks: common.length, coreEvents: 4,
  limitations: ['Old raw contains no receive wall timestamps; no wall timing inference.',
    'Only first-room purchased tank3/2002 float32-delay consumer. No new run or new native/source sweep.',
    'AtkBase200 is a recovered attribute, not a complete damage formula. All original producer/Windows behavior/gear dependencies remain open.']}, null, 2) + '\n');
console.log(`PASS existing2002 capacity7/normal2.1/last6.3, ${common.length} dual ticks`);
