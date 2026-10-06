import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {TankBenefitText} from '../recovery/prepared/actor-benefit-text-consumer/apps/web/src/assets/tanks/tank-benefit-text';
import {TankDamageText} from '../recovery/prepared/actor-benefit-text-consumer/apps/web/src/assets/tanks/tank-damage-text';
import type {CastleDamageTextRecord, CastleDamageTextRenderer} from '../apps/web/src/assets/scenes/scene-castle-damage-text';

class RecordingRenderer implements CastleDamageTextRenderer {
  sequence = 0;
  readonly texts = new Map<number, string>();
  readonly records: CastleDamageTextRecord[] = [];
  disposed = false;
  create(text: string): number {const handle = ++this.sequence; this.texts.set(handle, text); return handle;}
  draw(record: CastleDamageTextRecord): void {this.records.push({...record});}
  release(handle: number): void {this.texts.delete(handle);}
  dispose(): void {this.disposed = true;}
}

const native = JSON.parse(readFileSync('recovery/output/actor-benefit-text-source.json', 'utf8'));
const viewport = {width: 640, height: 360};
const renderer = new RecordingRenderer();
const local = new TankBenefitText(renderer);
const remote = new TankBenefitText(renderer);
local.show(320, 200, 20, true);
remote.show(160, 180, 30, false);
assert.deepEqual([...renderer.texts.values()], ['+20', '+30']);
local.advance(.25, 500);
remote.advance(.25, 500);
local.draw(viewport);
remote.draw(viewport);
assert.deepEqual(renderer.records.map(record => [record.x, record.y, record.elapsed, record.alpha]),
  [[320, 90, .25, 1], [160, 170, .25, 1]]);
assert.equal(native.constructor.fields.screenYRate, -40);
local.advance(.5, 500);
renderer.records.length = 0;
local.draw(viewport);
assert.equal(renderer.records[0].y, 70);
assert.equal(renderer.records[0].alpha, .5);
local.dispose();
assert.deepEqual([...renderer.texts.values()], ['+30']);
assert.equal(renderer.disposed, false);
remote.advance(.75, 500);
assert.equal(renderer.texts.size, 0);
remote.show(100, 150, 17, false);
remote.clear();
assert.equal(renderer.texts.size, 0);

// The shared Y-rate parameter leaves the accepted selector1 direction and sign unchanged.
const damageRenderer = new RecordingRenderer();
const damage = new TankDamageText(damageRenderer);
damage.show(200, 150, 43, false);
damage.advance(.25, 500);
damage.draw(viewport);
assert.deepEqual([...damageRenderer.texts.values()], ['-43']);
assert.equal(damageRenderer.records[0].y, 160);
damage.dispose();
renderer.dispose();
damageRenderer.dispose();

const result = {status: 'PASS_PREPARED_BENEFIT_TEXT_MODULE_ONLY',
  source: 'recovery/output/actor-benefit-text-source.json',
  patch: 'recovery/prepared/actor-benefit-text-consumer.patch',
  scope: 'Prepared selector0 positive-prefix text, upward motion, local offset, fade/expiry and independent actor cleanup. One modified selector1 compatibility check; no old native/font suite rerun, live production import, HP observer integration or browser pixel claim.'};
writeFileSync('recovery/output/tank-benefit-text-prepared.json', JSON.stringify(result, null, 2) + '\n');
console.log(result.status);
