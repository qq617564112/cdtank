import type {OwnedRoleBaseRecord} from '../../../shared/contracts/owned-base';
import type {BattleRoleSources} from '../battle-role-sources';
import type {RoleCombatState} from './roles/combat-state';
import type {RoleAttributeState} from './roles/attribute-state';
import type {InventoryWireRecord} from '../../../shared/protocols/PtlInventory';
import {readRoleSkillSources} from './roles/skill-sources';
import {recomputeQualifiedRoleMovement} from './roles/recompute-movement';
import {ROLE_INITIAL_MOVEMENT_SCALES} from './roles/record-defaults';
import {combatSkills, combatItemSkills, combatLimits} from './catalog';
import {ensureSelectedAmmoSkills, initializeDefaultAmmoMagazine} from './roles/ammo-magazine';
import {recomputeRoleAmmo} from './roles/recompute-ammo';
import {recomputeQualifiedRoleArmor} from './roles/recompute-armor';
import {recomputeQualifiedRoleLife} from './roles/recompute-life';
import type {TankConfig} from '../config';
import type {RoleSkillSources} from './roles/skills';

/** Ammo uses available sources; full attributes require complete ownership. */
export function recomputeBattleAttributes(player: {
  attributesReady: boolean;
  magazineReady?: boolean;
  armorReady?: boolean;
  recoveredArmor?: ReturnType<typeof recomputeQualifiedRoleArmor>;
  lifeReady?: boolean;
  recoveredMaxHp?: number;
  tank: TankConfig;
  recoveredMovement?: {speed: number; turn: number};
  ownedRoles: BattleRoleSources;
  boundGear?: OwnedRoleBaseRecord;
  combat: RoleCombatState;
  attributes: RoleAttributeState;
  inventory: InventoryWireRecord[];
  hp: number;
  vip: boolean;
}): void {
  player.attributesReady = false;
  player.magazineReady = false;
  player.armorReady = false;
  player.recoveredArmor = undefined;
  player.lifeReady = false;
  player.recoveredMaxHp = undefined;
  player.recoveredMovement = undefined;
  if (!ensureSelectedAmmoSkills(player.combat)) return;
  const owned = player.ownedRoles.snapshot(), tables = player.ownedRoles.tables();
  const fields = player.combat.attributeSourceFields();
  const currentSkillIds = player.combat.record?.arrays.get(4);
  if (fields && currentSkillIds && (!owned.equipment ||
      [0x58, 0x5c, 0x60].every(offset => owned.equipment!.fields.has(offset)))) {
    // Resolve available sources independently; missing ownership is not an
    // owned record with invented zero values.
    const ammoSources: RoleSkillSources = owned.equipment
      ? readRoleSkillSources({currentSkillIds: [...currentSkillIds], boundGear: player.boundGear,
        equipment: owned.equipment, roleFields: fields})
      : {currentSkillIds: [...currentSkillIds],
        extraSkill: {baseId: fields.get(0x88)!, rank: fields.get(0x8c)!},
        itemIds: [0xbc, 0xc0, 0xc4, 0xc8, 0xcc, 0x70, 0x6c].map(offset => fields.get(offset)!)};
    const life = recomputeQualifiedRoleLife({ownedHp: owned.base?.fields.get(0x2c),
      sources: ammoSources, skills: combatSkills, items: combatItemSkills,
      limits: combatLimits, roleValue9: player.combat.recomputeCounter,
      vip: player.vip ? 1 : 0, vipMultiplier: undefined});
    if (life) {
      player.lifeReady = true;
      player.recoveredMaxHp = life.maxHp;
      // Recalculation changes the limit, never the current life value.
      player.attributes.record.maxHp = life.maxHp;
      player.combat.record!.numericFields!.set(0x58, life.maxHp);
    }
    const ammo = recomputeRoleAmmo({tank: player.tank.recomputeBase, sources: ammoSources,
      skills: combatSkills, items: combatItemSkills, limits: combatLimits,
      roleValue9: player.combat.recomputeCounter});
    if (ammo) {
      player.combat.record!.numericFields!.set(0x38, ammo.capacity);
      player.combat.roleFloatFields.set(0x50, ammo.normalSeconds);
      player.combat.roleFloatFields.set(0x54, ammo.lastBulletSeconds);
      player.magazineReady = true;
      initializeDefaultAmmoMagazine(player.combat);
    }
  }
  // The movement prefix reads mastery and installed skills, not life or armor.
  if (owned.equipment && fields && currentSkillIds && tables.tank && tables.pet && tables.tank.id === player.tank.id &&
      [0x34, 0x58, 0x5c, 0x60].every(offset => owned.equipment!.fields.has(offset))) {
    const movementSources = readRoleSkillSources({currentSkillIds: [...currentSkillIds],
      boundGear: player.boundGear, equipment: owned.equipment, roleFields: fields});
    player.recoveredMovement = recomputeQualifiedRoleMovement({
      tank: tables.tank.recomputeBase, pet: tables.pet,
      ownedField34: owned.equipment.fields.get(0x34),
      tankType: tables.tank.recomputeBase.tankType, sources: movementSources,
      skills: combatSkills, items: combatItemSkills, limits: combatLimits,
      roleValue9: player.combat.recomputeCounter, movementScales: ROLE_INITIAL_MOVEMENT_SCALES});
  }
  if (owned.equipment && fields && currentSkillIds && tables.tank && tables.pet &&
      tables.tank.id === player.tank.id &&
      [0x58, 0x5c, 0x60].every(offset => owned.equipment!.fields.has(offset))) {
    player.recoveredArmor = recomputeQualifiedRoleArmor({
      ownedField34: owned.equipment.fields.get(0x34),
      ownedAtk: owned.equipment.fields.get(0x3c), ownedAtkBonus: owned.equipment.fields.get(0x40),
      ownedDef: owned.equipment.fields.get(0x4c), ownedDefBonus: owned.equipment.fields.get(0x50),
      tank: tables.tank.recomputeBase, tankType: tables.tank.recomputeBase.tankType, pet: tables.pet,
      sources: readRoleSkillSources({currentSkillIds: [...currentSkillIds], boundGear: player.boundGear,
        equipment: owned.equipment, roleFields: fields}),
      skills: combatSkills, items: combatItemSkills, limits: combatLimits,
      roleValue9: player.combat.recomputeCounter});
    player.armorReady = player.recoveredArmor !== undefined;
  }
  // Incomplete imported payloads are not zero-filled into a valid source.
  if (!owned.base || !owned.equipment || !fields || !tables.tank || !tables.pet ||
      tables.tank.id !== player.tank.id ||
      ![0x2c, 0x34, 0x3c].every(offset => owned.base!.fields.has(offset)) ||
      ![0x34, 0x3c, 0x40, 0x4c, 0x50, 0x58, 0x5c, 0x60].every(offset => owned.equipment!.fields.has(offset))) return;
  const sources = readRoleSkillSources({currentSkillIds: [...player.combat.record!.arrays.get(4)!],
    boundGear: player.boundGear, equipment: owned.equipment, roleFields: fields});
  const input = {base: owned.base, equipment: owned.equipment,
    tank: tables.tank.recomputeBase, pet: tables.pet, sources, skills: combatSkills, items: combatItemSkills,
    limits: combatLimits, roleValue9: player.combat.recomputeCounter,
    tankType: tables.tank.recomputeBase.tankType, movementScales: ROLE_INITIAL_MOVEMENT_SCALES,
    itemResolver: (instanceId: number) => {
      const item = player.inventory.find(record => record.instanceId === (instanceId >>> 0));
      return item ? combatItemSkills.get(item.itemTableId) : undefined;
    }};
  // Movement is computed before the unknown VIP HP multiplier tail. Do not
  // publish normal HP/attribute readiness or original completion notifications.
  if (player.vip) {
    return;
  }
  player.attributes.record.hp = player.hp;
  player.attributesReady = player.attributes.recompute({...input, vip: 0, vipMultiplier: 0}, player.combat);
  if (player.attributesReady) initializeDefaultAmmoMagazine(player.combat);
}
