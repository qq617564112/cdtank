import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {World} from '../apps/server/src/world';
import {TANKS} from '../apps/server/src/config';
import {combatLimits} from '../apps/server/src/battle/catalog';

type SourceRow = {tankId: number; petId: number; part: number;
  base: Record<string, number>; equipment: Record<string, number>};
const source = JSON.parse(readFileSync('recovery/output/world-role-attributes-native.json', 'utf8')) as {rows: SourceRow[]};
const fields = (values: Record<string, number>) => new Map(Object.entries(values).map(([key, value]) => [Number(key), value]));
const results: {tankId: number; petId: number; condition: number; turn: number; aim: number; yawDelta: number;
  move: number; distances: number[]; capacity: number; normal: number; last: number; fireTimes: number[]}[] = [];
// Complete source records are imported before preparation. All poses below come
// from spawn and ordinary input; no active pose, health or events are supplied.
for (const tankId of TANKS.map(tank => tank.id)) {
  const row = source.rows.find(value => value.tankId === tankId && value.part === 0)!;
  assert(row);
  for (const condition of [0, 1]) {
    let now = 100000;
    const world = new World(() => now, {timeLimitSeconds: 120});
    const host = world.createAndJoin('control-host', 4, 7, '转向验证', 'Host', tankId);
    const equipment = fields(row.equipment);
    equipment.set(0x34, condition);
    world.bindRoleSources(host.playerId, {base: {name: 'Source pet fixture', fields: fields(row.base)},
      equipment: {name: 'Source tank fixture', fields: equipment}});
    const tables = world.roleSourceTables(host.playerId);
    assert(tables.tank && tables.pet);
    const type = tables.tank.recomputeBase.tankType;
    const masteryFields = [tables.pet.field7c, tables.pet.field80, tables.pet.field84, tables.pet.field88];
    const mastery = condition === 0 ? Math.max(1, masteryFields[type - 1] - 1) : masteryFields[type - 1];
    const originalTurn = Math.fround((mastery + tables.tank.recomputeBase.field88 - 3)
      * Math.fround(4 * Math.PI / 180) + Math.fround(.1919862));
    world.ready(host.playerId, 1);
    assert.equal(world.snapshot(host.roomId)!.phase, 'PLAYING');
    const snapshot = () => world.snapshot(host.roomId)!.players.find(value => value.id === host.playerId)!;
    const initial = snapshot();
    let sequence = 0;
    const input = (aim: number, turn: number, move = 0, fire = false) => world.updateInput(host.playerId,
      {sequence: ++sequence, move, aim, turn, fire, useItem: 0, clientTime: now});
    const stepSecond = () => {for (let tick = 0; tick < 20; tick++) {now += 50; world.step(50);}};
    input(1, 0); stepSecond();
    const right = snapshot();
    assert(Math.abs(right.aim - initial.aim - originalTurn) < .00015);
    assert(Math.abs(Math.atan2(Math.sin(right.yaw - initial.yaw), Math.cos(right.yaw - initial.yaw))) < .00015);
    assert(Math.hypot(right.x - initial.x, right.z - initial.z) < .00015);
    input(-1, 0); stepSecond();
    assert(Math.abs(snapshot().aim - initial.aim) < .00015);
    const beforeBody = snapshot();
    input(0, 1); stepSecond();
    const body = snapshot();
    const delta = Math.atan2(Math.sin(body.yaw - beforeBody.yaw), Math.cos(body.yaw - beforeBody.yaw));
    assert(Math.abs(Math.abs(delta) - originalTurn) < .0002);
    const bodyDelta = Math.atan2(Math.sin(body.bodyYaw! - beforeBody.bodyYaw!), Math.cos(body.bodyYaw! - beforeBody.bodyYaw!));
    assert(Math.abs(bodyDelta - delta) < .0002);
    assert(Math.abs(body.aim - initial.aim) < .00015);
    input(0, -1); stepSecond();
    const move = 50 + 10 * (mastery + tables.tank.recomputeBase.field84 - 3);
    const distances: number[] = [];
    for (const direction of [1, -1]) {
      const before = snapshot(); input(0, 0, direction);
      for (let tick = 0; tick < 4; tick++) {now += 50; world.step(50);}
      const after = snapshot();
      const distance = Math.hypot(after.x - before.x, after.z - before.z);
      assert(Math.abs(distance - move * .2) < .025, `tank${tankId} ordinary movement ${direction}: ${distance} vs ${move * .2}`);
      distances.push(distance);
    }
    const limit = (value: number, id: number) => {
      const bound = combatLimits.get(id)!;
      return Math.max(bound.lower, Math.min(bound.upper, value));
    };
    const capacity = limit(tables.tank.recomputeBase.field90 + 6, 17);
    const normal = Math.fround(limit(tables.tank.recomputeBase.reloadDuration + 17, 16) * Math.fround(.1));
    const last = Math.fround(limit(tables.tank.recomputeBase.reloadDuration + 17, 16) * Math.fround(.1) * 100 * Math.fround(.03));
    assert.deepEqual(snapshot().ammoMagazine, {remaining: capacity, capacity});
    const fireTimes: number[] = [];
    input(0, 0, 0, true);
    for (let tick = 0; tick < 1500 && fireTimes.length < capacity * 2 + 1; tick++) {
      now += 50;
      const events = world.step(50).events;
      if (events.some(event => event.type === 'fire' && event.playerId === host.playerId)) {
        fireTimes.push(now);
        const remainingBefore = capacity - (fireTimes.length - 1) % capacity;
        const expectedDuration = remainingBefore === 1 ? last : normal;
        assert.equal(snapshot().reload!.duration, expectedDuration);
        assert.deepEqual(snapshot().ammoMagazine, {remaining: remainingBefore - 1, capacity});
        if (fireTimes.length > 1) {
          const previousRemaining = capacity - (fireTimes.length - 2) % capacity;
          const expectedInterval = previousRemaining === 1 ? last : normal;
          const interval = (now - fireTimes[fireTimes.length - 2]) / 1000;
          assert(interval + .00001 >= expectedInterval && interval <= expectedInterval + .051);
        }
      }
    }
    assert.equal(fireTimes.length, capacity * 2 + 1);
    results.push({tankId, petId: row.petId, condition, turn: originalTurn, aim: right.aim - initial.aim,
      yawDelta: delta, move, distances, capacity, normal, last, fireTimes});
    world.leave(host.playerId);
  }
}
writeFileSync('recovery/output/tank-controls-authority.json', JSON.stringify({status: 'PASS',
  scope: '21 tanks, both explicit owned condition values, normal PlayerInput aim/body turn, forward/reverse distance, continuous fire and two magazines; independent turret and magazine producer rebuilt; not dual-page acceptance', results}, null, 2));
console.log('PASS', results.length, 'normal authority control cases');
