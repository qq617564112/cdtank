import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {EffectModelAnimation, effectModelVertices} from '../apps/web/src/render/effects/models/effect-model-animation';
import {EFFECT_IDENTITY, multiplyEffectMatrices} from '../apps/web/src/render/effects/common/effect-render-transform';
import {transformEffectPosition} from '../apps/web/src/render/effects/common/effect-native-space';

const run = JSON.parse(readFileSync(process.argv[2], 'utf8'));
assert(['PASS','INCOMPLETE'].includes(run.status));
const results: unknown[] = [];
assert(run.initial.every(world => world.mode === 1 && world.mapId === 2 && world.match.sceneObjects.filter(o => o.id.startsWith('ENV:')).length === 60 && world.match.sceneObjects.filter(o => o.id.startsWith('CASTLE:')).length === 2));
const scene = JSON.parse(readFileSync('recovery/output/web-assets/scene-placements.json','utf8')).find(s => s.id === '0002');
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
for (const representative of run.representatives) {
const {id,model,cue,asset} = representative;
const events = run.acceptedTransactions[id];
assert.deepEqual(events[0],events[1]);
assert(events[0].some(e=>e.type==='sceneObjectDestroyed'));
assert.equal(events[0].filter(e=>e.type==='sceneObjectHit').reduce((sum,e)=>sum+e.value,0),200);
const placement = scene.records.find(p => p.id === id);
assert.equal(placement.model, model);
const library = JSON.parse(readFileSync('recovery/output/web-assets/'+asset,'utf8'));
const resource = library.resources.find(r => r.reference === 'Data/scnobj/'+model+'/c9.CVD');
const matrix = [...placement.matrix];matrix.splice(12,3,...placement.position);
const page = run.observed[0], capture = page.captures[id];
const nodes = resource.nodes.flatMap((node,index) => node.parts.length ? [index] : []);
if(capture){
assert.deepEqual([...new Set(capture.draws.map(d => d.node))].sort((a,b)=>a-b), nodes);
assert(capture.draws.every(d => d.frame === capture.frame));
}
const observedNodes=[...new Set(page.draws.filter(d=>d.id===id&&d.broken).map(d=>d.node))].sort((a,b)=>a-b);
assert.deepEqual(observedNodes,nodes);
let maximumPositionError = 0, maximumMatrixError = 0;
for (const draw of [...page.draws.filter(d => d.id === id && d.broken), ...(capture?.draws ?? [])]) {
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
const sounds=page.sounds.filter(s=>s.sourcePlacementId===id);assert.equal(sounds.length,1);
const sound=sounds[0];assert.equal(sound.reference,cue);assert.equal(sound.selector,1);
assert.deepEqual(sound.position,placement.position);assert(sound.playing&&sound.ended&&!sound.loop&&sound.outputPeak>0);
assert(page.visuals.some(v=>v.id===id&&v.fading&&!v.hidden&&!v.intactEnabled));
assert(page.visuals.some(v=>v.id===id&&v.hidden));
assert(run.cleanup.every(row=>Object.values(row).every(value=>value===0)));
results.push({id,model,cue,geometryNodes:nodes,captureFrame:capture?.frame,
  maximumPositionError,maximumMatrixError,sound,
  actualFrames:page.actualFrames.filter(row=>row.id===id),transactions:events});
}
const result={status:run.status==='PASS'?'PASS_FINITE_MAP02_REMAINING_BREACH_THREE_CONSUMERS':'FINITE_MAP02_REMAINING_BREACH_COVERAGE_GAPS',raw:process.argv[2],rawStatus:run.status,failures:run.failures,
  results,cleanup:run.cleanup,firstDraw:run.observed.map(page=>page.firstDraw),
  limits:['Only new117/25,123/26,401/22 representatives; other31 placements source/formal-load only.',
    'Host geometry/pose and source-specific sounds; independent guest pixels/audio not implied.',
    'Original server/whole-map lifecycle/HD remain open; raw failures unchanged.']};
writeFileSync('recovery/output/scene-breach02-remaining-actual.json',JSON.stringify(result,null,2)+'\n');
console.log(result.status);
