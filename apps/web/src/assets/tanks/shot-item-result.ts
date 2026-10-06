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
    if (attackerId === localId || ![2001, 2002, 2003, 2004, 2005, 2006, 2008, 2011, 2012, 2013, 2014, 2015, 2017, 2018, 2019, 2020, 2021].includes(message.itemId)) return;
    this.display.show(message);
    shotResult();
  }
}
