import type {SceneObjectSnapshot} from '../../../shared/protocols';

/** Match the original accepted Castle damage/repair action transition. */
export function setCastleDamageAnimation(target: SceneObjectSnapshot, previousHp: number, now: number): void {
  if (!target.id.startsWith('CASTLE:')) return;
  const low = target.hp > 0 && target.hp < Math.trunc(target.maxHp / 3);
  const enteredLow = low && previousHp >= Math.trunc(target.maxHp / 3);
  target.castleAnimation = {action: target.hp === 0 ? 'c3' : enteredLow ? 'c2' : low ? 'n2' : 'n1',
    startedAt: now, stopAtEnd: target.hp > 0 && !enteredLow};
}
