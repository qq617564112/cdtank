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
  status: string; commonPlacement: string; initial: {mapId: number; mode: number}[];
  observed: {draws: Draw[]; counts: Record<string, number>; captures: {draws: Draw[]; frame: number; canvas: string; world: unknown}[]; worlds: unknown[]}[];
  cleanup: Record<string, number>[]; reentry: Record<string, number>[]; reentryCleanup: Record<string, number>[];
};
const source = JSON.parse(readFileSync('recovery/output/scene-animation-0018-source.json', 'utf8')) as {
  status: string;
  placements: {id:string;position:number[];matrix:number[]}[];geometryNodes:number[];emptyParentNode:number;nodeCount:number;
};
const resource = JSON.parse(readFileSync('recovery/output/web-assets/scene-animation-0018.json', 'utf8')).resources[0] as EffectModelResource;
assert(['PASS','FAIL'].includes(run.status)); assert.equal(source.status, 'PASS');
const lifecycle=JSON.parse(readFileSync(lifecycleInput,'utf8')) as typeof run & {lifecycleOnly: boolean};
assert.equal(lifecycle.status,'PASS'); assert.equal(lifecycle.lifecycleOnly,true);
assert.equal(source.nodeCount,6); assert.equal(source.emptyParentNode,1); assert.deepEqual(source.geometryNodes,[0,2,3,4,5]);
assert(run.initial.every(world => world.mapId === 18 && world.mode === 4));
const placements=Object.fromEntries(source.placements.map(row=>{const matrix=[...row.matrix];matrix.splice(12,3,...row.position);return [row.id,matrix];}));
const common=run.commonPlacement;assert(placements[common]);
const owners=(run as typeof run & {owners:{id:string;matrix:number[];geometryNodes:number[];clocks:unknown[]}[][]}).owners;
for(const page of owners){assert.deepEqual(page.map(o=>o.id),['66','67','68','69']);for(const owner of page){assert.deepEqual(owner.matrix,placements[owner.id]);assert.deepEqual(owner.geometryNodes,source.geometryNodes);assert.equal(owner.clocks.length,6);assert.equal(owner.clocks[1],null);}}
const pages = [];
for (const [index, page] of run.observed.entries()) {
  const capture=page.captures.find(c=>(c as typeof c & {id:string}).id===common)!;assert(capture);
  assert.deepEqual([...new Set(capture.draws.map(draw=>draw.node))].sort(),source.geometryNodes);
  let maximumPositionError = 0;
  let maximumMatrixError = 0;
  for (const draw of [...page.draws,...page.captures.flatMap(c=>c.draws)]) {
    const placement=placements[draw.id];assert(placement); assert.equal(draw.source, resource.reference);
    assert.deepEqual(draw.placementMatrix, placement);
    assert.deepEqual(draw.worldMatrix, EFFECT_IDENTITY, 'CVD positions are transformed before Babylon mesh submission');
    assert.deepEqual(draw.texture, ['/Data/scnobj/obj05018/obj05018.png']);
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
  for (const node of source.geometryNodes) {
    const draws = page.draws.filter(draw => draw.id===common&&draw.node === node);
    assert(page.counts[common+':'+node]>=2);
    assert.equal(draws.length,3);
    assert.equal(new Set(draws.map(draw => JSON.stringify(draw.positions))).size,node===0?1:3);
    if(node!==0)assert(new Set(draws.map(draw => draw.clocks[node]!.time)).size > 1);
    assert.equal(new Set(draws.map(draw => JSON.stringify(draw.clocks[node]!.matrix))).size,node===0?1:3);
  }
  const png = `recovery/output/scene-animation-0018-accepted-${index+1}.png`;
  writeFileSync(png,Buffer.from(capture.canvas.split(',')[1],'base64'));
  pages.push({drawCounts:page.counts,maximumPositionError,maximumMatrixError,captureFrame:capture.frame,png,
    sourceTransformStates:source.geometryNodes.map(node => new Set(page.draws.filter(draw => draw.id===common&&draw.node===node).map(draw => JSON.stringify(draw.clocks[node]!.matrix))).size),
    sourceLocalVertexPoses:{0:1,2:1,3:1,4:1,5:1},worldPoses:{0:1,2:3,3:3,4:3,5:3}});
}
assert(lifecycle.cleanup.every(row => Object.values(row).every(value => value===0)));
assert(lifecycle.reentry.every(row => row.animations===4 && row.sourceMeshes===20 && row.sourceTextures===4));
assert(lifecycle.reentryCleanup.every(row => Object.values(row).every(value => value===0)));
writeFileSync('recovery/output/scene-animation-0018-actual.json',JSON.stringify({status:'PASS',sourceBrowser:input,sourceBrowserOverallStatus:run.status,lifecycleBrowser:lifecycleInput,
  sourceRawPlacements:source.placements,formalPlacementMatrices:placements,commonPlacement:common,pages,
  leaveAndReentryReleased:true,sourceStartPhase:'Web start0/rate1/independent page phase convention',
  boundaries:'Published source resource verified against original CVD/DDS; actual tracks and all submitted XYZ/UV/indices checked through existing original-matched samplers. Babylon mesh world matrix stays identity.',
},null,2)+'\n');
console.log('PASS: General66–69 dual five geometry node tracks/world-space XYZ/UV/indices/texture and Leave/reentry');
