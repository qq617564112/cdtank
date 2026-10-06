import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {Matrix, Vector3, Viewport} from '@babylonjs/core';
import {EffectModelAnimation, effectModelVertices} from '../apps/web/src/render/effects/models/effect-model-animation';
import type {EffectModelResource} from '../apps/web/src/render/effects/models/effect-model-renderer';
import {EFFECT_IDENTITY, multiplyEffectMatrices} from '../apps/web/src/render/effects/common/effect-render-transform';
import {transformEffectPosition} from '../apps/web/src/render/effects/common/effect-native-space';
interface Clock {time:number;rate:number;matrix:number[];}
interface Draw {phase?:string;id:string;node:number;frame:number;source:string;positions:number[];uvs:number[];indices:number[];texture:string[];placementMatrix:number[];worldMatrix:number[];clocks:(Clock|null)[];}
interface Capture {id:string;frame:number;canvas:string;draws:Draw[];camera:{view:number[];projection:number[];width:number;height:number};world:{phase:string;mapId:number;mode:number;tick:number};}
interface Run {status:string;observed:{captures:Capture[];draws:Draw[];worlds?:{frame:number;world:{phase:string;tick:number}}[]}[];}
const inputs=process.argv.slice(2);
assert(inputs.length>0);
const source=JSON.parse(readFileSync('recovery/output/scene-animation-0018-source.json','utf8')) as {status:string;geometryNodes:number[];placements:{id:string;position:number[];matrix:number[]}[]};
const resource=JSON.parse(readFileSync('recovery/output/web-assets/scene-animation-0018.json','utf8')).resources[0] as EffectModelResource;
assert.equal(source.status,'PASS');assert.deepEqual(source.geometryNodes,[0,2,3,4,5]);assert.equal(resource.nodes.length,6);assert.equal(resource.nodes[1].parts.length,0);
const rows=inputs.map(input=>({input,run:JSON.parse(readFileSync(input,'utf8')) as Run}));
const placements=[];
const acceptedIds=(process.env.GENERAL18_VERIFY_IDS??'66,67,68').split(',');
for(const id of acceptedIds){
  const original=source.placements.find(p=>p.id===id)!;assert(original);
  const matrix=[...original.matrix];matrix.splice(12,3,...original.position);
  const pages=[];
  for(let page=0;page<2;page++){
    const candidates=rows.flatMap(row=>(row.run.observed[page]?.captures??[]).filter(c=>c.id===id).map(c=>({...row,capture:c})));
    assert(candidates.length,'Recorded dual-page capture for General'+id);
    const chosen=candidates.at(-1)!;const capture=chosen.capture;
    assert(capture.world.phase==='PLAYING'&&capture.world.mapId===18&&capture.world.mode===4);
    assert.deepEqual(capture.draws.map(d=>d.node).sort((a,b)=>a-b),source.geometryNodes);
    const draws=rows.flatMap(row=>row.run.observed[page]?.draws??[]).filter(d=>d.id===id);
    let maximumPositionError=0,maximumMatrixError=0;
    for(const draw of [...draws,...capture.draws]){
      assert.equal(draw.source,resource.reference);assert.deepEqual(draw.placementMatrix,matrix);assert.deepEqual(draw.worldMatrix,EFFECT_IDENTITY);assert.deepEqual(draw.texture,['/Data/scnobj/obj05018/obj05018.png']);
      const matrices:number[][]=[];
      for(const [index,node]of resource.nodes.entries()){
        const clock=draw.clocks[index];
        if(!node.animation){assert.equal(clock,null);matrices[index]=multiplyEffectMatrices(node.parent==null?matrix:matrices[node.parent],EFFECT_IDENTITY);continue;}
        assert(clock&&clock.rate===1);const sample=new EffectModelAnimation(node.animation,node.duration!);sample.setTime(clock.time);sample.update(0);
        const error=Math.max(...sample.matrix.map((value,axis)=>Math.abs(value-clock.matrix[axis])));assert(error<1e-4);maximumMatrixError=Math.max(maximumMatrixError,error);
        matrices[index]=multiplyEffectMatrices(node.parent==null?matrix:matrices[node.parent],sample.matrix);
      }
      const node=resource.nodes[draw.node],vertices=effectModelVertices(node.frames!,node.times!,draw.clocks[draw.node]!.time);
      const expected=vertices.flatMap(vertex=>{const p=transformEffectPosition(matrices[draw.node],vertex.slice(0,3)as[number,number,number]);return [-p[0],p[1],p[2]];});
      assert.equal(expected.length,draw.positions.length);const error=Math.max(...expected.map((v,i)=>Math.abs(v-draw.positions[i])));assert(error<.001);maximumPositionError=Math.max(maximumPositionError,error);
      assert.deepEqual(draw.uvs,vertices.flatMap(v=>v.slice(6,8)));assert.deepEqual(draw.indices,node.parts[0].indices);
    }
    const poses=source.geometryNodes.map(node=>{const seen=new Set<string>();const evidence=rows.flatMap(row=>(row.run.observed[page]?.draws??[]).filter(d=>d.id===id&&d.node===node).filter(d=>{const key=JSON.stringify(d.positions);if(seen.has(key))return false;seen.add(key);return true;}).map(d=>{const prior=(row.run.observed[page].worlds??[]).filter(w=>w.frame<=d.frame).at(-1);assert(d.phase==='PLAYING'||prior?.world.phase==='PLAYING');return {sourceBrowser:row.input,sourceBrowserOverallStatus:row.run.status,frame:d.frame,time:d.clocks[node]?.time,rate:d.clocks[node]?.rate,phase:d.phase??prior?.world.phase,phaseWorldFrame:prior?.frame,phaseWorldTick:prior?.world.tick};}));return {node,states:evidence.length,evidence};});
    assert(poses.every(p=>p.node===0?p.states===1:p.states>=3));
    const transform=Matrix.FromArray(capture.camera.view).multiply(Matrix.FromArray(capture.camera.projection)),viewport=new Viewport(0,0,capture.camera.width,capture.camera.height);
    const points=capture.draws.flatMap(d=>{const points=[];for(let i=0;i<d.positions.length;i+=3)points.push(Vector3.Project(new Vector3(...d.positions.slice(i,i+3)),Matrix.Identity(),transform,viewport));return points;});
    const bounds={minX:Math.min(...points.map(p=>p.x)),maxX:Math.max(...points.map(p=>p.x)),minY:Math.min(...points.map(p=>p.y)),maxY:Math.max(...points.map(p=>p.y)),minDepth:Math.min(...points.map(p=>p.z)),maxDepth:Math.max(...points.map(p=>p.z))};
    assert(bounds.minX>=0&&bounds.maxX<=capture.camera.width&&bounds.minY>=0&&bounds.maxY<=capture.camera.height&&bounds.minDepth>0&&bounds.maxDepth<1);
    assert(bounds.maxX-bounds.minX>=30&&bounds.maxY-bounds.minY>=20);
    const png='recovery/output/scene-animation-0018-coverage-'+id+'-'+(page+1)+'.png';writeFileSync(png,Buffer.from(capture.canvas.split(',')[1],'base64'));
    pages.push({page:page+1,sourceBrowser:chosen.input,sourceBrowserOverallStatus:chosen.run.status,frame:capture.frame,tick:capture.world.tick,png,bounds,poses,maximumPositionError,maximumMatrixError,camera:capture.camera});
  }
  placements.push({id,pages});
}
const existing69=JSON.parse(readFileSync('recovery/output/scene-animation-0018-route-actual.json','utf8'));assert.equal(existing69.status,'PASS');
const lifecycle=JSON.parse(readFileSync('recovery/output/browser-scene-animation-0018-2026-10-04T03-10-02-088Z.json','utf8'));assert.equal(lifecycle.status,'PASS');
writeFileSync('recovery/output/scene-animation-0018-coverage'+(acceptedIds.length===3?'':'-'+acceptedIds.join('-'))+'-actual.json',JSON.stringify({status:'PASS',acceptedIds,source:'scene-animation-0018-source.json',placements,placement69Reference:'scene-animation-0018-route-actual.json',lifecycleReference:'browser-scene-animation-0018-2026-10-04T03-10-02-088Z.json',boundaries:'Source-submitted geometry and real-camera projection; original canvas recognizability is separately reviewed. Web start0/rate1; original General startup/GPU/HD remain outside this consumer qualification.'},null,2)+'\n');
console.log('PASS: placements'+acceptedIds.join(',')+' dual five source draws, four dynamic nodes three poses, static fixed, original geometry/texture/clock and actual camera;69/lifecycle reused');
