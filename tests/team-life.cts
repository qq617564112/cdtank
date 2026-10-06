import assert from 'node:assert/strict';
import {applyTeamLifeItem, type TeamLifeParticipant, type TeamLifeRoom}
  from '../apps/server/src/battle/items/team-life';
import {RoleCombatState} from '../apps/server/src/battle/roles/combat-state';
import {combatItems, combatSkills} from '../apps/server/src/battle/catalog';
import type {MsgRoomEvent} from '../apps/shared/protocols';

function fixture(team = 0) {
  const room: TeamLifeRoom = {roomId: 'room', mode: 1, teamLives: [4, 7]};
  const player: TeamLifeParticipant = {id: 'p7', name: 'Owner', team, alive: true,
    x: 10, y: 2, z: 30, combat: new RoleCombatState({status: 2,
      flags: new Uint8Array(16).fill(1), arrays: new Map([[4, new Int32Array(16).fill(8)]]),
      numericFields: new Map([[0x54, 123], [0x58, 300], [0x6c, 42]])}),
    inventory: [{instanceId: 77, itemTableId: 501, ownedQuantity: 4, battleQuantity: 2,
      state: 0, field8: 7, float24Bits: 0x7fc01234, float28Bits: 0x80000000,
      float2cBits: 0xffffffff}]};
  player.combat.dirty = false;
  player.combat.roleFloatFields.set(0x1c, 12);
  const events: MsgRoomEvent[] = [];
  let commits = 0;
  const consume = (id: string, instance: number, owned: number, table: number) => {
    assert.deepEqual([id, instance, owned, table], ['p7', 77, 4, 501]);
    assert.deepEqual(room.teamLives, [4, 7], 'Persistence precedes team life mutation');
    assert.equal(player.inventory[0].ownedQuantity, 4);
    assert.equal(player.inventory[0].battleQuantity, 2);
    commits++;
    return true;
  };
  const use = (commit = consume, kind = 'useItem', instanceId = 77) =>
    applyTeamLifeItem(room, player, {kind, instanceId}, commit, events);
  return {room, player, events, use, commits: () => commits};
}

function battleState(f: ReturnType<typeof fixture>) {
  return structuredClone({room: f.room, player: {...f.player,
    combat: {...f.player.combat, notify: undefined}}});
}

const source = combatSkills.get(501)!;
const definition = combatItems.get(501)!;
const sourceBefore = structuredClone(source);
const definitionBefore = structuredClone(definition);
assert.equal(definition.battleUseMax, 2);
assert.deepEqual(definition.skillIds, [501, 0, 0]);
assert.equal(source.target, 1);
assert.equal(source.triggerType, 1);
assert.deepEqual(source.functions[0], {type: 18, t: 0, x: 1, y: 1, z: 0});
assert.deepEqual(source.effects[0], {effectId: 12, sound: 'SE13', tag: 0, method: 3});

for (const team of [0, 1]) {
  const f = fixture(team);
  const combatBefore = battleState(f).player.combat;
  const inventoryBefore = {...f.player.inventory[0]};
  f.use();
  assert.equal(f.commits(), 1);
  assert.deepEqual(f.room.teamLives, team === 0 ? [5, 7] : [4, 8]);
  assert.deepEqual(f.player.inventory[0], {...inventoryBefore, ownedQuantity: 3, battleQuantity: 1});
  assert.deepEqual(battleState(f).player.combat, combatBefore,
    'HP, attributes, flags and all occupied skill slots stay unchanged');
  assert.deepEqual(f.events, [{roomId: 'room', type: 'itemUsed',
    message: `Owner使用${definition.name}`, playerId: 'p7', targetId: 'p7', value: 1,
    x: 10, y: 2, z: 30, skillId: 501,
    playSkillEffect: {skillId: 501, effectIndex: 0, duration: 0,
      roleId: 7, xBits: 0, zBits: 0}}]);
}

const rejectedCases: Array<(f: ReturnType<typeof fixture>) => void> = [
  ...[0, 2, 3, 4, 5].map(mode => (f: ReturnType<typeof fixture>) => {f.room.mode = mode;}),
  ...[-1, 2, .5, NaN].map(team => (f: ReturnType<typeof fixture>) => {f.player.team = team;}),
  ...[[], [1], [1, 2, 3], [0, 7], [4, 0], [-1, 7], [4, -1], [1.5, 7],
    [4, 1.5], [NaN, 7], [4, NaN], [Infinity, 7], [4, Infinity],
    [Number.MAX_SAFE_INTEGER, 7]].map(lives => (f: ReturnType<typeof fixture>) => {
    f.room.teamLives = lives;
  }),
];
for (const configure of rejectedCases) {
  const f = fixture();
  configure(f);
  const before = battleState(f);
  f.use();
  assert.equal(f.commits(), 0);
  assert.deepEqual(battleState(f), before);
  assert.equal(f.events.length, 1);
  assert.equal(f.events[0].type, 'itemRejected');
}

const ignoredCases: Array<(f: ReturnType<typeof fixture>) => void> = [
  f => {f.player.alive = false;},
  f => {f.player.combat.record!.status = 1;},
  f => {f.player.combat.record!.status = 3;},
  f => {f.player.inventory[0].itemTableId = 8;},
  f => {f.player.inventory[0].ownedQuantity = 0;},
  f => {f.player.inventory[0].battleQuantity = 0;},
  f => {f.player.inventory = [];},
];
for (const configure of ignoredCases) {
  const f = fixture();
  configure(f);
  const before = battleState(f);
  f.use();
  assert.equal(f.commits(), 0);
  assert.deepEqual(battleState(f), before);
  assert.equal(f.events.length, 0);
}
for (const [kind, instanceId] of [['placeTrap', 77], ['useItem', 78]] as const) {
  const f = fixture();
  f.use(undefined, kind, instanceId);
  assert.equal(f.commits(), 0);
  assert.deepEqual(f.room.teamLives, [4, 7]);
  assert.equal(f.events.length, 0);
}

for (const commit of [() => false, () => {throw new Error('Storage unavailable');}]) {
  const f = fixture();
  const before = battleState(f);
  f.use(commit);
  assert.deepEqual(battleState(f), before,
    'CAS failure or exception leaves all battle state unchanged');
  assert.equal(f.events.length, 1);
  assert.equal(f.events[0].type, 'itemRejected');
}

for (const patch of [{skillId: 8}, {target: 2}, {triggerType: 2},
  {functions: [{...source.functions[0], type: 6}]},
  {functions: [{...source.functions[0], x: 2}]},
  {functions: [{...source.functions[0], y: 2}]}]) {
  combatSkills.set(501, {...source, ...patch});
  try {
    const f = fixture();
    f.use();
    assert.equal(f.commits(), 0);
    assert.deepEqual(f.room.teamLives, [4, 7]);
    assert.equal(f.events.length, 0);
  } finally {
    combatSkills.set(501, source);
  }
}
combatItems.set(501, {...definition, skillIds: [8, 0, 0]});
try {
  const f = fixture();
  f.use();
  assert.equal(f.commits(), 0);
  assert.deepEqual(f.room.teamLives, [4, 7]);
} finally {
  combatItems.set(501, definition);
}

const limited = fixture();
let accepted = 0;
const persist = () => {accepted++; return true;};
limited.use(persist);
limited.use(persist);
limited.use(persist);
assert.equal(accepted, 2);
assert.deepEqual(limited.room.teamLives, [6, 7]);
assert.equal(limited.player.inventory[0].ownedQuantity, 2);
assert.equal(limited.player.inventory[0].battleQuantity, 0);
assert.equal(limited.events.length, 2);
const lastSafe = fixture(1);
lastSafe.room.teamLives = [4, Number.MAX_SAFE_INTEGER - 1];
lastSafe.use(() => true);
assert.deepEqual(lastSafe.room.teamLives, [4, Number.MAX_SAFE_INTEGER]);
lastSafe.use(() => {assert.fail('Unsafe increment must not persist');});
assert.equal(lastSafe.events.at(-1)!.type, 'itemRejected');
assert.equal(lastSafe.player.inventory[0].ownedQuantity, 3);
assert.deepEqual(source, sourceBefore);
assert.deepEqual(definition, definitionBefore);
console.log('PASS: team life source contract, mode and life qualification, CAS ordering, atomic failure, finite inventory and role isolation');
