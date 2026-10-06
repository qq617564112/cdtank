import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {EffectModelAnimation, effectModelVertices} from '../apps/web/src/render/effects/models/effect-model-animation';
import {EFFECT_IDENTITY, multiplyEffectMatrices} from '../apps/web/src/render/effects/common/effect-render-transform';
import {transformEffectPosition} from '../apps/web/src/render/effects/common/effect-native-space';

const run = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const poseCoverageGap = run.status === 'INCOMPLETE';
if (poseCoverageGap) {
  assert.deepEqual(run.failures, ['side0 original c9 pose change missing']);
} else {
  assert.equal(run.status, 'PASS');
}
assert(run.initial.every(world => world.mode === 1 && world.mapId === 10 && world.match.sceneObjects.filter(o => o.id.startsWith('ENV:')).length === 16 && world.match.sceneObjects.filter(o => o.id.startsWith('CASTLE:')).length === 2));
assert.deepEqual(run.acceptedTransactions[0], run.acceptedTransactions[1]);
for (const events of run.acceptedTransactions) {
  assert.equal(events.filter(e => e.type === 'sceneObjectDestroyed').length, 1);
  assert.equal(events.filter(e => e.type === 'sceneObjectHit').reduce((sum,e) => sum+e.value,0), 200);
}
const scene = JSON.parse(readFileSync('recovery/output/web-assets/scene-placements.json','utf8')).find(s => s.id === '0010');
for (const world of run.initial) {
  for (const source of scene.castles) {
    const castle = world.match.sceneObjects.find(o => o.id === `CASTLE:${source.id}`);
    assert(castle);
    assert.equal(castle.sourcePlacementId, source.id);
    assert.equal(castle.sourceModel, source.model);
    const sourceHp = Buffer.from(source.tail, 'hex').readUInt32LE(4);
    assert.equal(castle.hp, sourceHp);
    assert.equal(castle.maxHp, sourceHp);
  }
}
const placement = scene.records.find(p => p.id === '198');
assert.equal(placement.model, 'obj05425');
const library = JSON.parse(readFileSync('recovery/output/web-assets/scene-breach-0014.json','utf8'));
const resource = library.resources.find(r => r.reference === 'Data/scnobj/obj05425/c9.CVD');
const matrix = [...placement.matrix];matrix.splice(12,3,...placement.position);
const page = run.observed[0], capture = page.captures['198'];
const nodes = resource.nodes.flatMap((node,index) => node.parts.length ? [index] : []);
assert.deepEqual([...new Set(capture.draws.map(d => d.node))].sort((a,b)=>a-b), nodes);
assert(capture.draws.every(d => d.frame === capture.frame));
let maximumPositionError = 0, maximumMatrixError = 0;
for (const draw of [...page.draws.filter(d => d.id === '198' && d.broken), ...capture.draws]) {
  assert.equal(draw.sourceModel,resource.reference);
  assert.deepEqual(draw.placementMatrix,matrix);assert.deepEqual(draw.worldMatrix,EFFECT_IDENTITY);
  const matrices = [];
  for (const [index,node] of resource.nodes.entries()) {
    if (!node.animation) {matrices[index]=multiplyEffectMatrices(matrix,EFFECT_IDENTITY);continue;}
    const clock=draw.clocks[index], sample=new EffectModelAnimation(node.animation,node.duration);
    sample.setTime(clock.time);sample.update(0);
    const error=Math.max(...sample.matrix.map((v,i)=>Math.abs(v-clock.matrix[i])));
    assert(error<1e-4);maximumMatrixError=Math.max(maximumMatrixError,error);
    matrices[index]=multiplyEffectMatrices(node.parent==null?matrix:matrices[node.parent],sample.matrix);
  }
  const node=resource.nodes[draw.node], vertices=effectModelVertices(node.frames,node.times,draw.clocks[draw.node].time);
  const expected=vertices.flatMap(v=>{const p=transformEffectPosition(matrices[draw.node],v.slice(0,3));return[-p[0],p[1],p[2]];});
  assert.equal(draw.positions.length,expected.length);
  const error=Math.max(...expected.map((v,i)=>Math.abs(v-draw.positions[i])));
  assert(error<.001);maximumPositionError=Math.max(maximumPositionError,error);
  assert.deepEqual(draw.uvs,vertices.flatMap(v=>v.slice(6,8)));
  assert.deepEqual(draw.indices,node.parts[0].indices);assert.deepEqual(draw.textures,['/'+node.parts[0].asset]);
}
const sounds=page.sounds.filter(s=>s.sourcePlacementId==='198');assert.equal(sounds.length,1);
const sound=sounds[0];assert.equal(sound.reference,'GA32');assert.equal(sound.selector,1);
assert.deepEqual(sound.position,placement.position);assert(sound.playing&&sound.ended&&!sound.loop&&sound.outputPeak>0);
assert(page.visuals.some(v=>v.id==='198'&&v.fading&&!v.hidden&&!v.intactEnabled));
assert(page.visuals.some(v=>v.id==='198'&&v.hidden));
assert(run.cleanup.every(row=>Object.values(row).every(value=>value===0)));
const result={status:poseCoverageGap ? 'FINITE_MAP10_HOST198_C9_GA32_DUAL_LEAVE_POSE_COVERAGE_GAP' : 'PASS_FINITE_MAP10_HOST198_BROKEN_C9_GA32_DUAL_LEAVE',raw:process.argv[2],rawStatus:run.status,poseCoverageGap,
  model:'obj05425',sourcePlacementId:'198',geometryNodes:nodes,captureFrame:capture.frame,
  maximumPositionError,maximumMatrixError,sound,dualTransactions:run.acceptedTransactions,cleanup:run.cleanup,
  firstDraw:page.firstDraw,actualFrames:page.actualFrames,
  limits:['Host representative only; guest independent model pixels/audio and other placements remain unaccepted.',
    'HP200 and server permission/collision fade are reconstructed policy; no full-map/HD/original server claim.',
    ...(poseCoverageGap ? ['Only one actual broken pose; distinct live poses remain unverified.'] : [])]};
writeFileSync('recovery/output/scene-breach10-05425-actual.json',JSON.stringify(result,null,2)+'\n');
console.log(result.status);
