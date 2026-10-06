import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {FreeCamera, Matrix, Mesh, NullEngine, RawTexture, Scene, Texture, Vector3, VertexBuffer} from '@babylonjs/core';
import {EffectRuntime} from '../apps/web/src/render/effects/runtime/effect-runtime';
import {EffectRuntimeLibrary, EffectRuntimeTree} from '../apps/web/src/render/effects/runtime/effect-runtime-tree';
import {EffectNativeMatrix} from '../apps/web/src/render/effects/common/effect-native-space';
import {EffectColor, EffectVec3} from '../apps/web/src/render/effects/common/types';
import {EffectQuadData, EffectSpriteMesh} from '../apps/web/src/render/effects/common/effect-sprite-mesh';
import {EffectSpriteNodeState} from '../apps/web/src/render/effects/sprites/effect-sprite-node';
import {EffectSpriteState} from '../apps/web/src/render/effects/sprites/effect-sprite-reset';
import {effectSpriteDraw} from '../apps/web/src/render/effects/sprites/sprite-draw';
import {EffectStripNodeState} from '../apps/web/src/render/effects/strips/effect-strip-node';
import {EffectStripSegment} from '../apps/web/src/render/effects/strips/effect-strip-geometry';
import {effectStripDraw} from '../apps/web/src/render/effects/strips/strip-draw';

function fixture<T>(name: string): T {
  return JSON.parse(readFileSync(`recovery/output/${name}.json`, 'utf8')) as T;
}
interface MatrixRow {
  node: number; position: EffectVec3; orbit: EffectVec3; angles: EffectVec3;
  scale: EffectVec3; parent?: number[]; matrix: number[];
}
interface BillboardRow {center: EffectVec3; scale: EffectVec3; angle: number; corners: EffectVec3[];}
interface StripRow {node: number; modifier: number; color: EffectColor; geometry: EffectStripSegment[];}
interface ColorRow {color: EffectColor; packed: number;}
interface TrailRow {packed: number; index: number; count: number; result: number;}
type Catalog = EffectRuntimeLibrary & {
  rendering: {scripts: {index: number; techniques: {passes: {states: {name: string; value: string}[]}[]}[]}[]};
};
const library = fixture<Catalog>('web-assets/effect-library');
const matrices = fixture<MatrixRow[]>('effect-render-transform-native');
const billboards = fixture<{rows: BillboardRow[]}>('effect-billboard-native').rows;
const strips = fixture<{rows: StripRow[]}>('effect-strip-geometry-native').rows;
const colors = fixture<{rows: ColorRow[]; trails: TrailRow[]}>('effect-color-native');
const originalQuad = fixture<{rows: {corners: EffectVec3[]; vertices: {position: EffectVec3}[]; screenSpace: boolean}[]}>('effect-quad-native')
  .rows.find(row => !row.screenSpace)!;
const triangleOrder = originalQuad.vertices.map(vertex => originalQuad.corners.findIndex(corner =>
  corner.every((value, axis) => value === vertex.position[axis])));
assert.deepEqual(triangleOrder, [0, 1, 3, 3, 1, 2]);
const identity = Matrix.Identity().asArray();
const parent = matrices.find(row => row.parent)!.parent!;
const engine = new NullEngine();
const scene = new Scene(engine);
const camera = new FreeCamera('family-draw', Vector3.Zero(), scene);
camera.setTarget(new Vector3(0, 0, 1));
scene.activeCamera = camera;
const white = colors.rows.find(row => row.packed === 0xffffffff)!;
const black = colors.rows.find(row => row.packed === 0)!;
const tinted = colors.rows.find(row => row.color[0] === .5)!;
const sprite = new EffectSpriteNodeState(library.spriteControls.filter(row => row.node === 53), () => 0, identity);
sprite.start([0, 0, 0]);
const base = structuredClone(sprite.history.entries[0]);
const frames: [number, number, number, number][] = [[0, 0, .25, .25], [.25, .5, .75, 1], [0, .25, 1, .5]];

function fourCorners(rows: readonly EffectVec3[]): EffectQuadData['corners'] {
  assert.equal(rows.length, 4);
  return [rows[0], rows[1], rows[2], rows[3]];
}
function close(actual: ArrayLike<number>, expected: readonly number[], label: string): void {
  assert.equal(actual.length, expected.length, label);
  expected.forEach((value, index) => {
    assert.ok(Math.abs(actual[index] - value) <= Math.max(.00003, Math.abs(value) * .000002),
      `${label}/${index}: ${actual[index]} != ${value}`);
  });
}
function transform(matrix: EffectNativeMatrix, point: EffectVec3): EffectVec3 {
  const result = Vector3.TransformCoordinates(Vector3.FromArray(point), Matrix.FromArray([...matrix]));
  return [result.x, result.y, result.z];
}
function state(row: MatrixRow, color: EffectColor = white.color): EffectSpriteState {
  return {...structuredClone(base), position: row.position, orbitOffset: row.orbit,
    angles: row.angles, scale: row.scale, color, frame: 0};
}
function oriented(row: MatrixRow): EffectQuadData {
  return {corners: fourCorners([[-1, -1, 0], [1, -1, 0], [1, 1, 0], [-1, 1, 0]]
    .map(point => transform(row.matrix, point as EffectVec3))),
  uv: frames[0], packedColor: white.packed};
}
function compareQuads(actual: readonly EffectQuadData[], expected: readonly EffectQuadData[], label: string): void {
  assert.equal(actual.length, expected.length, label);
  expected.forEach((quad, index) => {
    close(actual[index].corners.flat(), quad.corners.flat(), `${label}/corners${index}`);
    assert.deepEqual(actual[index].uv, quad.uv, `${label}/uv${index}`);
    assert.equal(actual[index].packedColor, quad.packedColor, `${label}/color${index}`);
  });
}
let spriteMatrices = 0;
for (const row of matrices) {
  if (!library.spriteControls.some(control => control.node === row.node)) continue;
  sprite.history.entries.splice(0, sprite.history.entries.length, state(row));
  compareQuads(effectSpriteDraw(sprite, false, frames, camera, row.parent ?? undefined), [oriented(row)], `native sprite matrix ${row.node}`);
  ++spriteMatrices;
}
let billboardCases = 0;
for (const row of billboards) {
  sprite.history.entries.splice(0, sprite.history.entries.length,
    {...structuredClone(base), position: row.center, orbitOffset: [0, 0, 0], scale: row.scale,
      angles: [0, 0, row.angle], color: white.color, frame: 0});
  for (const attached of [undefined, parent]) {
    const center = attached ? transform(attached, row.center) : row.center;
    const expected = row.corners.map(corner => corner.map((value, axis) => value + center[axis] - row.center[axis]) as EffectVec3);
    compareQuads(effectSpriteDraw(sprite, true, frames, camera, attached),
      [{corners: fourCorners(expected), uv: frames[0], packedColor: white.packed}], 'native billboard');
    ++billboardCases;
  }
}
// Native matrix translation includes the f32 position-plus-orbit sum.
const rounded = matrices.find(row => row.node === 966 && row.position[1] !== 0 && !row.parent)!;
sprite.history.entries.splice(0, sprite.history.entries.length, {...state(rounded), scale: [0, 0, 1]});
const roundedDraw = effectSpriteDraw(sprite, true, frames, camera);
assert.deepEqual(roundedDraw[0].corners, Array.from({length: 4}, () => rounded.matrix.slice(12, 15)));
assert.notEqual(rounded.position[1] + rounded.orbit[1], rounded.matrix[13]);
const trailRows = billboards.slice(0, 3);
sprite.history.entries.splice(0, sprite.history.entries.length, ...trailRows.map((row, index) => ({
  ...structuredClone(base), position: row.center, orbitOffset: [0, 0, 0] as EffectVec3,
  scale: row.scale, angles: [0, 0, row.angle] as EffectVec3,
  color: index === 0 ? white.color : black.color, frame: index,
})));
compareQuads(effectSpriteDraw(sprite, true, frames, camera), trailRows.map((row, index) => ({
  corners: fourCorners(row.corners), uv: frames[index], packedColor: nativeTrailColor(index),
})).reverse(), 'native reverse trail/current color/frame UV');
let stripCases = 0;
for (const row of strips) {
  const controls = library.stripControls.filter(control => control.node === row.node && (control as typeof control & {modifier: number}).modifier === row.modifier);
  const grid = library.textureGrids.find(grid => grid.node === row.node)!;
  const strip = new EffectStripNodeState(controls, grid.uvFrames, () => 0, identity);
  strip.start([0, 0, 0]);
  assert.deepEqual(strip.geometry, row.geometry, `native strip initialization ${row.node}`);
  for (const matrix of matrices.filter(matrix => matrix.node === row.node)) {
    strip.state = {...state(matrix, row.color), frameRemainder: 0};
    const expected = row.geometry.map(segment => ({corners: fourCorners(segment.corners.map(corner => transform(matrix.matrix, corner))),
      uv: segment.uv, packedColor: segment.color}));
    compareQuads(effectStripDraw(strip, matrix.parent ?? undefined), expected, `native strip ${row.node}`);
    ++stripCases;
  }
}

interface RuntimeDraw {sprite?: EffectSpriteMesh;}
interface RuntimeAccess {
  library: Catalog; textures: Map<string, Texture>; deviceStates: Map<string, string>;
  instances: {tree: EffectRuntimeTree; draws: RuntimeDraw[]}[];
  createTree(identifier: number, origin: EffectVec3, parent?: EffectNativeMatrix): EffectRuntimeTree;
  addInstance(view: undefined, tree: EffectRuntimeTree): number;
  draw(instance: RuntimeAccess['instances'][number], draw: RuntimeDraw): void;
}
function meshQuads(mesh: Mesh, expected: readonly EffectQuadData[], label: string): void {
  const positions: number[] = [], uvs: number[] = [], diffuse: number[] = [];
  // The original engine fixture records triangle corner order 0,1,3,3,1,2.
  for (const quad of expected) {
    const [u0, v0, u1, v1] = quad.uv;
    const cornersUV = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
    const channels = [(quad.packedColor >>> 16) & 255, (quad.packedColor >>> 8) & 255,
      quad.packedColor & 255, quad.packedColor >>> 24].map(channel => channel / 255);
    for (const index of triangleOrder) {
      const corner = quad.corners[index];
      positions.push(-corner[0], corner[1], corner[2]);
      uvs.push(...cornersUV[index]);
      diffuse.push(...channels);
    }
  }
  assert.equal(mesh.isEnabled(), true, label);
  close(mesh.getVerticesData(VertexBuffer.PositionKind)!, positions, `${label}/submitted positions`);
  close(mesh.getVerticesData(VertexBuffer.UVKind)!, uvs, `${label}/submitted UVs`);
  close(mesh.getVerticesData(VertexBuffer.ColorKind)!, diffuse, `${label}/submitted colors`);
  assert.deepEqual(Array.from(mesh.getIndices()!), Array.from({length: positions.length / 3}, (_, index) => index));
}
function nativeTrailColor(index: number): number {
  return colors.trails.find(row => row.packed === white.packed && row.index === index && row.count === 3)!.result;
}
let runtimeCases = 0;
for (const attached of [undefined, parent]) {
  for (const nodeIndex of [31, 58, 18]) {
    const runtime = new EffectRuntime(scene, camera);
    const access = runtime as unknown as RuntimeAccess;
    access.library = library;
    // Resolve inherited device states explicitly from the original AlphaBlend pass.
    library.rendering.scripts.find(script => script.index === 0)!.techniques[0].passes[0].states
      .forEach(entry => access.deviceStates.set(entry.name, entry.value));
    const grid = library.textureGrids.find(grid => grid.node === nodeIndex)!;
    const texture = RawTexture.CreateRGBATexture(new Uint8Array([255, 255, 255, 255]), 1, 1, scene);
    access.textures.set(grid.asset, texture);
    runtime.start();
    const definition = library.nodes.find(node => node.index === nodeIndex)!;
    const tree = access.createTree(definition.id, [0, 0, 0], attached);
    access.addInstance(undefined, tree);
    const start = nodeIndex === 18 ? library.stripControls.find(row => row.node === nodeIndex)!.baseStart :
      library.spriteControls.find(row => row.node === nodeIndex)!.baseStart;
    runtime.update(start + .001);
    const node = tree.root;
    assert.equal(node.lifecycle.phase, 2);
    assert.equal(node.lifecycle.controller, 0);
    let expected: EffectQuadData[];
    if (nodeIndex === 31) {
      const row = matrices.find(row => row.node === 31 && !!row.parent === !!attached)!;
      node.sprite!.history.entries.splice(0, node.sprite!.history.entries.length, state(row));
      expected = [{...oriented(row), uv: grid.uvFrames[0]}];
    } else if (nodeIndex === 58) {
      const rows = billboards.slice(0, 3);
      node.sprite!.history.elapsed = 0;
      node.sprite!.history.entries.splice(0, node.sprite!.history.entries.length, ...rows.map((row, index) => ({
        ...structuredClone(base), position: row.center.map((value, axis) => Math.fround(value - [2, 3, 4][axis])) as EffectVec3,
        orbitOffset: [2, 3, 4] as EffectVec3, scale: row.scale, angles: [0, 0, row.angle] as EffectVec3,
        color: index === 0 ? white.color : black.color, frame: 0,
      })));
      expected = rows.map((row, index) => {
        const current = node.sprite!.history.entries[index];
        const center = current.position.map((value, axis) => Math.fround(value + current.orbitOffset[axis])) as EffectVec3;
        const transformed = attached ? transform(attached, center) : center;
        return {corners: fourCorners(row.corners.map(corner => corner.map((value, axis) => value + transformed[axis] - row.center[axis]) as EffectVec3)),
          uv: grid.uvFrames[0], packedColor: nativeTrailColor(index)};
      }).reverse();
    } else {
      const row = matrices.find(row => row.node === 18 && !!row.parent === !!attached)!;
      const geometry = strips.find(row => row.node === 18)!.geometry;
      node.strip!.state = {...state(row, tinted.color), frameRemainder: 0};
      expected = geometry.map(segment => ({corners: fourCorners(segment.corners.map(corner => transform(row.matrix, corner))),
        uv: segment.uv, packedColor: tinted.packed}));
    }
    runtime.update(0);
    const renderer = access.instances[0].draws[0].sprite!;
    const mesh = renderer.mesh;
    const material = renderer.material;
    meshQuads(mesh, expected, `runtime type${definition.type}/parent${!!attached}`);
    assert.equal(mesh.metadata.sourceNode, nodeIndex);
    assert.equal(mesh.alphaIndex, 0);
    // Phase 1 clears an existing draw while the real tree remains registered.
    node.lifecycle.phase = 1;
    access.draw(access.instances[0], access.instances[0].draws[0]);
    assert.equal(mesh.isEnabled(), false);
    runtime.clear();
    assert.equal(access.instances.length, 0);
    assert.equal(mesh.isDisposed(), true);
    assert.equal(scene.materials.includes(material), false);
    assert.equal(scene.textures.includes(texture), true);
    texture.dispose();
    ++runtimeCases;
  }
}
scene.dispose();
engine.dispose();
console.log(`PASS: ${spriteMatrices} native sprite matrices, ${billboardCases} native billboard/parent cases, ${stripCases} native strip transforms; ${runtimeCases} real Type1/Type7 runtime mesh submissions and cleanup (NullEngine)`);
