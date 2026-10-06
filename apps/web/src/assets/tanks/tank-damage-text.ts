import {SceneCastleDamageText} from '../scenes/scene-castle-damage-text';
import type {CastleDamageTextRenderer, CastleDamageTextViewport} from '../scenes/scene-castle-damage-text';

/** One actor's selector1 queue, using the shared original text record implementation. */
export class TankDamageText {
  private readonly queue: SceneCastleDamageText;
  private readonly criticalQueue?: SceneCastleDamageText;

  /** The player presentation owner retains and disposes the shared glyph renderer. */
  constructor(renderer: CastleDamageTextRenderer, criticalRenderer?: CastleDamageTextRenderer) {
    const queue = (renderer: CastleDamageTextRenderer): SceneCastleDamageText => new SceneCastleDamageText({
      create: text => renderer.create(Number(text) > 0 ? `+${text}` : text),
      draw: (record, viewport) => renderer.draw(record, viewport),
      release: handle => renderer.release(handle),
      dispose: () => renderer.dispose(),
    });
    this.queue = queue(renderer);
    if (criticalRenderer) this.criticalQueue = queue(criticalRenderer);
  }

  /** Original422877/467209/466d09: signed damage is negated; local screenY is shifted once. */
  show(screenX: number, screenY: number, damage: number, isLocal: boolean, critical = false): void {
    const value = -damage | 0;
    if (critical && !this.criticalQueue) throw new Error('原Critical文字资源尚未加载');
    (critical ? this.criticalQueue! : this.queue).show(screenX, isLocal ? Math.fround(screenY - 100) : screenY, value);
  }

  advance(actorDeltaSeconds: number, viewZ: number): void {
    this.queue.advance(actorDeltaSeconds, viewZ);
    this.criticalQueue?.advance(actorDeltaSeconds, viewZ);
  }

  draw(viewport: CastleDamageTextViewport): void {
    this.queue.draw(viewport);
    this.criticalQueue?.draw(viewport);
  }

  clear(): void {
    this.queue.clear();
    this.criticalQueue?.clear();
  }

  /** Actor destruction frees its records without disposing another actor's glyph resources. */
  dispose(): void {
    this.clear();
  }
}
