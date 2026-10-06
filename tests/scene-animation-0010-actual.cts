import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {EffectModelAnimation, effectModelVertices} from '../apps/web/src/render/effects/models/effect-model-animation';
import type {EffectModelResource} from '../apps/web/src/render/effects/models/effect-model-renderer';
import {EFFECT_IDENTITY, multiplyEffectMatrices} from '../apps/web/src/render/effects/common/effect-render-transform';
import {transformEffectPosition} from '../apps/web/src/render/effects/common/effect-native-space';

interface Draw {
  id: string; node: number; frame: number; positions: number[]; uvs: number[]; indices: number[];
  texture: string[]; source: string; worldMatrix: number[]; placementMatrix: number[];
  clocks: ({time: number; loops: number; rate: number; matrix: number[]} | null)[];
}
const input = process.argv[2];
const lifecycleInput = process.argv[3];
const run = JSON.parse(readFileSync(input, 'utf8')) as {
  status: string; initial: {mapId: number; mode: number}[];
  observed: {draws: Draw[]; counts: Record<string, number>; captures: {draws: Draw[]; frame: number; canvas: string; world: unknown}[]; worlds: unknown[]}[];
  cleanup: Record<string, number>[]; reentry: Record<string, number>[]; reentryCleanup: Record<string, number>[];
};
const source = JSON.parse(readFileSync('recovery/output/scene-animation-0010-source.json', 'utf8')) as {
  status: string; record: {position: number[]; matrix: number[]};
  constantTracks: {constantSourceValues: boolean}[]; emptyNodes: number;
};
const resource = JSON.parse(readFileSync('recovery/output/web-assets/scene-animation-0010.json', 'utf8')).resources[0] as EffectModelResource;
assert.equal(run.status, 'FAIL'); assert.equal(source.status, 'PASS');
const lifecycle=JSON.parse(readFileSync(lifecycleInput,'utf8')) as typeof run & {lifecycleOnly: boolean};
assert.equal(lifecycle.status,'PASS'); assert.equal(lifecycle.lifecycleOnly,true);
assert.equal(source.constantTracks.length,6); assert.equal(source.emptyNodes,0);
assert(run.initial.every(world => world.mapId === 10 && world.mode === 1));
const placement = [...source.record.matrix]; placement.splice(12,3,...source.record.position);
const pages = [];
for (const [index, page] of run.observed.entries()) {
  assert.equal(page.captures.length, 1);
  assert.deepEqual([...new Set(page.captures[0].draws.map(draw => draw.node))].sort(), [0,1]);
  let maximumPositionError = 0;
  let maximumMatrixError = 0;
  for (const draw of [...page.draws,...page.captures[0].draws]) {
    assert.equal(draw.id, '106'); assert.equal(draw.source, resource.reference);
    assert.deepEqual(draw.placementMatrix, placement);
    assert.deepEqual(draw.worldMatrix, EFFECT_IDENTITY, 'CVD positions are transformed before Babylon mesh submission');
    assert.deepEqual(draw.texture, ['/Data/scnobj/obj05015/obj05015.png']);
    const matrices: number[][] = [];
    for (const [nodeIndex,node] of resource.nodes.entries()) {
      let local = [...EFFECT_IDENTITY];
      const clock = draw.clocks[nodeIndex];
      if (node.animation) {
        assert(clock && clock.rate === 1);
        const sampled = new EffectModelAnimation(node.animation, node.duration!);
        sampled.setTime(clock.time); sampled.update(0);
        local = [...sampled.matrix];
        const error = Math.max(...local.map((value,axis) => Math.abs(value-clock.matrix[axis])));
        assert(error < 1e-4); maximumMatrixError = Math.max(maximumMatrixError,error);
      }
      matrices[nodeIndex] = multiplyEffectMatrices(node.parent == null ? placement : matrices[node.parent],local);
    }
    const node = resource.nodes[draw.node];
    const clock = draw.clocks[draw.node]!;
    const vertices = effectModelVertices(node.frames!, node.times!, clock.time);
    const expected = vertices.flatMap(vertex => {
      const position = transformEffectPosition(matrices[draw.node], vertex.slice(0,3) as [number,number,number]);
      return [-position[0],position[1],position[2]];
    });
    assert.equal(draw.positions.length,expected.length);
    const error = Math.max(...expected.map((value,axis) => Math.abs(value-draw.positions[axis])));
    assert(error < .001); maximumPositionError = Math.max(maximumPositionError,error);
    assert.deepEqual(draw.uvs,vertices.flatMap(vertex => vertex.slice(6,8)));
    assert.deepEqual(draw.indices,node.parts[0].indices);
  }
  for (const node of [0,1]) {
    const draws = page.draws.filter(draw => draw.node === node);
    assert.equal(draws.length,node===1?3:1);
    assert.equal(new Set(draws.map(draw => JSON.stringify(draw.positions))).size,node===1?3:1);
    if(node===1)assert(new Set(draws.map(draw => draw.clocks[node]!.time)).size > 1);
    assert.equal(new Set(draws.map(draw => JSON.stringify(draw.clocks[node]!.matrix))).size,node===1?3:1);
  }
  const png = `recovery/output/scene-animation-0010-accepted-${index+1}.png`;
  writeFileSync(png,Buffer.from(page.captures[0].canvas.split(',')[1],'base64'));
  pages.push({drawCounts:page.counts,maximumPositionError,maximumMatrixError,captureFrame:page.captures[0].frame,png,
    sourceTransformStates:[0,1].map(node => new Set(page.draws.filter(draw => draw.node===node).map(draw => JSON.stringify(draw.clocks[node]!.matrix))).size),
    sourceLocalVertexPoses:{0:1,1:1},worldPoses:{0:1,1:3}});
}
assert(lifecycle.cleanup.every(row => Object.values(row).every(value => value===0)));
assert(lifecycle.reentry.every(row => row.animations===1 && row.sourceMeshes===2 && row.sourceTextures===1));
assert(lifecycle.reentryCleanup.every(row => Object.values(row).every(value => value===0)));
writeFileSync('recovery/output/scene-animation-0010-actual.json',JSON.stringify({status:'PASS',sourceBrowser:input,sourceBrowserOverallStatus:run.status,lifecycleBrowser:lifecycleInput,
  sourceRawMatrix:source.record.matrix,formalPlacementMatrix:placement,pages,
  leaveAndReentryReleased:true,sourceStartPhase:'Web start0/rate1/independent page phase convention',
  boundaries:'Published source resource verified against original CVD/DDS; actual tracks and all submitted XYZ/UV/indices checked through existing original-matched samplers. Babylon mesh world matrix stays identity.',
},null,2)+'\n');
console.log('PASS: General106 dual two source node tracks/world-space XYZ/UV/indices/texture and Leave/reentry');
