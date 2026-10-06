import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {FreeCamera, NullEngine, RawTexture, Scene, Texture, Vector3, VertexBuffer} from '@babylonjs/core';
import {effectBoltDrawVertices} from '../apps/web/src/render/effects/bolts/effect-bolt-draw';
import {EffectStripVertex} from '../apps/web/src/render/effects/common/effect-quad';
import {EffectRuntime} from '../apps/web/src/render/effects/runtime/effect-runtime';
import {EffectRuntimeLibrary, EffectRuntimeNode, EffectRuntimeTree} from '../apps/web/src/render/effects/runtime/effect-runtime-tree';
import {EffectSpriteMesh} from '../apps/web/src/render/effects/common/effect-sprite-mesh';
import {EffectVec3} from '../apps/web/src/render/effects/common/types';
interface Row {
  root: number; node: number; parent: number[]; matrix: number[]; eye: EffectVec3;
  segments: number[][]; vertices: EffectStripVertex[]; width: number; color: number;
}
const rows = JSON.parse(readFileSync('recovery/output/effect-sol-bolt-render-parent-native.json', 'utf8')).rows as Row[];
const library = JSON.parse(readFileSync('recovery/output/web-assets/effect-library.json', 'utf8')) as EffectRuntimeLibrary;
let maxError = 0;
const compare = (actual: number, expected: number): void => {
  maxError = Math.max(maxError, Math.abs(actual - expected));
  assert.ok(Math.abs(actual - expected) <= .00001, `${actual} / ${expected}`);
};
for (const row of rows) {
  const vertices = effectBoltDrawVertices(row.segments, row.matrix, row.eye, row.width, row.color);
  assert.equal(vertices.length, row.vertices.length);
  vertices.forEach((vertex, index) => {
    assert.deepEqual(vertex.uv, row.vertices[index].uv);
    assert.equal(vertex.color, row.vertices[index].color);
    vertex.position.forEach((value, axis) => compare(value, row.vertices[index].position[axis]));
  });
}
const engine = new NullEngine();
const scene = new Scene(engine);
const camera = new FreeCamera('attached-bolt-check', Vector3.Zero(), scene);
const runtime = new EffectRuntime(scene, camera);
interface Draw {node: EffectRuntimeNode; controller: number; sprite?: EffectSpriteMesh;}
const fixture = runtime as unknown as {
  library: unknown; textures: Map<string, Texture>;
  draw(instance: {tree: EffectRuntimeTree}, draw: Draw): void;
};
fixture.library = library;
const texture = RawTexture.CreateRGBATexture(new Uint8Array([255,255,255,255]), 1, 1, scene);
for (const grid of library.boltTextures) fixture.textures.set(grid.asset, texture);
let productionDraws = 0;
let parentDifference = 0;
try {
  for (const row of rows.filter(sample => sample.matrix.every((value, axis) => value === (axis % 5 === 0 ? 1 : 0)))) {
    const tree = new EffectRuntimeTree(library, library.nodes[row.root].id, [0,0,0], row.parent, () => 8191,
      {play: () => {throw new Error('Unexpected sound');}, finished: () => true, stop: () => {}}, {});
    const node = tree.nodes.find(entry => entry.definition.index === row.node)!;
    // Geometry and active phase come from the complete original tree render fixture.
    node.lifecycle.phase = 2;
    node.bolt!.worldSegments = row.segments;
    camera.position.set(-row.eye[0], row.eye[1], row.eye[2]);
    camera.getViewMatrix(true);
    const draw: Draw = {node, controller: -1};
    fixture.draw({tree}, draw);
    const mesh = draw.sprite!.mesh;
    const positions = mesh.getVerticesData(VertexBuffer.PositionKind)!;
    const uv = mesh.getVerticesData(VertexBuffer.UVKind)!;
    assert.equal(positions.length, row.vertices.length * 3);
    row.vertices.forEach((vertex, index) => {
      vertex.position.forEach((value, axis) => compare(positions[index*3+axis], axis === 0 ? -value : value));
      vertex.uv.forEach((value, axis) => assert.equal(uv[index*2+axis], value));
    });
    const transformedAgain = effectBoltDrawVertices(row.segments, row.parent, row.eye, row.width, row.color);
    if (transformedAgain.some((vertex, index) => vertex.position.some((value, axis) =>
      Math.abs(value - row.vertices[index].position[axis]) > .001))) ++parentDifference;
    draw.sprite!.dispose();
    tree.dispose();
    ++productionDraws;
  }
  assert.ok(parentDifference > 0);
  assert.equal(scene.meshes.length, 0);
} finally {
  runtime.stop();
  texture.dispose();
  scene.dispose();
  engine.dispose();
}
console.log(`PASS: ${rows.length} complete original attached draws / ${productionDraws} production mesh submissions; max error ${maxError}; ${parentDifference} detect repeated parent transform`);
