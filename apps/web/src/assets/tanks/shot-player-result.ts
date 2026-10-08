import {gameContent} from '../../../../shared/content/catalog';
import type {CombatCatalog} from '../../../../shared/combat/catalog';
import type {EffectRuntime} from '../../render/effects/runtime/effect-runtime';
import type {TankView} from './tank-view';

/** Original424614 dispatches item TriggerType8 skills to the victim before local-role branching. */
export class TankShotPlayerResult {
  constructor(private readonly runtime: Pick<EffectRuntime, 'spawnAttachedEffect' | 'playSkillSound'>,
              private readonly catalog: CombatCatalog) {}

  /** Confirmed2001–2006,2008–2016 and2017–2021 victim skills use retention0 and spatial selector1. */
  showPlayerResult(victim: TankView, itemId: number, localView?: TankView): void {
    if (!gameContent().items.get(itemId)?.runtime.victimShotResult) return;
    const item = this.catalog.items.find(item => item.itemTableId === itemId);
    const skill = this.catalog.skills.find(skill => item?.skillIds.includes(skill.skillId) && skill.triggerType === 8);
    const effect = skill?.effects[0];
    if (!effect) return;
    this.runtime.spawnAttachedEffect(victim, effect.effectId, effect.tag, true, localView);
    this.runtime.playSkillSound(victim, effect.sound, 1);
  }
}
