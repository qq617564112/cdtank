import type {OwnedRoleEquipmentRecord} from '../../../shared/contracts/owned-equipment';
import type {OwnedTankTextures} from '../../../shared/combat/role-owned-textures';
import type {RoleTankTextureConfirmation} from '../../../shared/contracts/tank-textures';

/** Original495a69: phase2, success3 updates owned selections and confirmed balances. */
export function applyRoleTankTextureConfirmation(
    phase: number, records: Map<number, OwnedRoleEquipmentRecord>,
    profileFields: Map<number, number>, message: RoleTankTextureConfirmation,
    notify?: (result: number) => void): void {
  if (phase !== 2) return;
  const record = records.get(message.instanceId >>> 0);
  if (message.result === 3 && record) {
    const fields = new Map(record.fields);
    fields.set(0x28, message.textures.U >>> 0);
    fields.set(0x2c, message.textures.M >>> 0);
    fields.set(0x30, message.textures.XY >>> 0);
    records.set(message.instanceId >>> 0, {...record, fields});
    profileFields.set(0x74, message.tokens >>> 0);
    profileFields.set(0x70, message.money >>> 0);
  }
  notify?.(message.result);
}

export interface RoleTankTexturePrice {
  rarity: number;
  moneyPrice: number;
  tokenPrice: number;
}
export interface RoleTankTextureRequestDecision {
  send: boolean;
  result?: 0 | 1 | 2;
  moneyCost: number;
  tokenCost: number;
}

/** Original493b5c request gate; no ownership grant or server-side purchase transaction. */
export function evaluateRoleTankTextureRequest(
    current: OwnedTankTextures, requested: OwnedTankTextures,
    money: number, tokens: number,
    lookup: (id: number) => RoleTankTexturePrice | undefined): RoleTankTextureRequestDecision {
  const slots = ['U', 'M', 'XY'] as const;
  const unchanged = slots.every(slot => (requested[slot] >>> 0) === (current[slot] >>> 0));
  if (unchanged || slots.every(slot => (requested[slot] >>> 0) === 0)) {
    return {send: false, result: 0, moneyCost: 0, tokenCost: 0};
  }
  let moneyCost = 0;
  let tokenCost = 0;
  for (const slot of slots) {
    const id = requested[slot] >>> 0;
    if (id === 0 || id === (current[slot] >>> 0)) continue;
    const price = lookup(id);
    if (!price) throw new Error(`Missing original tanktexture ${id}`);
    if (price.rarity === 0) return {send: false, moneyCost, tokenCost};
    if (price.rarity === 1) moneyCost = (moneyCost + price.moneyPrice) >>> 0;
    if (price.rarity === 2) tokenCost = (tokenCost + price.tokenPrice) >>> 0;
  }
  if ((tokens >>> 0) < tokenCost) return {send: false, result: 1, moneyCost, tokenCost};
  if ((money >>> 0) < moneyCost) return {send: false, result: 2, moneyCost, tokenCost};
  return {send: true, moneyCost, tokenCost};
}
