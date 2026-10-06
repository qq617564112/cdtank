export interface AmmoBurnState {
  ownerId: string;
  startedAt: number;
  nextTick: number;
}

export interface AmmoBurnParticipant {
  id: string;
  alive: boolean;
  burn?: AmmoBurnState;
}

/** Rebuilt4005 policy: an active nine-second burn is neither stacked nor refreshed. */
export function startAmmoBurn(target: AmmoBurnParticipant, ownerId: string, now: number): boolean {
  if (!target.alive || target.burn) return false;
  target.burn = {ownerId, startedAt: now, nextTick: 1};
  return true;
}

export function clearAmmoBurn(target: AmmoBurnParticipant): void {
  delete target.burn;
}

/** Source description supplies70 HP at3/6/9 seconds; damage authority is external. */
export function advanceAmmoBurn(target: AmmoBurnParticipant, now: number,
  ownerExists: (id: string) => boolean, damage: (ownerId: string, amount: number) => void): void {
  const burn = target.burn;
  if (!burn) return;
  if (!target.alive || !ownerExists(burn.ownerId)) {
    clearAmmoBurn(target);
    return;
  }
  while (burn.nextTick <= 3 && now - burn.startedAt >= burn.nextTick * 3000) {
    burn.nextTick++;
    damage(burn.ownerId, 70);
    if (target.burn !== burn) return;
    if (!target.alive || !ownerExists(burn.ownerId)) {
      clearAmmoBurn(target);
      return;
    }
  }
  if (burn.nextTick > 3) clearAmmoBurn(target);
}
