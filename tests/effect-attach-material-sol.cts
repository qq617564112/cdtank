import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {EffectAttachMaterialCache} from '../apps/web/src/render/effects/models/effect-attach-material-sol';

import {Constants, NullEngine, Scene, Texture, VertexBuffer} from '@babylonjs/core';
import {EffectModelLibrary, EffectModelRenderer} from '../apps/web/src/render/effects/models/effect-model-renderer';
import {effectModelAmbient} from '../apps/web/src/render/effects/models/effect-model-material';
import {EFFECT_IDENTITY} from '../apps/web/src/render/effects/common/effect-render-transform';

interface Submission {part: number; kind: number; flags: number; matrix: number[];}
interface Step {alpha: number; blend: 0 | 1; lookups: number; allocations: number; submissions: Submission[];}
interface Row {reference: string; node: number; fvf: number; firstAlpha: number; steps: Step[];}
const original = JSON.parse(readFileSync('recovery/output/effect-attach-material-sol-native.json', 'utf8')) as {rows: Row[]};
let submissions = 0;
let retainedOpaque = 0;
let retainedTransparent = 0;
for (const row of original.rows) {
  const caches = row.steps[0].submissions.map(() => new EffectAttachMaterialCache());
  for (const step of row.steps) {
    for (const submission of step.submissions) {
      const selected = caches[submission.part].select(row.fvf, submission.kind, step.blend);
      assert.equal(selected.flags, submission.flags);
      if (submission.kind === 0 && step.alpha !== row.firstAlpha) {
        if (row.firstAlpha === 1) retainedOpaque++;
        else retainedTransparent++;
      }
      submissions++;
    }
  }
}
assert.ok(retainedOpaque > 0);
assert.ok(retainedTransparent > 0);
console.log(`PASS: ${original.rows.length} full original attach sequences / ${submissions} cached source selections; ${retainedOpaque} opaque and ${retainedTransparent} transparent transitions retained`);

// Real renderer instances retain script state while live alpha uniforms change.
const library = JSON.parse(readFileSync('recovery/output/web-assets/effect-models.json', 'utf8')) as EffectModelLibrary;
const engine = new NullEngine();
const scene = new Scene(engine);
const texture = new Texture(null, scene);
const textures = new Map<string, Texture>();
for (const resource of library.resources) {
  for (const node of resource.nodes) for (const part of node.parts) if (part.asset) textures.set(part.asset, texture);
}
let production = 0;
for (const resource of library.resources.filter(resource => resource.resolution === 'published' &&
  resource.nodes.every(node => node.parts.every(part => part.asset)))) {
  // New renderer instances are constructed for the two opposite first states.
  for (const firstAlpha of [1, .375]) {
    const renderer = new EffectModelRenderer(scene, resource, library, textures, () => 0, 0, resource.reference);
    let previousMeshes: typeof renderer.meshes | undefined;
    for (const stepIndex of [0, 1, 2]) {
      const rows = original.rows.filter(row => row.reference === resource.reference && row.firstAlpha === firstAlpha);
      const alpha = rows[0].steps[stepIndex].alpha;
      const matrix = [...EFFECT_IDENTITY];
      matrix[12] = stepIndex * 3;
      matrix[13] = -2;
      matrix[14] = 5;
      renderer.draw({matrix, alpha, blend: alpha < 1 ? 1 : 0, priority: alpha < 1 ? -2 : 0});
      if (previousMeshes) assert.deepEqual(renderer.meshes, previousMeshes);
      previousMeshes = renderer.meshes;
      let meshIndex = 0;
      for (const row of rows) for (const submission of row.steps[stepIndex].submissions) {
        const mesh = renderer.meshes[meshIndex++];
        const material = mesh.material!;
        const transparent = (submission.flags & 0x80) !== 0;
        assert.equal(material.needAlphaBlending(), transparent);
        assert.equal(material.alphaMode, transparent ? Constants.ALPHA_COMBINE : Constants.ALPHA_DISABLE);
        // Non-c1 sections publish the live source ambient/alpha as vertex colors.
        const expected = effectModelAmbient(resource.nodes[row.node].parts[submission.part].properties, alpha, library.graphics);
        if (!(row.fvf & 4)) {
          const colors = mesh.getVerticesData(VertexBuffer.ColorKind)!;
          assert.deepEqual(Array.from(colors.slice(0, 4)), expected);
        }
        production++;
      }
    }
    renderer.dispose();
    assert.equal(scene.meshes.length, 0);
  }
}
texture.dispose();
scene.dispose();
engine.dispose();
console.log(`PASS: ${production} production source section submissions retain first material and update alpha; disposal/new instances reset cache`);
