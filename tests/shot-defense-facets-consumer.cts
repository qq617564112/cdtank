import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {damagePlayer} from '../apps/server/src/battle/life';
import {createRoleCombatState, type RoleCombatState} from '../apps/server/src/battle/roles/combat-state';
import {advanceProjectiles} from '../apps/server/src/battle/projectiles';
import {createRoomBattlefield} from '../apps/server/src/battlefield';
import type {MsgRoomEvent} from '../apps/shared/protocols';

type Participant = Parameters<typeof damagePlayer>[1] & {combat: RoleCombatState};
const room = {roomId: 'facets', mode: 4, targetScore: 10,
  teamScores: [0, 0], teamLives: [2, 2],
  map: {brokenScore: -10, hitScore: 2, destroyScore: 10, respawnTime: 3}};
function participant(id: string): Participant {
  const combat = createRoleCombatState();
  return {id, name: id, team: 0, x: 0, y: 0, z: 0, hp: 650, alive: true,
    score: 0, kills: 0, deaths: 0, respawnAt: 0, vip: false,
    attributesReady: true, armorReady: true, combat,
    recoveredArmor: {defensePercent: .17000000178813934, defenseBonus: 44,
      sideDefensePercent: .699999988079071, backDefensePercent: .5},
    attributes: {record: {hp: 650, maxHp: 650}}};
}
const source = participant('P1');
const evidence: object[] = [];
for (const [name, bearing, factor] of [
  ['FRONT', {x: 0, z: 1}, 1],
  ['SIDE', {x: 1, z: 0}, .699999988079071],
  ['BACK', {x: 0, z: -1}, .5],
] as const) {
  const target = participant('P2'), events: MsgRoomEvent[] = [];
  const expected = 15100 / (100 + (Math.fround(17 * Math.fround(.01)) * 100 + 44) * factor);
  damagePlayer(room, source, target, 151, () => 1000, events, 2, 2001, {bodyYaw: 0, bearing});
  const hit = events.find(event => event.type === 'hit')!;
  assert.equal(hit.value, expected);
  assert.equal(target.hp, (650 - expected) | 0);
  assert.equal(target.attributes.record.hp, target.hp);
  assert.equal(hit.hurtSelector, 2, 'Visual hurt selector remains independent from armor facet');
  evidence.push({name, bearing, expected, hp: target.hp, hit});
}
const periodicTarget = participant('P2'), periodicEvents: MsgRoomEvent[] = [];
damagePlayer(room, source, periodicTarget, 151, () => 1000, periodicEvents, 2, undefined,
  {bodyYaw: 0, bearing: {x: 0, z: -1}});
assert.equal(periodicTarget.hp, 499, 'Periodic damage has no new qualified armor facets');
const unqualified = {...participant('P2'), armorReady: false};
damagePlayer(room, source, unqualified, 151, () => 1000, [], 2, 2001,
  {bodyYaw: 0, bearing: {x: 0, z: -1}});
assert.equal(unqualified.hp, 499);
// Actual moving projectile handler supplies its incoming velocity, independent of owner location.
const field = createRoomBattlefield(7), spawn = field.spawn(0);
const owner = {id: 'owner', alive: true, x: spawn.x + 400, y: spawn.y, z: spawn.z + 400};
const target = {id: 'target', alive: true, x: spawn.x, y: spawn.y, z: spawn.z};
const projectileRoom = {roomId: 'velocity', map: {mapId: 7}, phase: 'PLAYING',
  players: new Map([[owner.id, owner], [target.id, target]]), objectives: [], battlefield: field,
  bullets: [{id: 'bullet', ownerId: owner.id, x: target.x, y: target.y + 24, z: target.z - 25,
    vx: 0, vy: 0, vz: 100, damage: 151, ammoItemId: 2002, ttl: 2}]};
let actualBearing: {x: number; z: number} | undefined;
advanceProjectiles(projectileRoom, .25, 24, {
  hitPlayer: (_owner, _target, _damage, _ammo, bearing) => {actualBearing = bearing;},
  hitObjective() {}, terrainHit() {},
});
assert.deepEqual(actualBearing, {x: -0, z: -100});
assert.equal(projectileRoom.bullets.length, 0);
writeFileSync('recovery/output/shot-defense-facets-consumer.json', JSON.stringify({
  status: 'PASS_QUALIFIED_SHOT_FACETS_INTEGER_HP_VISUAL_SELECTOR_AND_ACTUAL_PROJECTILE_BEARING_SCOPE',
  evidence, periodicAndUnqualifiedUnchanged: true, actualProjectileBearing: actualBearing,
}, null, 2) + '\n');
console.log('PASS: shot armor facets, integer HP, independent hurt selector and actual projectile incidence');
