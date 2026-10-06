import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {NullEngine, Scene, Texture} from '@babylonjs/core';
import {TankDamageText} from '../apps/web/src/assets/tanks/tank-damage-text';
import {TankCriticalTextRenderer} from '../apps/web/src/render/tank-critical-text-renderer';
import type {CastleDamageTextFont} from '../apps/web/src/render/scene-castle-damage-text-renderer';
import type {CastleDamageTextRecord, CastleDamageTextRenderer} from '../apps/web/src/assets/scenes/scene-castle-damage-text';

const fonts = JSON.parse(readFileSync('recovery/output/web-assets/ui-fonts.json', 'utf8'));
const font = fonts.fonts.find((value: CastleDamageTextFont) => value.name === 'Critical');
const ui = JSON.parse(readFileSync('recovery/output/web-assets/ui.json', 'utf8'));
const set = ui.imagesets.find((value: {path: string}) => value.path === 'ui/imagesets/zhandou0_0.imageset');
const image = {...set.images.find((value: {Name: string}) => value.Name === 'data\\ui\\zhandou\\1_baojishuziditu.tga'), attributes: set.attributes};
assert.equal(image.asset, 'ui/regions/44/11.png');

class OrdinaryRenderer implements CastleDamageTextRenderer {
  text: string[] = [];
  create(text: string): number {this.text.push(text); return this.text.length;}
  draw(): void {}
  release(): void {}
  dispose(): void {}
}

const engine = new NullEngine();
const scene = new Scene(engine);
const critical = new TankCriticalTextRenderer(scene, font, image);
// Fixture supplies loaded textures only; real create/draw/release and mesh geometry run.
const internals = critical as unknown as {glyphs: {resources: Map<number, unknown>}; imageRenderer: {resources: Map<number, unknown>}};
for (const glyph of font.glyphs) internals.glyphs.resources.set(glyph.codepoint, {glyph, texture: new Texture(null, scene)});
internals.imageRenderer.resources.set(0, {glyph: {codepoint: 0, asset: image.asset, width: 110, height: 82}, texture: new Texture(null, scene)});
const ordinary = new OrdinaryRenderer();
const host = new TankDamageText(ordinary, critical);
const guest = new TankDamageText(ordinary, critical);
host.show(400, 300, 43, true, true);
guest.show(400, 300, 86, false, true);
assert.equal(ordinary.text.length, 0);
host.draw({width: 800, height: 600});
const visible = scene.meshes.filter(mesh => mesh.isEnabled());
assert.equal(visible.length, 3); // Original image plus two digits; missing minus stays blank.
const positions = visible.map(mesh => Array.from(mesh.getVerticesData('position')!));
const attached = visible.find(mesh => mesh.alphaIndex === 0)!;
assert.deepEqual(Array.from(attached.getVerticesData('position')!),
  [345, 159, 0, 455, 159, 0, 455, 241, 0, 345, 241, 0]);
assert(positions.some(row => row[1] === 186));
host.show(400, 300, 12, false);
assert.deepEqual(ordinary.text, ['-12']);
host.clear();
assert.equal(scene.meshes.length, 3); // Clearing one actor retains the other's records.
guest.advance(0.75, 500);
guest.draw({width: 1600, height: 1200});
const imageMesh = scene.meshes.find(mesh => mesh.alphaIndex === 0)!;
const scaledPositions = imageMesh.getVerticesData('position')!;
assert(Math.abs((scaledPositions[3] - scaledPositions[0]) - 154) < 0.0001);
assert(Math.abs((scaledPositions[7] - scaledPositions[1]) - 114.8) < 0.0001);
const recordMaterial = imageMesh.material as unknown as {getEffect(): unknown; _floats: Record<string, number>};
assert.equal(recordMaterial._floats.textAlpha, 0.5);
assert.equal(scene.meshes.filter(mesh => mesh.isEnabled()).length, 3);
guest.advance(0.25, 500);
assert.equal(scene.meshes.length, 0);
guest.show(100, 100, 1, false, true);
guest.dispose();
assert.equal(scene.meshes.length, 0);
critical.dispose();
scene.dispose(); engine.dispose();

const result = {status: 'PASS_CRITICAL_TEXT_COMPOSITION_MODULE_SCOPE',
  source: 'actor-critical-combo-static.json', image: image.asset, font: 'Critical',
  accepted: ['selector2 image and digit composition', 'signed damage without replacement minus',
    'local Y-100', 'ordinary selector1 isolation', 'interleaved actor clearing', 'natural fade and expiry'],
  scope: 'NullEngine real geometry with loaded texture fixtures; no GPU upload, original CEGUI runtime, formal hit or browser pixel claim.'};
writeFileSync('recovery/output/tank-critical-text-consumer.json', JSON.stringify(result, null, 2) + '\n');
console.log(result.status);
