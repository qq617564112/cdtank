import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {World} from '../apps/server/src/world';
import {getBattlefield} from '../apps/server/src/battlefield';
import {createRoleFreeAim} from '../apps/server/src/battle/roles/free-aim';
import type {MsgPlayerInput} from '../apps/shared/protocols';

// Each route starts at the real spawn. Only sequential ordinary inputs change the world.
let found = false;
for (let route = 5; route < 6 && !found; route++) {
  let now = 1000000, sequence = 0;
  const world = new World(() => now, {minPlayers: 2});
  const room = world.listRooms()[0];
  const field = getBattlefield(room.mapId);
  const joined = world.joinRoom(room.id, 'muzzle-a', 'A', 1);
  const peer = world.joinRoom(room.id, 'muzzle-b', 'B', 1);
  world.bindInventory(joined.playerId, {hotkeys: [77, 0, 0, 0, 0, 0, 0], records: [{instanceId: 77, itemTableId: 2007, ownedQuantity: 1, battleQuantity: 1, state: 0, field8: 0, float24Bits: 0, float28Bits: 0, float2cBits: 0}]});
  world.ready(joined.playerId, 1);
  world.ready(peer.playerId, 1);
  const player = () => world.snapshot(room.id)!.players.find(row => row.id === joined.playerId)!;
  const input = (command: Partial<MsgPlayerInput>) => world.updateInput(joined.playerId,
    {sequence: ++sequence, move: 0, turn: 0, aim: 0, fire: false, useItem: 0, clientTime: now, ...command});
  const step = (milliseconds = 50) => {now += milliseconds; return world.step(milliseconds);};
  input({useItem: 2});
  assert.equal(player().ammoItemId, 2007);
  const heading = route * Math.PI / 36;
  for (let tick = 0; tick < 900; tick++) {
    const difference = Math.atan2(Math.sin(heading - player().yaw), Math.cos(heading - player().yaw));
    if (Math.abs(difference) < .01) break;
    input({turn: Math.sign(difference)}); step(10);
  }
  input({});
  for (let tick = 0; tick < 250 && !found; tick++) {
    // Wire snapshots round position/yaw. Observe the authority without mutating it.
    const actor = {...world['rooms'].get(room.id)!.players.get(joined.playerId)!};
    const start = {x: actor.x, y: actor.y + 20, z: actor.z};
    // The accepted source aim is float32; its direction differs slightly from raw yaw.
    const aim = createRoleFreeAim(actor, {x: Math.sin(actor.yaw), y: 0, z: Math.cos(actor.yaw)}, 0);
    const dx = aim.x - Math.fround(actor.x), dz = aim.z - Math.fround(actor.z);
    const length = Math.hypot(dx, dz);
    const end = {x: actor.x + dx / length * 30, y: start.y, z: actor.z + dz / length * 30};
    const surface = field.firstSurfaceHit(start, end, 1);
    if (surface) {
      input({fire: true});
      const fired = step(10).events;
      const event = fired.find(row => row.type === 'terrainHit');
      assert.equal(fired.find(row => row.type === 'fire')!.skillId, 2007);
      assert.equal(fired.find(row => row.type === 'ammoConsumed')!.value, 0);
      assert.equal(world.inventory(joined.playerId).records[0].ownedQuantity, 0);
      assert.equal(world.inventory(joined.playerId).records[0].battleQuantity, 0);
      assert.equal(player().ammoItemId, 2007);
      assert(event, 'Ordinary blocked muzzle must publish its actual surface impact');
      const expected = {x: start.x + (end.x - start.x) * surface.fraction,
        y: start.y, z: start.z + (end.z - start.z) * surface.fraction};
      assert.equal(event.targetId, surface.boxId);
      for (const axis of ['x', 'y', 'z'] as const) {
        assert(Math.abs(event[axis] - expected[axis]) < .001,
          `Blocked muzzle ${axis}: ${event[axis]} must match surface ${expected[axis]}`);
      }
      assert.equal(world.snapshot(room.id)!.bullets.length, 0);
      const result = {status: 'PASS', mapId: room.mapId, route, tick,
        actor: {id: actor.id, x: actor.x, y: actor.y, z: actor.z, yaw: actor.yaw}, surface, expected, event, fired,
        scope: 'Real source spawn, ordinary join/ready/short-step turn/move/fire; no state injection. Rebuilt2007 finite ammunition consumed once for blocked muzzle; actual surface coordinates and no bullet.'};
      writeFileSync('recovery/output/ammo07-consumption-muzzle-world.json', JSON.stringify(result, null, 2) + '\n');
      console.log('PASS ordinary muzzle obstruction', room.mapId, route, tick, event.targetId, expected);
      found = true;
      break;
    }
    input({move: 1}); step();
  }
}
assert(found, 'Ordinary movement must reach a source surface within the muzzle segment');
