import assert from 'node:assert/strict';
import {World} from '../apps/server/src/world';
import type {PlayerSnapshot} from '../apps/shared/protocols';
import {createRoleFreeAim} from '../apps/server/src/battle/roles/free-aim';
let now = 100000;
const world = new World(() => now);
const host = world.createAndJoin('free-aim', 4, 7, 'Free aim', 'Free aim', 1);
world.ready(host.playerId, 1);
world.updateInput(host.playerId, {sequence: 1, move: 0, turn: 0, aim: 1, fire: true, useItem: 0, clientTime: now});
const seen = new Set<string>();
let checked = 0, fired = 0;
for (let tick = 0; tick < 240; tick++) {
  now += 50;
  const result = world.step(50);
  fired += result.events.filter(event => event.type === 'fire' && event.playerId === host.playerId).length;
  const snapshot = world.snapshot(host.roomId)!;
  // Read the unrounded authority pose; no position or outcome is injected.
  const player = (world as unknown as {rooms: Map<string, {players: Map<string, PlayerSnapshot>}>})
    .rooms.get(host.roomId)!.players.get(host.playerId)!;
  for (const bullet of snapshot.bullets) {
    if (seen.has(bullet.id)) continue;
    seen.add(bullet.id);
    const angle = player.yaw + player.aim;
    const request = createRoleFreeAim(player, {x: Math.sin(angle), y: 0, z: Math.cos(angle)}, (now - 100000) / 1000);
    const x = request.x - Math.fround(player.x), z = request.z - Math.fround(player.z);
    const length = Math.hypot(x, z);
    assert.equal(bullet.vx, x / length * 360);
    assert.equal(bullet.vz, z / length * 360);
    assert.equal(bullet.vy, 0);
    checked++;
  }
}
assert(fired >= 10);
assert(checked >= 3, 'Ordinary aim/fire inputs must create projectiles using recovered float32 targets');
world.leave(host.playerId);
assert.equal(world.snapshot(host.roomId), undefined);
console.log(`PASS: ${fired} ordinary fire inputs, ${checked} actual World projectile directions use recovered free-aim targets; room cleanup`);
