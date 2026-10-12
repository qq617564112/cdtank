import {SceneCastleDamageText} from '../scenes/scene-castle-damage-text';
import type {CastleDamageTextRenderer} from '../scenes/scene-castle-damage-text';

/** Original selector0 actor queue, using the shared original numeric-text records. */
export class TankBenefitText extends SceneCastleDamageText {
  /** The player presentation owner retains and disposes the shared Benefit glyph renderer. */
  constructor(renderer: CastleDamageTextRenderer) {
    super({
      create: text => renderer.create(Number(text) > 0 ? `+${text}` : text),
      draw: (record, viewport) => renderer.draw(record, viewport),
      release: handle => renderer.release(handle),
      dispose: () => renderer.dispose(),
    }, -40);
  }

  /** The qualified actor HP observer supplies its confirmed positive difference. */
  show(screenX: number, screenY: number, increase: number, isLocal = false): void {
    super.show(screenX, isLocal ? Math.fround(screenY - 100) : screenY, increase | 0);
  }

  /** Actor destruction releases its records; the presentation owner owns the glyph resources. */
  dispose(): void {
    this.clear();
  }
}
