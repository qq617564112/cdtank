import type {CombatCatalog, CombatSkillAttribute} from '../../../../shared/combat/catalog';
import type {TradeRecordView} from '../../../../shared/protocols/PtlTrade';
import {HOME_TANK_PARAMETER_BASES} from '../home/home-tank-parameters';
import {petShopMastery} from './pet-shop-mastery';

/** Part slot table offsets carried on a confirmed tank record. */
const TANK_PART_SLOTS = [0x58, 0x5c, 0x60] as const;
/** Original PetTable +7c..+88 mastery order and the four ProgressBars that consume it. */
const PET_MASTERY_CONTROLS = ['prgLightTank', 'prgMediumTank', 'prgHeavyTank', 'prgCruiser'] as const;

export interface TradeOwnedRoleParameters {
  /** StaticText and ProgressBar caption values keyed by the source layout control name. */
  texts: Record<string, string>;
  /** Raw progress fractions keyed by the source ProgressBar control name; the view clips 0..1 visually. */
  progress: Record<string, number>;
}

/** Confirmed part passive bonus over the record's own slots; undefined when a required item or skill is unresolved. */
function tankItemBonus(fields: Map<number, number>, catalog: CombatCatalog, attribute: CombatSkillAttribute): number | undefined {
  let total = 0;
  for (const offset of TANK_PART_SLOTS) {
    const itemId = fields.get(offset);
    if (itemId === undefined) return undefined;
    if (itemId === 0) continue;
    const item = catalog.items.find(value => value.itemTableId === itemId);
    if (!item) return undefined;
    for (const skillId of item.skillIds) {
      if (skillId === 0) continue;
      const skill = catalog.skills.find(value => value.skillId === skillId);
      if (!skill) return undefined;
      if (skill.triggerType !== 0) continue;
      total += skill.attributes[attribute] ?? 0;
    }
  }
  return total;
}

/**
 * Tank detail projection over the confirmed record's own three part slots and the
 * TankTable baseline. It never reads the current profile, the current pet or the
 * Shop/Home clamps, and a legal zero is kept as zero.
 */
export function tradeTankOwnedParameters(record: TradeRecordView, catalog?: CombatCatalog): TradeOwnedRoleParameters | undefined {
  if (record.kind !== 'tank' || !record.role) return undefined;
  const fields = new Map(record.role.fields);
  const texts: Record<string, string> = {}, progress: Record<string, number> = {};
  for (const [name, offset] of [['txtAttackLevel', 0x44], ['txtPanzerLevel', 0x54], ['txtSlot', 0x6c]] as const) {
    const value = fields.get(offset);
    if (value !== undefined) texts[name] = String(value);
  }
  for (const [name, offset] of [['txtInternalPart0', 0x58], ['txtInternalPart1', 0x5c], ['txtInternalPart2', 0x60]] as const) {
    const itemId = fields.get(offset);
    // Zero is a real empty slot; only a resolved non-zero item has a name.
    texts[name] = !catalog || itemId === undefined || itemId === 0 ? ''
      : catalog.items.find(value => value.itemTableId === itemId)?.name ?? '';
  }
  const base = catalog ? HOME_TANK_PARAMETER_BASES[fields.get(0x24) ?? 0] : undefined;
  if (!catalog || !base) return {texts, progress};
  const side = tankItemBonus(fields, catalog, 'SideDef'), back = tankItemBonus(fields, catalog, 'BackDef');
  const move = tankItemBonus(fields, catalog, 'ItemMove'), turn = tankItemBonus(fields, catalog, 'ItemTurn');
  const delay = tankItemBonus(fields, catalog, 'Delay'), bullet = tankItemBonus(fields, catalog, 'MaxBullet');
  if (side !== undefined) texts.txtPanzerSide = String(base[5]! + side);
  if (back !== undefined) texts.txtPanzerBack = String(base[6]! + back);
  if (move !== undefined) texts.txtMoveSpeed = String((base[1]! + move + 2) * 10);
  if (turn !== undefined) texts.txtRotateSpeed = String((base[2]! + turn) * 4 - 1);
  if (delay !== undefined) {
    texts.txtShootInterval = ((base[3]! + delay) * Math.fround(0.1)).toFixed(1);
    texts.prgLoadingTime = String(Math.round((base[3]! + delay) * 2));
  }
  if (bullet !== undefined) progress.prgLoadingTime = (base[4]! + bullet) * Math.fround(1 / 6);
  return {texts, progress};
}

/**
 * Pet detail progress over the confirmed record's own PetTable definition row.
 * The current pet skills, the current tank parts and the Shop mastery aggregation
 * are not part of the source trade panel.
 */
export function tradePetOwnedMastery(record: TradeRecordView, catalog?: CombatCatalog): TradeOwnedRoleParameters | undefined {
  if (record.kind !== 'pet' || !record.role || !catalog) return undefined;
  const definitionId = new Map(record.role.fields).get(8);
  const mastery = definitionId === undefined ? [] : petShopMastery(definitionId);
  const texts: Record<string, string> = {}, progress: Record<string, number> = {};
  if (mastery.length >= PET_MASTERY_CONTROLS.length) {
    PET_MASTERY_CONTROLS.forEach((name, index) => {
      progress[name] = Math.fround(mastery[index]! * Math.fround(0.2));
    });
  }
  return {texts, progress};
}
