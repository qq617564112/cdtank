import {gameContent} from '../../../../shared/content/catalog';
import type {CombatCatalog} from '../../../../shared/combat/catalog';
import type {ShotDisplayMessage} from '../../../../shared/protocols/MsgRoomEvent';
import type {EffectRuntime} from '../../render/effects/runtime/effect-runtime';
import {TankShotDisplay} from './shot-display';

/** Original4247aa forwards the scene-result endpoint only for a remote attacker. */
export class TankShotItemResult {
  private readonly display: TankShotDisplay;

  constructor(runtime: Pick<EffectRuntime, 'spawnWorldEffect' | 'playShotSound'>,
              catalog: CombatCatalog) {
    this.display = new TankShotDisplay(runtime, catalog);
  }

  /** Original423956 endpoint precedes423092 feedback, separate from BeforeShot. */
  show(message: ShotDisplayMessage, attackerId: string, localId: string,
    shotResult: () => void): void {
    if (attackerId === localId || !gameContent().items.get(message.itemId)?.runtime.remoteShotResult) return;
    this.display.show(message);
    shotResult();
  }
}
