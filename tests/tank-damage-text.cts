import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {TankDamageText} from '../apps/web/src/assets/tanks/tank-damage-text';
import type {CastleDamageTextRecord, CastleDamageTextRenderer} from '../apps/web/src/assets/scenes/scene-castle-damage-text';

class RecordingRenderer implements CastleDamageTextRenderer {
  private sequence = 0;
  readonly text = new Map<number, string>();
  readonly drawn: CastleDamageTextRecord[] = [];
  disposed = false;
  create(text: string): number {const handle = ++this.sequence; this.text.set(handle, text); return handle;}
  draw(record: CastleDamageTextRecord): void {this.drawn.push({...record});}
  release(handle: number): void {this.text.delete(handle);}
  dispose(): void {this.disposed = true;}
}

const source = JSON.parse(readFileSync('recovery/output/actor-damage-text-source.json', 'utf8'));
const viewport = {width: 640, height: 360};
for (const row of source.rows.filter((row: {selector: number}) => row.selector === 1)) {
  const renderer = new RecordingRenderer();
  const actor = new TankDamageText(renderer);
  actor.show(100, 200, -row.value, false);
  assert.deepEqual([...renderer.text.values()], [row.events.at(-1).text]);
  actor.dispose();
  assert.equal(renderer.text.size, 0);
  assert.equal(renderer.disposed, false);
}

const renderer = new RecordingRenderer();
const local = new TankDamageText(renderer);
const remote = new TankDamageText(renderer);
local.show(320, 180, 43, true);
remote.show(320, 180, 43, false);
assert.deepEqual([...renderer.text.values()], ['-43', '-43']);
local.draw(viewport);
remote.draw(viewport);
assert.deepEqual(renderer.drawn.map(record => [record.x, record.y]), [[320, 80], [320, 180]]);
local.advance(0.25, 500);
remote.advance(0.25, 500);
renderer.drawn.length = 0;
local.draw(viewport);
remote.draw(viewport);
assert.deepEqual(renderer.drawn.map(record => [record.x, record.y]), [[320, 90], [320, 190]]);
local.dispose();
assert.deepEqual([...renderer.text.values()], ['-43']);
assert.equal(renderer.disposed, false);
remote.advance(0.75, 500);
assert.equal(renderer.text.size, 0);
remote.show(200, 250, 17, false);
remote.clear();
assert.equal(renderer.text.size, 0);
remote.show(220, 260, 12, false);
assert.deepEqual([...renderer.text.values()], ['-12']);
remote.dispose();
renderer.dispose();
assert(renderer.disposed);

const result = {status: 'PASS_ACTOR_DAMAGE_TEXT_MODULE_ONLY',
  source: 'recovery/output/actor-damage-text-source.json',
  sign: 'Original signed damage negation and positive-prefix formatting; no abs conversion.',
  localOffset: -100, queues: 'Independent actors sharing one glyph renderer.',
  cleanup: 'Actor removal releases only its records; presentation owner disposes renderer.',
  scope: 'Module composition, local/remote placement, native format cases and interleaved actor ownership. Shared record math and Damage font evidence reused. No formal hit or browser pixel claim.'};
writeFileSync('recovery/output/tank-damage-text-consumer.json', JSON.stringify(result, null, 2) + '\n');
console.log(result.status);
