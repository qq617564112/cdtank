import type {ShotDisplayMessage} from '../../../../shared/protocols/MsgRoomEvent';
import type {CombatCatalog} from '../../../../shared/combat/catalog';
import type {EffectRuntime} from '../../render/effects/runtime/effect-runtime';

/** Original423956/489ba8 selects item+10c, then skill+70/+7c at the shot endpoint. */
export class TankShotDisplay {
  constructor(private readonly runtime: Pick<EffectRuntime, 'spawnWorldEffect' | 'playShotSound'>,
              private readonly catalog: CombatCatalog) {}

  show(message: ShotDisplayMessage): void {
    const item = this.catalog.items.find(item => item.itemTableId === message.itemId);
    const skill = this.catalog.skills.find(skill => skill.skillId === item?.skillIds[1]);
    const effect = skill?.effects[0];
    if (!effect) return;
    const origin: [number, number, number] = [message.x, message.y, message.z].map(Math.fround) as [number, number, number];
    this.runtime.spawnWorldEffect(`_root\\online\\${String(effect.effectId).padStart(3, '0')}`, origin);
    this.runtime.playShotSound(effect.sound);
  }
}
