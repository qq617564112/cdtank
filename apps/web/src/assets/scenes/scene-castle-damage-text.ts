export interface CastleDamageTextViewport {width: number; height: number;}
export type CastleDamageTextOrigin = readonly [number, number, number];

export interface CastleDamageTextProjection {
  x: number;
  y: number;
  depth: number;
  visible: boolean;
}

export type CastleDamageTextProjector = (origin: CastleDamageTextOrigin,
  viewport: CastleDamageTextViewport) => CastleDamageTextProjection;

export interface CastleDamageTextRecord {
  handle: number;
  x: number;
  y: number;
  elapsed: number;
  alpha: number;
  scale: number;
  origin?: CastleDamageTextOrigin;
}

export interface CastleDamageTextRenderer {
  create(text: string): number;
  draw(record: Readonly<CastleDamageTextRecord>, viewport: CastleDamageTextViewport): void;
  release(handle: number): void;
  dispose(): void;
}

/** Independent text records; world anchors are projected by the scene owner. */
export class SceneCastleDamageText {
  private readonly records: CastleDamageTextRecord[] = [];

  constructor(private readonly renderer: CastleDamageTextRenderer,
              private readonly screenYRate = 40) {}

  /** Screen-space text uses the supplied position and animated vertical offset. */
  show(screenX: number, screenY: number, delta: number): void {
    this.records.push({handle: this.renderer.create(String(delta)),
      x: Math.fround(screenX), y: Math.fround(screenY), elapsed: 0, alpha: 1, scale: 1});
  }

  /** Capture the world position by value; later actor movement cannot move this record. */
  showWorld(origin: CastleDamageTextOrigin, delta: number, screenOffsetY = 0): void {
    this.records.push({handle: this.renderer.create(String(delta)),
      x: 0, y: screenOffsetY, elapsed: 0, alpha: 1, scale: 1, origin: [...origin]});
  }

  /** Advance the original one-second drift and fade independently for each record. */
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

  draw(viewport: CastleDamageTextViewport, projectWorld?: CastleDamageTextProjector): void {
    for (const record of this.records) {
      if (!record.origin) {this.renderer.draw(record, viewport); continue;}
      const point = projectWorld!(record.origin, viewport);
      this.renderer.draw({...record, x: Math.fround(point.x + record.x),
        y: Math.fround(point.y + record.y), alpha: point.visible ? record.alpha : 0,
        scale: point.visible ? Math.fround(250 / Math.abs(Math.fround(point.depth)) + Math.fround(0.2)) : 1}, viewport);
    }
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
