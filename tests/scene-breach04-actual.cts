import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {EffectModelAnimation,effectModelVertices} from '../apps/web/src/render/effects/models/effect-model-animation';
import {EFFECT_IDENTITY,multiplyEffectMatrices} from '../apps/web/src/render/effects/common/effect-render-transform';
import {transformEffectPosition} from '../apps/web/src/render/effects/common/effect-native-space';
const run=JSON.parse(readFileSync(process.argv[2],'utf8'));
const source=JSON.parse(readFileSync('recovery/output/scene-breach04-source.json','utf8'));
const library=JSON.parse(readFileSync('recovery/output/web-assets/scene-breach-0004.json','utf8'));
assert.equal(run.status,'PASS');
assert(run.initial.every(w=>w.mode===1&&w.mapId===4&&w.match.sceneObjects.length===17));
const rows=[];
const samples=[{model:'obj05466',id:'479',pageIndices:[0,1],representative:false}];

for(const {model,id,pageIndices,representative}of samples){
 const proof=source,placement=proof.placements.find(p=>p.id===id);
 const resource=library.resources.find(r=>r.reference==='Data/scnobj/'+model+'/c9.CVD');
 const matrix=[...placement.matrix];matrix.splice(12,3,...placement.position);
 const events=[];
 for(const pageIndex of pageIndices){
  const page=run.observed[pageIndex];
  const relevant=page.events.filter(e=>e.targetId==='ENV:'+id);
  assert.equal(relevant.filter(e=>e.type==='sceneObjectDestroyed').length,1);
  const hits=relevant.filter(e=>e.type==='sceneObjectHit');assert.equal(hits.reduce((sum,e)=>sum+e.value,0),200);events.push(relevant);
  const capture=page.captures[id];assert.deepEqual([...new Set(capture.draws.map(d=>d.node))].sort((a,b)=>a-b),proof.geometryNodes);
  let maximumPositionError=0,maximumMatrixError=0;
  for(const draw of [...page.draws.filter(d=>d.id===id&&d.broken),...capture.draws]){
   assert.equal(draw.sourceModel,resource.reference);assert.deepEqual(draw.placementMatrix,matrix);assert.deepEqual(draw.worldMatrix,EFFECT_IDENTITY);
   const matrices=[];
   for(const [index,node]of resource.nodes.entries()){
    if(!node.animation){matrices[index]=multiplyEffectMatrices(matrix,EFFECT_IDENTITY);continue;}
    const clock=draw.clocks[index],sample=new EffectModelAnimation(node.animation,node.duration);sample.setTime(clock.time);sample.update(0);
    const error=Math.max(...sample.matrix.map((v,i)=>Math.abs(v-clock.matrix[i])));assert(error<1e-4);maximumMatrixError=Math.max(maximumMatrixError,error);
    matrices[index]=multiplyEffectMatrices(node.parent==null?matrix:matrices[node.parent],sample.matrix);
   }
   const node=resource.nodes[draw.node],vertices=effectModelVertices(node.frames,node.times,draw.clocks[draw.node].time);
   const expected=vertices.flatMap(v=>{const p=transformEffectPosition(matrices[draw.node],v.slice(0,3));return[-p[0],p[1],p[2]];});
   assert.equal(draw.positions.length,expected.length);const error=Math.max(...expected.map((v,i)=>Math.abs(v-draw.positions[i])));assert(error<.001);maximumPositionError=Math.max(maximumPositionError,error);
   assert.deepEqual(draw.uvs,vertices.flatMap(v=>v.slice(6,8)));assert.deepEqual(draw.indices,node.parts[0].indices);
   assert.deepEqual(draw.textures,['/'+node.parts[0].asset]);
  }
  const sounds=page.sounds.filter(s=>s.sourcePlacementId===id);assert.equal(sounds.length,1);const sound=sounds[0];
  assert.equal(sound.reference,'GA13');assert(sound.playing&&sound.ended&&!sound.loop);assert.equal(sound.selector,1);assert.deepEqual(sound.position,placement.position);assert(sound.duration>0);assert(sound.outputPeak>0&&sound.masterGain>0);
  assert(page.visuals.some(v=>v.id===id&&v.fading&&!v.hidden&&!v.intactEnabled));assert(page.visuals.some(v=>v.id===id&&v.hidden));
  rows.push({model,id,representative,page:pageIndex+1,geometryNodes:proof.geometryNodes,maximumPositionError,maximumMatrixError,sound,captureFrame:capture.frame});
 }
 if(pageIndices.length===2)assert.deepEqual(events[0],events[1]);
}
assert(run.passage.beforeProjection<0&&run.passage.afterProjection>25);
assert(run.cleanup.every(r=>Object.values(r).every(v=>v===0)));
const output={status:'PASS',input:process.argv[2],scope:'Original map4 placement479 ordinary destruction, dual geometry/texture/GA13 output/end/fade/hidden, normal post-release passage and Leave. Source/native/rematch contract reused07/21; no map4 rematch or all17 instances claim.',rows,transactions:run.acceptedTransactions,passage:{beforeProjection:run.passage.beforeProjection,afterProjection:run.passage.afterProjection,durationMs:run.passage.durationMs},cleanup:run.cleanup};
writeFileSync('recovery/output/scene-breach04-actual.json',JSON.stringify(output,null,2)+'\n');
console.log('PASS: map4 ENV479 dual original XYZ/UV/indices/textures/GA13 output, ordinary destruction/passage/Leave');
