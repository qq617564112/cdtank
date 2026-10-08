import {itemForHandler, gameContent} from '../../../../shared/content/catalog';
export interface AmmoBurnState {
  ownerId: string;
  skillId: number;
  itemId: number;
  ticks: number;
  intervalMs: number;
  damage: number;
  startedAt: number;
  nextTick: number;
}

export interface AmmoBurnParticipant {
  id: string;
  alive: boolean;
  burn?: AmmoBurnState;
}

/** Rebuilt4005 policy: an active nine-second burn is neither stacked nor refreshed. */
export function startAmmoBurn(target: AmmoBurnParticipant, ownerId: string, now: number, itemId = itemForHandler('hit', 'burn').id): boolean {
  if (!target.alive || target.burn) return false;
  const rule = gameContent().items.get(itemId)!;
  target.burn = {ownerId, startedAt: now, nextTick: 1, itemId, skillId: rule.runtime.skillRoles.secondary,
    ticks: rule.runtime.values.burnTicks, intervalMs: rule.runtime.values.burnIntervalMs,
    damage: rule.runtime.values.burnDamage};
  return true;
}

export function clearAmmoBurn(target: AmmoBurnParticipant): void {
  delete target.burn;
}

/** Source description supplies70 HP at3/6/9 seconds; damage authority is external. */
export function advanceAmmoBurn(target: AmmoBurnParticipant, now: number,
  ownerExists: (id: string) => boolean, damage: (ownerId: string, amount: number) => void,
  onNaturalEnd?: (burn: AmmoBurnState) => void): void {
  const burn = target.burn;
  if (!burn) return;
  if (!target.alive || !ownerExists(burn.ownerId)) {
    clearAmmoBurn(target);
    return;
  }
  while (burn.nextTick <= burn.ticks && now - burn.startedAt >= burn.nextTick * burn.intervalMs) {
    burn.nextTick++;
    damage(burn.ownerId, burn.damage);
    if (target.burn !== burn) return;
    if (!target.alive || !ownerExists(burn.ownerId)) {
      clearAmmoBurn(target);
      return;
    }
  }
  if (burn.nextTick > burn.ticks) {
    clearAmmoBurn(target);
    onNaturalEnd?.(burn);
  }
}
