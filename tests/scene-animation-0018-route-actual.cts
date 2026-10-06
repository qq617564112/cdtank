import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {Matrix, Vector3, Viewport} from '@babylonjs/core';
import {BATTLE_CAMERA_SOURCE, originalActorCameraHeading, originalBattleCameraPose} from '../apps/web/src/render/battle-camera';
import {EffectModelAnimation, effectModelVertices} from '../apps/web/src/render/effects/models/effect-model-animation';
import type {EffectModelResource} from '../apps/web/src/render/effects/models/effect-model-renderer';
import {EFFECT_IDENTITY, multiplyEffectMatrices} from '../apps/web/src/render/effects/common/effect-render-transform';
import {transformEffectPosition} from '../apps/web/src/render/effects/common/effect-native-space';

interface Clock {time: number; rate: number; matrix: number[];}
interface Draw {
  id: string; node: number; frame: number; source: string;
  positions: number[]; uvs: number[]; indices: number[]; texture: string[];
  placementMatrix: number[]; worldMatrix: number[]; clocks: (Clock | null)[];
}
interface Player {id: string; x: number; y: number; z: number; yaw: number; aim: number;}
interface CameraRecord {
  view: number[]; projection: number[];
  position: number[]; target: number[]; width: number; height: number;
}
interface Capture {
  id: string; frame: number; canvas: string; draws: Draw[]; camera?: CameraRecord;
  world: {phase: string; mapId: number; mode: number; tick: number; playerId: string; players: Player[]};
}
interface Run {status: string; observed: {captures: Capture[]; draws: Draw[]; counts: Record<string, number>}[];}
interface Source {status: string; geometryNodes: number[]; placements: {id: string; matrix: number[]; position: number[]}[];}

const inputs = process.argv.slice(2);
assert(inputs.length > 0, 'Provide the recorded ordinary route browser JSON paths');
const source = JSON.parse(readFileSync('recovery/output/scene-animation-0018-source.json', 'utf8')) as Source;
const resource = JSON.parse(readFileSync('recovery/output/web-assets/scene-animation-0018.json', 'utf8')).resources[0] as EffectModelResource;
assert.equal(source.status, 'PASS');
assert.deepEqual(source.geometryNodes, [0, 2, 3, 4, 5]);
assert.equal(resource.nodes.length, 6);
assert.equal(resource.nodes[1].parent, null);
assert.equal(resource.nodes[1].parts.length, 0);
const original = source.placements.find(row => row.id === '69')!;
const placement = [...original.matrix];
placement.splice(12, 3, ...original.position);

function projection(capture: Capture, player: Player): {transform: Matrix; width: number; height: number; method: string} {
  if (capture.camera) {
    assert.equal(capture.camera.view.length, 16);
    assert.equal(capture.camera.projection.length, 16);
    return {transform: Matrix.FromArray(capture.camera.view).multiply(Matrix.FromArray(capture.camera.projection)),
      width: capture.camera.width, height: capture.camera.height, method: 'Recorded actual render camera matrices'};
  }
  const pose = originalBattleCameraPose([player.x, player.y, player.z], originalActorCameraHeading(player.yaw + player.aim));
  const web = (v: readonly number[]) => new Vector3(-v[0], v[1], v[2]);
  const view = Matrix.LookAtLH(web(pose.eye), web(pose.target), web(pose.up));
  const verticalFov = 2 * Math.atan(Math.tan(BATTLE_CAMERA_SOURCE.fovDegrees * Math.PI / 360) / (1280 / 720));
  const perspective = Matrix.PerspectiveFovLH(verticalFov, 1280 / 720, BATTLE_CAMERA_SOURCE.near, BATTLE_CAMERA_SOURCE.far);
  return {transform: view.multiply(perspective), width: 1280, height: 720,
    method: 'Estimated from recorded player and source follow-camera; actor interpolation is not recorded'};
}

const pages = [];
for (let page = 0; page < 2; page++) {
  const candidates = inputs.flatMap(input => {
    const run = JSON.parse(readFileSync(input, 'utf8')) as Run;
    return (run.observed[page]?.captures ?? []).filter(capture => capture.id === '69').map(capture => ({input, runStatus: run.status, capture}));
  });
  if (!candidates.length) {
    pages.push({page: page + 1, sourceCaptureAccepted: false, dynamicPosesQualified: false, visualAccepted: false});
    continue;
  }
  const chosen = [...candidates].reverse().find(candidate => candidate.capture.camera) ?? candidates[candidates.length - 1];
  const {capture} = chosen;
  const poseRows = inputs.flatMap(input => {
    const run = JSON.parse(readFileSync(input, 'utf8')) as Run;
    return (run.observed[page]?.draws ?? []).filter(draw => draw.id === '69').map(draw => ({input, draw}));
  });
  assert.equal(capture.world.phase, 'PLAYING');
  assert.equal(capture.world.mapId, 18);
  assert.equal(capture.world.mode, 4);
  assert(capture.world.tick > 0);
  const player = capture.world.players.find(row => row.id === capture.world.playerId)!;
  assert(player);
  assert.deepEqual(capture.draws.map(draw => draw.node).sort(), source.geometryNodes);
  const camera = projection(capture, player);
  const viewport = new Viewport(0, 0, camera.width, camera.height);
  let maximumPositionError = 0;
  let maximumMatrixError = 0;
  const geometry = [];
  for (const draw of [...capture.draws, ...poseRows.map(row => row.draw)]) {
    assert.equal(draw.id, '69');
    if (capture.draws.includes(draw)) assert.equal(draw.frame, capture.frame);
    assert.equal(draw.source, resource.reference);
    assert.deepEqual(draw.placementMatrix, placement);
    assert.deepEqual(draw.worldMatrix, EFFECT_IDENTITY);
    assert.deepEqual(draw.texture, ['/Data/scnobj/obj05018/obj05018.png']);
    const matrices: number[][] = [];
    for (const [index, node] of resource.nodes.entries()) {
      let local = [...EFFECT_IDENTITY];
      if (node.animation) {
        const clock = draw.clocks[index]!;
        assert(clock && clock.rate === 1);
        const sample = new EffectModelAnimation(node.animation, node.duration!);
        sample.setTime(clock.time); sample.update(0);
        local = [...sample.matrix];
        const error = Math.max(...local.map((value, axis) => Math.abs(value - clock.matrix[axis])));
        assert(error < 1e-4); maximumMatrixError = Math.max(maximumMatrixError, error);
      } else {
        assert.equal(draw.clocks[index], null);
      }
      matrices[index] = multiplyEffectMatrices(node.parent == null ? placement : matrices[node.parent], local);
    }
    const node = resource.nodes[draw.node];
    const vertices = effectModelVertices(node.frames!, node.times!, draw.clocks[draw.node]!.time);
    const expected = vertices.map(vertex => {
      const p = transformEffectPosition(matrices[draw.node], vertex.slice(0, 3) as [number, number, number]);
      return [-p[0], p[1], p[2]];
    });
    const flattened = expected.flat();
    assert.equal(draw.positions.length, flattened.length);
    const error = Math.max(...flattened.map((value, axis) => Math.abs(value - draw.positions[axis])));
    assert(error < .001); maximumPositionError = Math.max(maximumPositionError, error);
    assert.deepEqual(draw.uvs, vertices.flatMap(vertex => vertex.slice(6, 8)));
    assert.deepEqual(draw.indices, node.parts[0].indices);
    if (!capture.draws.includes(draw)) continue;
    const projected = expected.map(p => Vector3.Project(new Vector3(p[0], p[1], p[2]), Matrix.Identity(), camera.transform, viewport));
    const bounds = {minX: Math.min(...projected.map(p => p.x)), maxX: Math.max(...projected.map(p => p.x)),
      minY: Math.min(...projected.map(p => p.y)), maxY: Math.max(...projected.map(p => p.y)),
      minDepth: Math.min(...projected.map(p => p.z)), maxDepth: Math.max(...projected.map(p => p.z))};
    geometry.push({node: draw.node, clock: draw.clocks[draw.node]!.time, vertices: expected.length,
      sourceWorldBounds: [0, 1, 2].map(axis => [Math.min(...expected.map(p => p[axis])), Math.max(...expected.map(p => p[axis]))]),
      projectedBounds: bounds});
  }
  const poseEvidence = source.geometryNodes.map(node => {
    const rows = poseRows.filter(row => row.draw.node === node);
    const states = [...new Set(rows.map(row => JSON.stringify(row.draw.positions)))];
    const matrixStates = new Set(rows.map(row => JSON.stringify(row.draw.clocks[node]!.matrix))).size;
    assert(node !== 0 || states.length === 1);
    assert(node !== 0 || rows.length >= 2);
    return {node, worldPoses: states.length, sourceMatrixStates: matrixStates,
      samples: states.map(state => {const row = rows.find(row => JSON.stringify(row.draw.positions) === state)!;
        return {sourceBrowser: row.input, frame: row.draw.frame, clock: row.draw.clocks[node]!.time};})};
  });
  const dynamicPosesQualified = poseEvidence.every(row => row.node === 0 ? row.worldPoses === 1 : row.worldPoses >= 3 && row.sourceMatrixStates >= 3);
  const candidateBounds = {minX: Math.min(...geometry.map(g => g.projectedBounds.minX)), maxX: Math.max(...geometry.map(g => g.projectedBounds.maxX)),
    minY: Math.min(...geometry.map(g => g.projectedBounds.minY)), maxY: Math.max(...geometry.map(g => g.projectedBounds.maxY))};
  const png = `recovery/output/scene-animation-0018-route-page-${page + 1}.png`;
  const pngBytes = Buffer.from(capture.canvas.split(',')[1], 'base64');
  assert.equal(pngBytes.readUInt32BE(16), camera.width);
  assert.equal(pngBytes.readUInt32BE(20), camera.height);
  writeFileSync(png, pngBytes);
  pages.push({page: page + 1, sourceBrowser: chosen.input, sourceBrowserOverallStatus: chosen.runStatus,
    sourceCaptureAccepted: true, dynamicPosesQualified, poseEvidence, visualReviewRequired: true, placement: '69', frame: capture.frame, tick: capture.world.tick,
    player, png, visualEvidence: {sourceBrowser: chosen.input, frame: capture.frame, tick: capture.world.tick, png,
      cameraQualification: camera.method}, width: camera.width, height: camera.height, maximumPositionError, maximumMatrixError,
    projectionMethod: camera.method, geometry, candidateBounds,
    visualReview: 'Projected source bounds identify an image-review candidate; depth occlusion and recognizability require reviewing the recorded PNG'});
}
const output = {status: pages.every(page => page.sourceCaptureAccepted && page.dynamicPosesQualified) ? 'PASS' : 'PARTIAL',
  scope: 'Placement69 ordinary route source-world draw verification and PNG projection candidates',
  source: 'recovery/output/scene-animation-0018-source.json', lifecycle: 'recovery/output/browser-scene-animation-0018-2026-10-04T03-10-02-088Z.json',
  pages, visualAcceptance: 'Separate recorded-PNG review; source draw and projection do not establish unobscured pixels',
  startPhase: 'Web start0/rate1/independent page phase convention'};
writeFileSync('recovery/output/scene-animation-0018-route-actual.json', JSON.stringify(output, null, 2) + '\n');
console.log(`${output.status}: placement69 source-world draw and projected PNG candidates`);
