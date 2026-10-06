import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Constants, Material, NullEngine, Scene, Texture} from '@babylonjs/core';
import {effectModelMaterialSelection} from '../apps/web/src/render/effects/models/effect-material-combo-sol';
import {effectModelScript} from '../apps/web/src/render/effects/models/effect-model-material';
import {EffectModelLibrary, EffectModelRenderer} from '../apps/web/src/render/effects/models/effect-model-renderer';
import {EFFECT_IDENTITY} from '../apps/web/src/render/effects/common/effect-render-transform';
interface Row {reference: string; node: number; part: number; fvf: number; kind: number;
  blend: 0 | 1; alpha: number; flags: number; script: string;}
const original = JSON.parse(readFileSync('recovery/output/effect-material-combo-sol-native.json', 'utf8')) as {
  rows: Row[]; trees: {reference: string; blend: 0 | 1; alpha: number; inherited: {blend: number; alpha: number}[]}[];
};
const library = JSON.parse(readFileSync('recovery/output/web-assets/effect-models.json', 'utf8')) as EffectModelLibrary;
for (const row of original.rows) {
  assert.deepEqual(effectModelMaterialSelection(row.fvf, row.kind, row.blend), {flags: row.flags, script: row.script});
  assert.equal(effectModelScript(row.fvf, row.kind, row.alpha), row.script);
}
const engine = new NullEngine();
const scene = new Scene(engine);
const texture = new Texture(null, scene);
const textures = new Map<string, Texture>();
for (const resource of library.resources) {
  for (const node of resource.nodes) for (const part of node.parts) if (part.asset) textures.set(part.asset, texture);
}
let submissions = 0;
let missing = 0;
for (const resource of library.resources.filter(row => row.resolution === 'published')) {
  if (resource.nodes.some(node => node.parts.some(part => !part.asset))) {
    assert.throws(() => new EffectModelRenderer(scene, resource, library, textures, () => 0, 0, resource.reference),
      /Missing original model texture/);
    missing++;
    continue;
  }
  for (const tree of original.trees.filter(row => row.reference === resource.reference)) {
    const renderer = new EffectModelRenderer(scene, resource, library, textures, () => 0, 0, resource.reference);
    renderer.draw({matrix: [...EFFECT_IDENTITY], alpha: tree.alpha, blend: tree.blend, priority: tree.blend ? -2 : 0});
    const rows = original.rows.filter(row => row.reference === resource.reference && row.alpha === tree.alpha);
    assert.equal(renderer.meshes.length, rows.length);
    for (let index = 0; index < rows.length; index++) {
      const row = rows[index];
      const material = renderer.meshes[index].material!;
      const suppliedStates = new Map<string, string>();
      for (const name of ['default', row.script]) {
        library.scripts.find(script => script.name === name)!.states.forEach(state => suppliedStates.set(state.name, state.value));
      }
      assert.equal(material.backFaceCulling, suppliedStates.get('CullMode') !== 'NONE');
      assert.equal(material.sideOrientation, suppliedStates.get('CullMode') === 'CW' ?
        Material.ClockWiseSideOrientation : Material.CounterClockWiseSideOrientation);
      assert.equal(material.disableDepthWrite, suppliedStates.get('ZWriteEnable') !== 'TRUE');
      assert.equal(material.depthFunction, suppliedStates.get('ZEnable') === 'TRUE' ? Constants.LESS : Constants.ALWAYS);
      assert.equal(material.alphaMode, suppliedStates.get('AlphaBlendEnable') === 'TRUE' ? Constants.ALPHA_COMBINE : Constants.ALPHA_DISABLE);
      assert.equal(material.needAlphaBlending(), suppliedStates.get('AlphaBlendEnable') === 'TRUE');
      submissions++;
    }
    renderer.dispose();
    assert.equal(scene.meshes.length, 0);
  }
}
texture.dispose();
scene.dispose();
engine.dispose();
console.log(`PASS: ${original.rows.length} original material selections / ${submissions} production source mesh states; ${missing} original missing-texture resource rejected`);
