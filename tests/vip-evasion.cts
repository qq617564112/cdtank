import assert from 'node:assert/strict';
import {BotController, type BotActor} from '../apps/server/src/battle/cpu/controller';
import type {Battlefield} from '../apps/server/src/battlefield';

// A clear close shot with a west-facing hurt king reproduces the original
// stationary decision; the supplied predictor models an allowed ordinary step.
const actor: BotActor = {id: 'king', team: 0, x: 0, y: 0, z: 0, yaw: -Math.PI / 2,
  aim: 0, alive: true, vip: true, hp: 150, maxHp: 200, tank: {speed: 25, turn: 1},
  movement: {speed: 150, turn: 1, navigation: {cacheKey: 'evasion-test',
    canTraverse: () => true, reachable: (_start, end) => end}, predict: input => {
      const yaw = actor.yaw + input.turn * .05;
      return {x: actor.x + Math.sin(yaw) * input.move * 7.5, y: 0,
        z: actor.z + Math.cos(yaw) * input.move * 7.5, yaw};
    }}};
const enemy: BotActor = {id: 'enemy', team: 1, x: 180, y: 0, z: 0, yaw: 0, aim: 0,
  alive: true, vip: true, tank: {speed: 25, turn: 1}};
const field = {navigationRevision: 0, firstSurfaceHit: () => undefined,
  move: (_start: unknown, end: unknown) => end} as unknown as Battlefield;
const input = new BotController().input(actor, [actor, enemy], [], field, 3, 100000, .05);
assert.equal(input.move, 1, 'West-facing king must advance away, rather than reverse toward the enemy');
assert.notEqual(input.turn, 0, 'King turns the body while creating aiming time');
const destination = actor.movement!.predict(input);
assert(Math.hypot(destination.x - enemy.x, destination.z - enemy.z) > 180);
assert.equal(input.fire, false);
const stationary = {...actor, movement: {...actor.movement!, predict: () => ({x: 0, y: 0, z: 0, yaw: actor.yaw})}};
const blocked = new BotController().input(stationary, [stationary, enemy], [], field, 3, 100000, .05);
assert.equal(blocked.move, 0, 'The evasion policy cannot bypass blocked movement');
for (const candidate of [{...actor, vip: false}, {...actor, hp: 200}]) {
  assert.equal(new BotController().input(candidate, [candidate, enemy], [], field, 3, 100000, .05).move, 0);
}
assert.equal(new BotController().input(actor, [actor, enemy], [], field, 1, 100000, .05).move, 0);
console.log('PASS: hurt king evades away while turning, respects collision and leaves other modes/healthy roles unchanged');
