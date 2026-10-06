import type {RoleRecomputeTankBase, RoleRecomputePetBase} from '../../../apps/shared/contracts/role-base';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {recomputeRoleAttributes} from '../../../apps/server/src/battle/roles/recompute';
import type {CombatCatalog} from '../../../apps/shared/combat/catalog';
import {readRoleDataScaleLimits} from '../../../apps/server/src/battle/roles/data-scale';
import type {RoleSkillSources, RankedRoleSkill} from '../../../apps/server/src/battle/roles/skills';
import type {RoleRecomputeValues} from '../../../apps/server/src/battle/roles/recompute-base';
import {bindRoleSourceTables, type RoleTableBinding} from '../combat/role-table-binding';
import {setRoleMovementProperty} from '../../../apps/server/src/battle/roles/movement-setter';
import {TANKS, PET_BASES} from '../../../apps/server/src/config';

import {markRolePropertyDirty} from '../../../apps/server/src/battle/roles/property-dirty';

import {RoleAttributeState, type RoleAttributeInput} from '../../../apps/server/src/battle/roles/attribute-state';
import type {RoleRecomputePrerequisites} from '../../../apps/server/src/battle/roles/recompute-readiness';

import {readRoleSkillSources} from '../../../apps/server/src/battle/roles/skill-sources';

import {readOwnedRolePairMessage} from '../roles/role-owned-sources';
import {receiveRoleOwnedPair, type RoleOwnedSources} from '../../../apps/server/src/accounts/owned/receive-pair';
import {resolveRoleRecomputeSource} from '../../../apps/server/src/accounts/owned/source-selection';
import {createRoleCombatState} from '../../../apps/server/src/battle/roles/combat-state';
import {observeRoleSkillSlots} from '../roles/role-skill-observer';
import {AccountStore} from '../../../apps/server/src/account-store';
import {resolveOwnedRolePet, resolveOwnedRoleTank} from '../../../apps/server/src/accounts/owned/definition';

interface Values {recordFields: Record<string, number>; roleIntegers: Record<string, number>; roleFloats: Record<string, number>}
interface Event {kind: string; selector?: number; value?: number; index?: number; values?: Values; dirty?: boolean}
const evidence: {scales: {move: number; turn: number}; rows: {sourceIndex: number; ownedPairIndex: number | null; observerStage: number; tank: RoleRecomputeTankBase & {id: number}; pet: RoleRecomputePetBase & {id: number}; tankType: number; equipmentField34: number;
  sourceFields: {gear: Record<string, number> | null; equipment: Record<string, number>; role: Record<string, number>};
  sources: {currentSkillIds: number[] | null; equipmentSkills: RankedRoleSkill[] | null; extraSkill: RankedRoleSkill; itemIds: number[]};
  roleValue9: number; vip: number; vipMultiplier: number; selected: number[]; events: Event[];
  values: Values; dirty: boolean; dirtyWords: number[]; hp: number}[]} = JSON.parse(readFileSync('recovery/output/role-recompute-native.json', 'utf8'));
const pairEvidence = JSON.parse(readFileSync('recovery/output/role-owned-pair-native.json', 'utf8'));
const baseEvidence = JSON.parse(readFileSync('recovery/output/role-owned-base-native.json', 'utf8'));
const equipmentEvidence = JSON.parse(readFileSync('recovery/output/role-owned-equipment-native.json', 'utf8'));
const initialization: {rows: {tank: RoleRecomputeTankBase; pet: RoleRecomputePetBase}[]} =
  JSON.parse(readFileSync('recovery/output/role-recompute-base-native.json', 'utf8'));
const catalog: CombatCatalog = JSON.parse(readFileSync('recovery/output/web-assets/combat-catalog.json', 'utf8'));
const skills = new Map(catalog.skills.map(skill => [skill.skillId, skill]));
const items = new Map(catalog.items.map(item => [item.itemTableId, {itemId: item.itemTableId, skillIds: item.skillIds}]));
const limits = readRoleDataScaleLimits(catalog.dataScales);
const map = (fields: Record<string, number>) => new Map(Object.entries(fields).map(([key, value]) => [Number(key), value]));
const plain = (state: RoleRecomputeValues): Values => ({recordFields: Object.fromEntries(state.recordFields),
  roleIntegers: Object.fromEntries(state.roleIntegers), roleFloats: Object.fromEntries(state.roleFloats)});
const tanks = new Map(TANKS.map(tank => [tank.id, tank.recomputeBase]));
const pets = new Map(PET_BASES.map(pet => [pet.id, pet]));
const readiness: {rows: {present: Record<keyof RoleRecomputePrerequisites, boolean>;
  missing: string | null}[]} = JSON.parse(readFileSync('recovery/output/role-recompute-readiness-native.json', 'utf8'));
const accountStore = new AccountStore(':memory:');
const account = accountStore.open();
for (const row of evidence.rows) {
  let base = {fields: map(baseEvidence.rows[row.sourceIndex].result), name: ''};
  let equipment = {fields: map(equipmentEvidence.rows[row.sourceIndex].result), name: ''};
  if (row.ownedPairIndex !== null) {
    const packet = pairEvidence.rows[row.ownedPairIndex];
    const parsed = readOwnedRolePairMessage(new Uint8Array(packet.raw), packet.alignment, bytes => Buffer.from(bytes).toString('hex'));
    // The fixture's explicit definitions match the actual tank/pet inputs of the native recompute.
    (parsed.base.fields as Map<number, number>).set(8, row.pet.id);
    (parsed.equipment.fields as Map<number, number>).set(0x24, row.tank.id);
    accountStore.replaceRoleRecords(account.accountId, {base: [parsed.base], equipment: [parsed.equipment]});
    const owned = accountStore.roleRecords(account.accountId);
    assert.strictEqual(resolveOwnedRolePet(owned.base, parsed.base.fields.get(0)!, id => pets.get(id)), pets.get(row.pet.id));
    assert.strictEqual(resolveOwnedRoleTank(owned.equipment, parsed.equipment.fields.get(0x1c)!, id => tanks.get(id)), tanks.get(row.tank.id));
    const owner: RoleOwnedSources = {base: undefined, equipment: undefined};
    receiveRoleOwnedPair(owner, {base: owned.base.get(parsed.base.fields.get(0)!),
      equipment: owned.equipment.get(parsed.equipment.fields.get(0x1c)!)});
    const stage = row.ownedPairIndex % 2 === 0 ? 3 : 4;
    const unexpectedLookup = (): never => {throw new Error('Battle source lookup');};
    const receivedBase = resolveRoleRecomputeSource(stage, owner.base, 0, unexpectedLookup)!;
    const receivedEquipment = resolveRoleRecomputeSource(stage, owner.equipment, 0, unexpectedLookup)!;
    base = {fields: new Map(receivedBase.fields), name: receivedBase.name};
    equipment = {fields: new Map(receivedEquipment.fields), name: receivedEquipment.name};
  }
  equipment.fields.set(0x34, row.equipmentField34);
  const gearFields = row.sourceFields.gear ? map(row.sourceFields.gear) : undefined;
  const roleFields = map(row.sourceFields.role);
  for (const [offset, value] of map(row.sourceFields.equipment)) equipment.fields.set(offset, value);
  const sources = readRoleSkillSources({currentSkillIds: row.sources.currentSkillIds ?? undefined,
    boundGear: gearFields ? {fields: gearFields, name: ''} : undefined, equipment, roleFields});
  assert.deepEqual(sources, {...row.sources, currentSkillIds: row.sources.currentSkillIds ?? undefined,
    equipmentSkills: row.sources.equipmentSkills ?? undefined});
  const events: Event[] = [];
  let dirty = true;
  const dirtyWords = new Uint32Array(8);
  const binding: RoleTableBinding = {};
  bindRoleSourceTables(binding, {field68: row.tank.id, field78: row.pet.id}, id => pets.get(id), id => tanks.get(id));
  assert.deepEqual(binding.tank, row.tank);
  assert.deepEqual(binding.pet, row.pet);
  const result = recomputeRoleAttributes({base, equipment, ...initialization.rows[row.sourceIndex]!, tank: binding.tank!, pet: binding.pet!, sources,
    skills, items, limits, roleValue9: row.roleValue9, tankType: row.tankType, movementScales: evidence.scales,
    vip: row.vip, vipMultiplier: row.vipMultiplier}, {
    setMovement: (selector, value, state) => {
      events.push({kind: 'movement', selector, value});
      setRoleMovementProperty({move: 0, turn: 0}, selector, value,
        index => {events.push({kind: 'notify', index, values: plain(state), dirty}); markRolePropertyDirty(dirtyWords, index);});
    },
    notify: (index, state) => {events.push({kind: 'notify', index, values: plain(state), dirty}); markRolePropertyDirty(dirtyWords, index);},
    clearDirty: () => {dirty = false;},
  });
  assert.deepEqual(result.selectedSkillIds, row.selected);
  assert.deepEqual(plain(result.state), row.values);
  assert.deepEqual(events, row.events);
  assert.equal(dirty, row.dirty);
  assert.deepEqual([...dirtyWords], row.dirtyWords);
  assert.equal(result.completed, !row.dirty);
  assert.equal(row.hp, 777);
  const runtimeEvents: Event[] = [];
  const runtime = new RoleAttributeState({hp: 777, maxHp: 0, maxBullet: 0, move: 0, turn: 0},
    (index, owner) => runtimeEvents.push({kind: 'notify', index, values: plain(owner.values!), dirty: owner.dirty}));
  const runtimeInput = {base, equipment, ...initialization.rows[row.sourceIndex]!, tank: binding.tank!, pet: binding.pet!,
    sources, skills, items, limits, roleValue9: row.roleValue9, tankType: row.tankType,
    movementScales: evidence.scales, vip: row.vip, vipMultiplier: row.vipMultiplier,
    itemResolver: (): never => {throw new Error('Original recompute does not call the item resolver');}};
  assert.equal(runtime.recompute(runtimeInput), !row.dirty);
  assert.deepEqual(plain(runtime.values!), row.values);
  assert.deepEqual(runtimeEvents, row.events.filter(event => event.kind === 'notify'));
  assert.deepEqual([...runtime.propertyDirty], row.dirtyWords);
  assert.equal(runtime.dirty, row.dirty);
  assert.equal(runtime.record.hp, 777);
  if (row === evidence.rows[0]) {
    for (const gate of readiness.rows.filter(gate => gate.missing !== null)) {
      for (const initialized of [false, true]) {
        let notifications = 0;
        const guarded = new RoleAttributeState({...runtime.record}, () => {notifications++;});
        if (initialized) guarded.recompute(runtimeInput);
        const beforeValues = guarded.values;
        const beforeRecord = {...guarded.record};
        guarded.propertyDirty.set([1, 2, 3, 4, 5, 6, 7, 8]);
        guarded.dirty = true;
        const pending = [...guarded.propertyDirty];
        const combat = createRoleCombatState();
        combat.dirty = false;
        const input: RoleAttributeInput = {...runtimeInput};
        for (const name of Object.keys(gate.present) as (keyof RoleRecomputePrerequisites)[]) {
          if (!gate.present[name]) input[name] = undefined;
        }
        const previousNotifications = notifications;
        const previousFields = [...combat.record!.numericFields!];
        combat.roleFloatFields.set(0x54, 123);
        const previousFloats = [...combat.roleFloatFields];
        assert.equal(guarded.recompute(input, combat), false);
        assert.deepEqual([...combat.roleFloatFields], previousFloats);
        assert.deepEqual([...combat.record!.numericFields!], previousFields);
        assert.strictEqual(guarded.values, beforeValues);
        assert.deepEqual(guarded.record, beforeRecord);
        assert.deepEqual([...guarded.propertyDirty], pending);
        assert.equal(guarded.dirty, true);
        assert.equal(combat.dirty, false);
        assert.equal(notifications, previousNotifications);
      }
    }
  }
  assert.equal(runtime.record.maxHp, row.values.recordFields['88']);
  assert.equal(runtime.record.maxBullet, row.values.recordFields['56']);
  for (const event of row.events.filter(event => event.kind === 'movement')) {
    assert.equal(event.selector === 10 ? runtime.record.move : runtime.record.turn, event.value);
  }
  runtime.dirty = true;
  runtimeEvents.length = 0;
  runtime.recompute(runtimeInput);
  assert.deepEqual(plain(runtime.values!), row.values);
  assert.deepEqual(runtimeEvents, row.events.filter(event => event.kind === 'notify'));
  assert.equal(runtime.record.hp, 777);
  const combat = createRoleCombatState();
  combat.dirty = false;
  combat.record!.arrays.get(4)!.set(row.sources.currentSkillIds ?? []);
  const observerEvents: Event[] = [];
  const observed = new RoleAttributeState({hp: 777, maxHp: 0, maxBullet: 0, move: 0, turn: 0},
    (index, state) => {
      assert.equal(combat.dirty, true);
      assert.deepEqual(Object.fromEntries(combat.roleFloatFields), Object.fromEntries(state.values!.roleFloats));
      assert.equal(combat.maxBulletCount, state.values!.recordFields.get(0x38)! >>> 0);
      assert.equal(combat.record!.numericFields!.get(0x58), state.values!.recordFields.get(0x58)! | 0);
      assert.equal(combat.bulletCount, 0);
      assert.equal(combat.record!.numericFields!.get(0x54), 0);
      observerEvents.push({kind: 'notify', index, values: plain(state.values!), dirty: state.dirty});
    });
  observed.dirty = false;
  observeRoleSkillSlots(combat, new Int32Array(16), skills, {
    stage: row.observerStage, local: true,
    stop: () => {throw new Error('Empty previous slots cannot stop a skill');},
    recompute: () => {
      assert.equal(combat.dirty, true);
      observed.recompute(runtimeInput, combat);
    },
  });
  assert.deepEqual(plain(observed.values!), row.values);
  assert.deepEqual(observerEvents, row.events.filter(event => event.kind === 'notify'));
  assert.equal(combat.dirty, row.dirty);
  assert.equal(observed.dirty, row.dirty);
  assert.deepEqual(Object.fromEntries(combat.roleFloatFields), row.values.roleFloats);
  assert.equal(combat.maxBulletCount, row.values.recordFields['56'] >>> 0);
  assert.equal(combat.record!.numericFields!.get(0x58), row.values.recordFields['88'] | 0);
  assert.deepEqual([...observed.propertyDirty], row.dirtyWords);
}
accountStore.close();
console.log(`PASS: ${evidence.rows.length} complete recompute and local skill observer attribute/notification/dirty contracts`);
console.log('PASS: 254 native missing-source combinations preserve initialized/empty attribute state and both dirty states');
console.log('PASS: 16 parsed paired messages → account persistence → battle source getters → complete attributes');
