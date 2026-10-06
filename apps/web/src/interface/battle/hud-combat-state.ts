import type {MsgRoomSnapshot, PlayerSnapshot} from '../../../../shared/protocols/MsgRoomSnapshot';
import {battleIsActive} from '../../../../shared/combat/battle-start';

/** Rebuilt combat projection shared with the item bar. Every field is a plain
 * server-confirmed snapshot value; the client never invents an authoritative
 * cooldown or consumes stock on its own.
 */
export interface HudCombatSnapshot {
  visible: boolean;
  canUseShortcuts: boolean;
  playerId?: string;
  alive: boolean;
  serverTime: number;
  selectedAmmoSlot?: number;
  ammoItemId?: number;
  magazine?: {remaining: number; capacity: number};
  ammoSlots: readonly {slot: number; itemTableId: number; quantity: number}[];
  reload?: PlayerSnapshot['reload'];
  activeEffects: readonly {skillId: number; expiresAt: number}[];
}

/** Item4/5/6/7/8/9/10/11 expiries only express that an effect is currently
 * valid, using the server millisecond value; they never gate a new cast.
 */
function activeEffects(local: PlayerSnapshot): {skillId: number; expiresAt: number}[] {
  const effects: {skillId: number; expiresAt: number}[] = [];
  const push = (state: {skillId: number; expiresAt: number} | undefined): void => {
    if (state) effects.push({skillId: state.skillId, expiresAt: state.expiresAt});
  };
  push(local.attackBoost);
  push(local.defenseBoost);
  push(local.speedBoost);
  push(local.turnBoost);
  push(local.invincibility);
  push(local.opticalCamouflage);
  push(local.roleDisguise);
  return effects;
}

export function combatState(snapshot: MsgRoomSnapshot, local: PlayerSnapshot | undefined,
  serverNow = snapshot.serverTime): HudCombatSnapshot {
  if (!local || !['PLAYING', 'FINISHED'].includes(snapshot.phase)) {
    return {visible: false, canUseShortcuts: false, alive: false, serverTime: snapshot.serverTime, ammoSlots: [], activeEffects: []};
  }
  const live = local.alive && snapshot.phase === 'PLAYING';
  const active = battleIsActive(snapshot, serverNow);
  return {
    visible: true,
    canUseShortcuts: live && active && !local.isAutopilot,
    playerId: local.id,
    alive: local.alive,
    serverTime: snapshot.serverTime,
    selectedAmmoSlot: local.selectedAmmoSlot,
    ammoItemId: local.ammoItemId,
    magazine: local.ammoMagazine,
    ammoSlots: local.ammoSlots ?? [],
    reload: live ? local.reload : undefined,
    activeEffects: live ? activeEffects(local) : [],
  };
}

export function sameCombatState(left: HudCombatSnapshot, right: HudCombatSnapshot): boolean {
  if (left === right) return true;
  if (left.visible !== right.visible || left.canUseShortcuts !== right.canUseShortcuts
      || left.playerId !== right.playerId || left.alive !== right.alive
      || left.serverTime !== right.serverTime || left.selectedAmmoSlot !== right.selectedAmmoSlot
      || left.ammoItemId !== right.ammoItemId || !sameMagazine(left.magazine, right.magazine)
      || left.ammoSlots.length !== right.ammoSlots.length || left.activeEffects.length !== right.activeEffects.length
      || !sameReload(left.reload, right.reload)) return false;
  return left.ammoSlots.every((slot, index) => {
    const next = right.ammoSlots[index];
    return slot.slot === next.slot && slot.itemTableId === next.itemTableId && slot.quantity === next.quantity;
  }) && left.activeEffects.every((effect, index) => {
    const next = right.activeEffects[index];
    return effect.skillId === next.skillId && effect.expiresAt === next.expiresAt;
  });
}

function sameMagazine(left: HudCombatSnapshot['magazine'], right: HudCombatSnapshot['magazine']): boolean {
  return left === right || (!!left && !!right && left.remaining === right.remaining && left.capacity === right.capacity);
}

function sameReload(left: HudCombatSnapshot['reload'], right: HudCombatSnapshot['reload']): boolean {
  return left === right || (!!left && !!right && left.duration === right.duration
    && left.remaining === right.remaining && left.startedAt === right.startedAt && left.source === right.source);
}
