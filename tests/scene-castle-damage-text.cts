import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SceneCastleDamageText} from '../apps/web/src/assets/scenes/scene-castle-damage-text';
import type {CastleDamageTextRecord, CastleDamageTextRenderer} from '../apps/web/src/assets/scenes/scene-castle-damage-text';

class RecordingRenderer implements CastleDamageTextRenderer {
  sequence = 0;
  readonly text = new Map<number, string>();
  readonly drawn: CastleDamageTextRecord[] = [];
  disposed = false;
  create(text: string): number {const handle = ++this.sequence; this.text.set(handle, text); return handle;}
  draw(record: CastleDamageTextRecord): void {this.drawn.push({...record});}
  release(handle: number): void {this.text.delete(handle);}
  dispose(): void {this.disposed = true;}
}

const oracle = JSON.parse(readFileSync('recovery/output/castle-damage-text-update-native.json', 'utf8'));
for (const row of oracle.rows) {
  const renderer = new RecordingRenderer();
  const queue = new SceneCastleDamageText(renderer);
  queue.show(320, row.input.y - row.input.elapsed * 40, 43);
  queue.advance(row.input.elapsed, 500);
  queue.advance(row.input.delta, 500);
  queue.draw({width: 800, height: 600});
  if (row.remove) {
    assert.equal(renderer.drawn.length, 0);
    assert.equal(renderer.text.size, 0);
  } else {
    const record = renderer.drawn[0];
    assert.equal(record.elapsed, row.elapsed);
    assert.equal(record.y, row.y);
    assert.equal(record.alpha, row.alpha);
    assert.equal(record.x, 320);
  }
  queue.dispose();
  assert.equal(renderer.text.size, 0);
  assert(renderer.disposed);
}

const renderer = new RecordingRenderer();
const queue = new SceneCastleDamageText(renderer);
queue.show(320, 180, 43);
queue.advance(0.5, 250);
queue.show(480, 300, 54);
queue.advance(0.25, -500);
queue.draw({width: 800, height: 600});
assert.deepEqual(renderer.drawn.map(record => [record.x, record.y, record.alpha]),
  [[320, 210, 0.5], [480, 310, 1]]);
assert.equal(renderer.drawn[0].scale, Math.fround(0.5 + Math.fround(0.2)));
queue.advance(0.25, 1000);
assert.deepEqual([...renderer.text.values()], ['54']);
queue.clear();
assert.equal(renderer.text.size, 0);
assert.equal(renderer.disposed, false);
queue.show(100, 200, 65);
assert.deepEqual([...renderer.text.values()], ['65']);
queue.dispose();
console.log('PASS: original text oracle, interleaved records, captured position, scale and owner cleanup');
