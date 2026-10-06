import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {Matrix, Vector3, Viewport} from '@babylonjs/core';
import {getSceneBreakables} from '../apps/server/src/scene-objects';
import {segmentBox} from '../apps/server/src/battlefield';
import {EffectModelAnimation, effectModelVertices} from '../apps/web/src/render/effects/models/effect-model-animation';
import type {EffectModelResource} from '../apps/web/src/render/effects/models/effect-model-renderer';
import {EFFECT_IDENTITY, multiplyEffectMatrices} from '../apps/web/src/render/effects/common/effect-render-transform';
import {transformEffectPosition} from '../apps/web/src/render/effects/common/effect-native-space';
interface Draw {id: string; node: number; frame: number; broken: boolean; sourceModel: string; positions: number[];
  uvs: number[]; indices: number[]; textures: string[]; worldMatrix: number[]; placementMatrix: number[];
  clocks: ({time: number; rate: number; matrix: number[]} | null)[];}
interface Event {type: string; targetId: string; value: number;}
interface Sound {sourcePlacementId: string; reference: string; selector: number; position: number[];
  playing: boolean; ended: boolean; loop: boolean; src: string; duration: number;}
interface Visual {id: string; fading: boolean; hidden: boolean; intactEnabled: boolean;}
interface Page {events: Event[]; draws: Draw[]; capture: {id: string; frame: number; draws: Draw[]; canvas: string; camera: {view: number[]; projection: number[]; width: number; height: number}};
  sounds: Sound[]; visuals: Visual[];}
interface World {playerId:string;players:{id:string;x:number;y:number;z:number;alive:boolean}[];mode: number; mapId: number; roomId:string; phase:string; match: {round:number;result?:{reason:string};sceneObjects: {id: string; hp: number; sourcePlacementId: string}[]};}
const input = process.argv[2];

const run = JSON.parse(readFileSync(input, 'utf8')) as {status: string;error?:string; targetId: string; initial: World[];
  routeInputs:{page:number;tick:number;player:{x:number;y:number;z:number};target:{hp:number};keys:string[]}[];clearedMovement:{before:World;after:World;normalKeys:string[];duration:number};observed: Page[]; cleanup: Record<string, number>[]; finished:World[];rematch: {world:World;objects:{id:string;fading:boolean;hidden:boolean;alpha:number;intactEnabled:boolean;soundPlayed:boolean}[]}[];};
assert.equal(run.status,'PASS');
const lifecycle=run as typeof run & {acceptanceTimeLimitSeconds:number;auxiliaryAtFinish:{isConnected:boolean}[];destroyed:World[]};
assert.equal(lifecycle.acceptanceTimeLimitSeconds,120);
assert(lifecycle.auxiliaryAtFinish.length===2&&lifecycle.auxiliaryAtFinish.every(member=>member.isConnected));
assert(run.initial.every(world => world.mode === 4 && world.mapId === 18 && world.match.sceneObjects.length === 34));
const proof = JSON.parse(readFileSync('recovery/output/scene-breach18-05442-source.json', 'utf8')) as {
  status: string; sound:{duration:number}; placements: {id: string; model: string; position: number[]; matrix: number[]}[];};
assert.equal(proof.status, 'PASS');
const id = run.targetId.replace(/^ENV:/, '');
const placement = proof.placements.find(row => row.id === id)!;
assert(placement && placement.model === 'obj05442');
const matrix = [...placement.matrix]; matrix.splice(12, 3, ...placement.position);
const resource = JSON.parse(readFileSync('recovery/output/web-assets/scene-breach-0018.json', 'utf8')).resources.find((r:EffectModelResource)=>r.reference==='Data/scnobj/obj05442/c9.CVD') as EffectModelResource;
const geometry = resource.nodes.map((node, index) => node.parts.length ? index : -1).filter(index => index >= 0);
assert.deepEqual(geometry, [1, 2, 3, 4, 5, 6, 7]);
const events = [];
const pages = [];
for (const [index, page] of run.observed.entries()) {
  const relevant = page.events.filter(event => event.targetId === run.targetId);
  assert.equal(relevant.filter(event => event.type === 'sceneObjectDestroyed').length, 1);
  const hits = relevant.filter(event => event.type === 'sceneObjectHit');
  assert(hits.length && hits.every(event => event.value > 0));
  assert.equal(hits.reduce((sum, event) => sum + event.value, 0), 200);
  events.push(relevant);
  assert(page.draws.some(draw => draw.id === id && !draw.broken));
  assert.equal(page.capture.id, id);
  const actualCaptureNodes=page.capture.draws.map(draw=>draw.node).sort((a,b)=>a-b);
  assert.deepEqual(actualCaptureNodes,geometry);
  const allRecordedDraws=page.draws.filter(draw=>draw.id===id&&draw.broken);
  assert.deepEqual([...new Set(allRecordedDraws.map(draw=>draw.node))].sort((a,b)=>a-b),geometry);
  const camera=page.capture.camera;
  const transform=Matrix.FromArray(camera.view).multiply(Matrix.FromArray(camera.projection));
  const viewport=new Viewport(0,0,camera.width,camera.height);
  const projectedNodes: {node:number;minX:number;maxX:number;minY:number;maxY:number}[]=[];
  let maximumPositionError = 0;
  let maximumMatrixError = 0;
  for (const draw of [...allRecordedDraws,...page.capture.draws]) {
    assert.equal(draw.sourceModel, resource.reference);
    assert.deepEqual(draw.placementMatrix, matrix);
    assert.deepEqual(draw.worldMatrix, EFFECT_IDENTITY);
    assert.deepEqual(draw.textures, ['/Data/scnobj/obj05442/obj05442.png']);
    const matrices: number[][] = [];
    for (const [nodeIndex, node] of resource.nodes.entries()) {
      if(!node.animation){assert.equal(draw.clocks[nodeIndex],null);matrices[nodeIndex]=multiplyEffectMatrices(matrix,EFFECT_IDENTITY);continue;}
      const clock = draw.clocks[nodeIndex]!;
      assert(clock && clock.rate === 1);
      const sample = new EffectModelAnimation(node.animation!, node.duration!);
      sample.setTime(clock.time); sample.update(0);
      const error = Math.max(...sample.matrix.map((value, axis) => Math.abs(value - clock.matrix[axis])));
      assert(error < 1e-4); maximumMatrixError = Math.max(maximumMatrixError, error);
      matrices[nodeIndex] = multiplyEffectMatrices(node.parent == null ? matrix : matrices[node.parent], sample.matrix);
    }
    const node = resource.nodes[draw.node];
    const vertices = effectModelVertices(node.frames!, node.times!, draw.clocks[draw.node]!.time);
    const expected = vertices.flatMap(vertex => {
      const position = transformEffectPosition(matrices[draw.node], vertex.slice(0, 3) as [number, number, number]);
      return [-position[0], position[1], position[2]];
    });
    assert.equal(draw.positions.length, expected.length);
    const error = Math.max(...expected.map((value, axis) => Math.abs(value - draw.positions[axis])));
    assert(error < .001); maximumPositionError = Math.max(maximumPositionError, error);
    assert.deepEqual(draw.uvs, vertices.flatMap(vertex => vertex.slice(6, 8)));
    assert.deepEqual(draw.indices, node.parts[0].indices);
    if(page.capture.draws.includes(draw)){
      const points=[];for(let axis=0;axis<expected.length;axis+=3)points.push(Vector3.Project(new Vector3(expected[axis],expected[axis+1],expected[axis+2]),Matrix.Identity(),transform,viewport));
      projectedNodes.push({node:draw.node,minX:Math.min(...points.map(p=>p.x)),maxX:Math.max(...points.map(p=>p.x)),minY:Math.min(...points.map(p=>p.y)),maxY:Math.max(...points.map(p=>p.y))});
    }
  }
  const expectedCaptureMatrices: number[][]=[];
  const captureClock=page.capture.draws[0].clocks;
  const expectedProjectedNodes=resource.nodes.map((node,nodeIndex)=>{
    if(!node.parts.length)return {node:nodeIndex,actualDraw:false,empty:true};
    const clock=captureClock[nodeIndex]!;
    const sample=new EffectModelAnimation(node.animation!,node.duration!);sample.setTime(clock.time);sample.update(0);
    expectedCaptureMatrices[nodeIndex]=multiplyEffectMatrices(node.parent==null?matrix:expectedCaptureMatrices[node.parent],sample.matrix);
    const points=effectModelVertices(node.frames!,node.times!,clock.time).map(vertex=>{
      const native=transformEffectPosition(expectedCaptureMatrices[nodeIndex],vertex.slice(0,3) as [number,number,number]);
      return Vector3.Project(new Vector3(-native[0],native[1],native[2]),Matrix.Identity(),transform,viewport);
    });
    const bounds={minX:Math.min(...points.map(p=>p.x)),maxX:Math.max(...points.map(p=>p.x)),minY:Math.min(...points.map(p=>p.y)),maxY:Math.max(...points.map(p=>p.y)),minDepth:Math.min(...points.map(p=>p.z)),maxDepth:Math.max(...points.map(p=>p.z))};
    const outside=bounds.maxX<0||bounds.minX>camera.width||bounds.maxY<0||bounds.minY>camera.height||bounds.maxDepth<0||bounds.minDepth>1;
    return {node:nodeIndex,clock:clock.time,...bounds,actualDraw:actualCaptureNodes.includes(nodeIndex),projectionScope:outside?'Outside recorded screen/depth bounds':'Intersects recorded screen/depth bounds; projection does not establish unobscured pixels'};
  });
  const poses = geometry.map(node => ({node, states: new Set(page.draws.filter(draw => draw.id === id && draw.broken && draw.node === node).map(draw => JSON.stringify(draw.positions))).size}));
  assert(poses.every(pose => pose.states === 3));
  const sounds = page.sounds.filter(sound => sound.sourcePlacementId === id);
  assert.equal(sounds.length, 1);
  const sound = sounds[0];
  assert.equal(sound.reference, 'GA41'); assert.equal(sound.selector, 1);
  assert(sound.playing && sound.ended && !sound.loop);
  assert.deepEqual(sound.position, placement.position);
  assert(sound.src.endsWith('/audio/sound/GA41.wav'));
  assert(Math.abs(sound.duration-proof.sound.duration)<1e-6);
  assert(page.visuals.some(visual => visual.id === id && visual.fading && !visual.hidden && !visual.intactEnabled));
  assert(page.visuals.some(visual => visual.id === id && visual.hidden));
  const png = `recovery/output/scene-breach18-05442-accepted-${index + 1}.png`;
  const pngBytes=Buffer.from(page.capture.canvas.split(',')[1],'base64');
  assert.equal(pngBytes.readUInt32BE(16),camera.width);assert.equal(pngBytes.readUInt32BE(20),camera.height);
  writeFileSync(png,pngBytes);
  const candidateBounds={minX:Math.min(...projectedNodes.map(n=>n.minX)),maxX:Math.max(...projectedNodes.map(n=>n.maxX)),minY:Math.min(...projectedNodes.map(n=>n.minY)),maxY:Math.max(...projectedNodes.map(n=>n.maxY))};
  pages.push({page:index+1,actualCaptureNodes,captureFrame: page.capture.frame, geometryNodes: geometry, maximumPositionError,
    maximumMatrixError, poses, sound, png, projectedNodes,expectedProjectedNodes,missingCaptureNodes:geometry.filter(node=>!actualCaptureNodes.includes(node)),candidateBounds,camera});
}
const sourceBoxForBlocking=getSceneBreakables(18).find(box=>box.id===id)!;
assert.deepEqual(events[0], events[1]);
const intactBlocking= [1,2].map(page=>{
  const rows=run.routeInputs.filter(row=>row.page===page&&row.target.hp>0&&row.keys.includes('KeyW'));
  const pair=rows.find((row,index)=>index>0&&Math.hypot(row.player.x-sourceBoxForBlocking.matrix[12],row.player.z-sourceBoxForBlocking.matrix[14])<65&&Math.hypot(row.player.x-rows[index-1].player.x,row.player.z-rows[index-1].player.z)<.05);
  assert(pair,'Ordinary forward movement must record the intact near-box plateau');
  return {page,tick:pair.tick,player:pair.player};
});
const crossedPlayer=run.clearedMovement.after.players.find(player=>player.id===run.clearedMovement.after.playerId)!;
const beforePlayer=run.clearedMovement.before.players.find(player=>player.id===run.clearedMovement.before.playerId)!;
const sourceBox=getSceneBreakables(18).find(box=>box.id===id)!;
assert(sourceBox&&crossedPlayer.alive&&beforePlayer.alive);
assert.deepEqual(run.clearedMovement.normalKeys,['KeyW']);
assert(run.clearedMovement.before.match.sceneObjects.find(object=>object.sourcePlacementId===id)!.hp===0);
const point={x:crossedPlayer.x,y:crossedPlayer.y+20,z:crossedPlayer.z};
assert(segmentBox(point,point,sourceBox,0)!==undefined,'Ordinary forward movement enters the cleared original source OBB');
assert(Math.hypot(crossedPlayer.x-beforePlayer.x,crossedPlayer.z-beforePlayer.z)>40);
assert(run.finished.length===2&&run.finished.every(world=>world.phase==='FINISHED'&&world.match.result?.reason==='TIME_LIMIT'));
assert(lifecycle.rematch.every((row,index)=>row.world.roomId===lifecycle.finished[index].roomId&&row.world.match.round===lifecycle.finished[index].match.round+1));
assert(lifecycle.finished.length===2&&lifecycle.finished.every(world=>world.phase==='FINISHED'&&world.match.result?.reason==='TIME_LIMIT'));
for(const page of lifecycle.observed){const hits=page.events.filter(event=>event.targetId==='ENV:43'&&event.type==='sceneObjectHit');assert.equal(hits.reduce((sum,event)=>sum+event.value,0),200);assert.equal(page.events.filter(event=>event.targetId==='ENV:43'&&event.type==='sceneObjectDestroyed').length,1);assert(page.visuals.some(visual=>visual.id==='43'&&visual.hidden));}
assert(lifecycle.rematch.length===2&&lifecycle.rematch.every(row=>row.world.match.sceneObjects.every(object=>object.hp===200)&&row.objects.length===16&&row.objects.every(object=>!object.fading&&!object.hidden&&object.alpha===1&&object.intactEnabled&&!object.soundPlayed)));
assert(lifecycle.cleanup.every(row => Object.values(row).every(value => value === 0)));
writeFileSync('recovery/output/scene-breach18-05442-actual.json', JSON.stringify({status: 'PASS', sourceBrowser: input,
  sourceBrowserOverallStatus:run.status,acceptanceTimeLimitSeconds:120,
  targetId: run.targetId, placement, sameEvents: events[0], pages, cleanup:lifecycle.cleanup,rematch:lifecycle.rematch,finished:run.finished,lifecycleFinished:lifecycle.finished,clearedMovement:run.clearedMovement,enteredClearedSourceOBB:true,intactBlocking,
  boundaries: 'Ordinary independent sceneObjects authority; reconstructed HP policy; original c9 and GA41 presentation. No event/position/camera/clock injection or original GPU equivalence'}, null, 2) + '\n');
console.log('PASS: ordinary05442 dual seven-geometry/empty-root source-world CVD/GA41 once-ended/fade/Leave');
