export interface CastleDamageTextViewport {width: number; height: number;}

export interface CastleDamageTextRecord {
  handle: number;
  x: number;
  y: number;
  elapsed: number;
  alpha: number;
  scale: number;
}

export interface CastleDamageTextRenderer {
  create(text: string): number;
  draw(record: Readonly<CastleDamageTextRecord>, viewport: CastleDamageTextViewport): void;
  release(handle: number): void;
  dispose(): void;
}

/** One Castle's original selector1 text queue; projection belongs to its scene owner. */
export class SceneCastleDamageText {
  private readonly records: CastleDamageTextRecord[] = [];

  constructor(private readonly renderer: CastleDamageTextRenderer,
              private readonly screenYRate = 40) {}

  /** Screen position is captured once by the accepted damage event. */
  show(screenX: number, screenY: number, delta: number): void {
    this.records.push({handle: this.renderer.create(String(delta)),
      x: Math.fround(screenX), y: Math.fround(screenY), elapsed: 0, alpha: 1, scale: 1});
  }

  /** Original45dbff/46449f: current camera depth changes scale, not the captured position. */
  advance(deltaSeconds: number, viewZ: number): void {
    const delta = Math.fround(deltaSeconds);
    const scale = Math.fround(250 / Math.abs(Math.fround(viewZ)) + Math.fround(0.2));
    for (let index = 0; index < this.records.length;) {
      const record = this.records[index];
      const elapsed = record.elapsed + delta;
      record.scale = scale;
      record.elapsed = Math.fround(elapsed);
      if (elapsed > 0.5) record.alpha = Math.fround((1 - elapsed) / 0.5);
      record.y = Math.fround(record.y + delta * this.screenYRate);
      if (elapsed >= 1) {
        this.renderer.release(record.handle);
        this.records.splice(index, 1);
      } else {
        index++;
      }
    }
  }

  draw(viewport: CastleDamageTextViewport): void {
    for (const record of this.records) this.renderer.draw(record, viewport);
  }

  /** Round/reset clears text records while retaining the loaded glyph resource owner. */
  clear(): void {
    for (const record of this.records) this.renderer.release(record.handle);
    this.records.length = 0;
  }

  dispose(): void {
    this.clear();
    this.renderer.dispose();
  }
}
