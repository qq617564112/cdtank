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
const ACTIVE_EFFECT_FIELDS = ['attackBoost', 'defenseBoost', 'speedBoost', 'turnBoost',
  'invincibility', 'opticalCamouflage', 'roleDisguise'] as const;

function activeEffects(local: PlayerSnapshot, previous?: HudCombatSnapshot['activeEffects']): HudCombatSnapshot['activeEffects'] {
  if (previous) {
    let index = 0;
    let unchanged = true;
    for (const field of ACTIVE_EFFECT_FIELDS) {
      const state = local[field];
      if (!state) continue;
      const cached = previous[index++];
      if (!cached || cached.skillId !== state.skillId || cached.expiresAt !== state.expiresAt) {
        unchanged = false; break;
      }
    }
    if (unchanged && index === previous.length) return previous;
  }
  const effects: {skillId: number; expiresAt: number}[] = [];
  for (const field of ACTIVE_EFFECT_FIELDS) {
    const state = local[field];
    if (state) effects.push({skillId: state.skillId, expiresAt: state.expiresAt});
  }
  return effects;
}

export function combatState(snapshot: MsgRoomSnapshot, local: PlayerSnapshot | undefined,
  serverNow = snapshot.serverTime, previous?: HudCombatSnapshot): HudCombatSnapshot {
  if (!local || (snapshot.phase !== 'PLAYING' && snapshot.phase !== 'FINISHED')) {
    return {visible: false, canUseShortcuts: false, alive: false, serverTime: snapshot.serverTime, ammoSlots: [], activeEffects: []};
  }
  const live = local.alive && snapshot.phase === 'PLAYING';
  const active = battleIsActive(snapshot, serverNow);
  const canUseShortcuts = live && active && !local.isAutopilot;
  const ammoSlots = local.ammoSlots ?? (previous?.ammoSlots.length === 0 ? previous.ammoSlots : []);
  const reload = live ? local.reload : undefined;
  const effects = live ? activeEffects(local, previous?.activeEffects)
    : previous?.activeEffects.length === 0 ? previous.activeEffects : [];
  if (previous?.visible && previous.canUseShortcuts === canUseShortcuts && previous.playerId === local.id
    && previous.alive === local.alive && previous.serverTime === snapshot.serverTime
    && previous.selectedAmmoSlot === local.selectedAmmoSlot && previous.ammoItemId === local.ammoItemId
    && sameMagazine(previous.magazine, local.ammoMagazine) && sameAmmoSlots(previous.ammoSlots, ammoSlots)
    && sameReload(previous.reload, reload) && previous.activeEffects === effects) return previous;
  return {
    visible: true,
    canUseShortcuts,
    playerId: local.id,
    alive: local.alive,
    serverTime: snapshot.serverTime,
    selectedAmmoSlot: local.selectedAmmoSlot,
    ammoItemId: local.ammoItemId,
    magazine: local.ammoMagazine,
    ammoSlots,
    reload,
    activeEffects: effects,
  };
}

export function sameCombatState(left: HudCombatSnapshot, right: HudCombatSnapshot): boolean {
  if (left === right) return true;
  if (left.visible !== right.visible || left.canUseShortcuts !== right.canUseShortcuts
      || left.playerId !== right.playerId || left.alive !== right.alive
      || left.serverTime !== right.serverTime || left.selectedAmmoSlot !== right.selectedAmmoSlot
      || left.ammoItemId !== right.ammoItemId || !sameMagazine(left.magazine, right.magazine)
      || !sameAmmoSlots(left.ammoSlots, right.ammoSlots) || left.activeEffects.length !== right.activeEffects.length
      || !sameReload(left.reload, right.reload)) return false;
  for (let index = 0; index < left.activeEffects.length; index++) {
    const effect = left.activeEffects[index];
    const next = right.activeEffects[index];
    if (effect.skillId !== next.skillId || effect.expiresAt !== next.expiresAt) return false;
  }
  return true;
}

function sameAmmoSlots(left: HudCombatSnapshot['ammoSlots'], right: HudCombatSnapshot['ammoSlots']): boolean {
  if (left === right) return true;
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index++) {
    const slot = left[index], next = right[index];
    if (slot.slot !== next.slot || slot.itemTableId !== next.itemTableId || slot.quantity !== next.quantity) return false;
  }
  return true;
}

function sameMagazine(left: HudCombatSnapshot['magazine'], right: HudCombatSnapshot['magazine']): boolean {
  return left === right || (!!left && !!right && left.remaining === right.remaining && left.capacity === right.capacity);
}

function sameReload(left: HudCombatSnapshot['reload'], right: HudCombatSnapshot['reload']): boolean {
  return left === right || (!!left && !!right && left.duration === right.duration
    && left.remaining === right.remaining && left.startedAt === right.startedAt && left.source === right.source);
}
