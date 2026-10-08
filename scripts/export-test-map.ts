import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {TEST_MAP} from '../apps/shared/maps/test-map';
import {webAssetPath} from '../apps/server/src/runtime/content-paths';
import {loadGlbTriangles, placedCollisionMesh} from '../apps/server/src/render-collision-assets';
import {CollisionMesh} from '../apps/shared/movement/collision-mesh';
import {NavigationGrid} from '../apps/shared/movement/navigation';
import {navigationOccupancy} from '../apps/shared/movement/navigation-collision';

interface GltfAccessor {
  bufferView: number; byteOffset?: number; count: number; min?: number[]; max?: number[];
}
interface GltfModel {
  asset: {version: string};
  buffers: {byteLength: number}[];
  bufferViews: {buffer: number; byteOffset?: number; byteLength: number}[];
  accessors: GltfAccessor[];
  meshes: {name: string; primitives: {attributes: {POSITION: number; NORMAL: number; TEXCOORD_0: number}; material: number}[]}[];
  nodes: {name: string; mesh: number}[];
  materials: {name: string; pbrMetallicRoughness: {baseColorTexture: {index: number}; metallicFactor: number; roughnessFactor: number}; doubleSided?: boolean}[];
  images: {bufferView: number; mimeType: string}[];
  textures: {source: number}[];
}
interface Placement {
  id: string; model: string; className: string; asset: string;
  position: number[]; matrix: number[]; bounds: number[]; rotation: number[]; enabled: number;
}
interface MapEntry {id: string; [key: string]: unknown;}

const id = String(TEST_MAP.id).padStart(4, '0');
const directory = `custom-maps/${id}`;
mkdirSync(webAssetPath(directory), {recursive: true});
const width = TEST_MAP.rows[0].length * TEST_MAP.tileSize;
const depth = TEST_MAP.rows.length * TEST_MAP.tileSize;

function json<T>(name: string): T {
  return JSON.parse(readFileSync(webAssetPath(name), 'utf8')) as T;
}

function publish(name: string, data: unknown): void {
  mkdirSync(webAssetPath(name.substring(0, name.lastIndexOf('/'))), {recursive: true});
  writeFileSync(webAssetPath(name), JSON.stringify(data));
}

/** Keep original catalogue entries in their source order. */
function upsert<T>(entries: T[], value: T, matches: (entry: T) => boolean): T[] {
  return [...entries.filter(entry => !matches(entry)), value];
}

function writeGlb(name: string, gltf: unknown, binary: Buffer): void {
  const raw = Buffer.from(JSON.stringify(gltf));
  const metadata = Buffer.alloc(Math.ceil(raw.length / 4) * 4, 32);
  raw.copy(metadata);
  const geometry = Buffer.alloc(Math.ceil(binary.length / 4) * 4);
  binary.copy(geometry);
  const header = Buffer.alloc(20);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(28 + metadata.length + geometry.length, 8);
  header.writeUInt32LE(metadata.length, 12);
  header.writeUInt32LE(0x4e4f534a, 16);
  const chunk = Buffer.alloc(8);
  chunk.writeUInt32LE(geometry.length, 0);
  chunk.writeUInt32LE(0x004e4942, 4);
  writeFileSync(webAssetPath(name), Buffer.concat([header, metadata, chunk, geometry]));
}

/** Reuse the original box faces, with the existing metal and red tile textures. */
function wallAsset(kind: 'steel' | 'brick'): string {
  const source = readFileSync(webAssetPath(TEST_MAP.assets.box));
  const length = source.readUInt32LE(12);
  const gltf = JSON.parse(source.subarray(20, 20 + length).toString()) as GltfModel;
  const binary = Buffer.from(source.subarray(28 + length));
  const primitive = gltf.meshes[0].primitives[0];
  const positions = gltf.accessors[primitive.attributes.POSITION];
  const normals = gltf.accessors[primitive.attributes.NORMAL];
  const uvs = gltf.accessors[primitive.attributes.TEXCOORD_0];
  const offset = (accessor: GltfAccessor): number =>
    (gltf.bufferViews[accessor.bufferView].byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const minimum = positions.min!, maximum = positions.max!;
  // Brick bounds retain the original wall's extent, also used by its c9 animation.
  const target = kind === 'brick' ? [121.49467468261719, 88.4164029083252, 19.515380859375]
    : [32, 32, 32];
  for (let vertex = 0; vertex < positions.count; vertex++) {
    const normalized = minimum.map((value, axis) =>
      (binary.readFloatLE(offset(positions) + vertex * 12 + axis * 4) - value) / (maximum[axis] - value));
    const normal = [0, 1, 2].map(axis => binary.readFloatLE(offset(normals) + vertex * 12 + axis * 4));
    const axis = normal.map(Math.abs).indexOf(Math.max(...normal.map(Math.abs)));
    const u = axis === 0 ? normalized[2] : normalized[0];
    const v = axis === 1 ? normalized[2] : 1 - normalized[1];
    binary.writeFloatLE(.04 + u * .92, offset(uvs) + vertex * 8);
    binary.writeFloatLE(kind === 'brick' ? .56 + v * .40 : .04 + v * .92, offset(uvs) + vertex * 8 + 4);
    normalized.forEach((value, coordinate) => binary.writeFloatLE(
      (coordinate === 1 ? value : value - .5) * target[coordinate], offset(positions) + vertex * 12 + coordinate * 4));
  }
  positions.min = [-target[0] / 2, 0, -target[2] / 2];
  positions.max = [target[0] / 2, target[1], target[2] / 2];
  const texture = readFileSync(webAssetPath(TEST_MAP.assets[kind === 'brick' ? 'brick' : 'metal']));
  const start = Math.ceil(binary.length / 4) * 4;
  gltf.bufferViews.push({buffer: 0, byteOffset: start, byteLength: texture.length});
  gltf.images = [{bufferView: gltf.bufferViews.length - 1, mimeType: 'image/png'}];
  gltf.textures = [{source: 0}];
  gltf.materials = [{name: kind, pbrMetallicRoughness: {
    baseColorTexture: {index: 0}, metallicFactor: 0, roughnessFactor: 1}, doubleSided: true}];
  const name = kind === 'brick' ? 'object568041500/0' : 'test-map-steel';
  gltf.meshes[0].name = gltf.nodes[0].name = name;
  primitive.material = 0;
  const buffer = Buffer.concat([binary, Buffer.alloc(start - binary.length), texture]);
  gltf.buffers[0].byteLength = buffer.length;
  const asset = `${directory}/${kind}.glb`;
  writeGlb(asset, gltf, buffer);
  return asset;
}

/** Flat ground shares its textured faces with server projectile collision. */
function groundAsset(): string {
  const positions = [-width / 2, 0, -depth / 2, -width / 2, 0, depth / 2,
    width / 2, 0, depth / 2, -width / 2, 0, -depth / 2,
    width / 2, 0, depth / 2, width / 2, 0, -depth / 2];
  const normals = Array.from({length: 6}, () => [0, 1, 0]).flat();
  const uvs = [0, 0, 0, 10, 13, 10, 0, 0, 13, 10, 13, 0];
  const geometry = Buffer.alloc((positions.length + normals.length + uvs.length) * 4);
  [...positions, ...normals, ...uvs].forEach((value, index) => geometry.writeFloatLE(value, index * 4));
  const texture = readFileSync(webAssetPath(TEST_MAP.assets.ground));
  const gltf = {
    asset: {version: '2.0'}, buffers: [{byteLength: geometry.length + texture.length}],
    bufferViews: [{buffer: 0, byteOffset: 0, byteLength: 72},
      {buffer: 0, byteOffset: 72, byteLength: 72}, {buffer: 0, byteOffset: 144, byteLength: 48},
      {buffer: 0, byteOffset: geometry.length, byteLength: texture.length}],
    accessors: [{bufferView: 0, componentType: 5126, count: 6, type: 'VEC3',
      min: [-width / 2, 0, -depth / 2], max: [width / 2, 0, depth / 2]},
    {bufferView: 1, componentType: 5126, count: 6, type: 'VEC3'},
    {bufferView: 2, componentType: 5126, count: 6, type: 'VEC2'}],
    meshes: [{name: 'test-map-ground', primitives: [{attributes: {POSITION: 0, NORMAL: 1, TEXCOORD_0: 2}, material: 0}]}],
    nodes: [{name: 'test-map-ground', mesh: 0}], scenes: [{nodes: [0]}], scene: 0,
    materials: [{name: 'tiandi.TGA', pbrMetallicRoughness: {
      baseColorTexture: {index: 0}, metallicFactor: 0, roughnessFactor: 1}, doubleSided: true}],
    images: [{bufferView: 3, mimeType: 'image/png'}], textures: [{source: 0, sampler: 0}],
    samplers: [{wrapS: 10497, wrapT: 10497}],
  };
  const asset = `${directory}/ground.glb`;
  writeGlb(asset, gltf, Buffer.concat([geometry, texture]));
  return asset;
}

const steel = wallAsset('steel'), brick = wallAsset('brick'), terrain = groundAsset();
const records: Placement[] = [];
function place(column: number, row: number, model: string, asset: string,
  size: number[], className: string, yaw = 0): void {
  const mesh = new CollisionMesh(loadGlbTriangles(asset));
  const scale = size.map((value, axis) => mesh.maximum[axis] === mesh.minimum[axis]
    ? 1 : value / (mesh.maximum[axis] - mesh.minimum[axis]));
  const angle = yaw * Math.PI / 180, cosine = Math.cos(angle), sine = Math.sin(angle);
  const position = [width / 2 - (column + .5) * TEST_MAP.tileSize,
    -mesh.minimum[1] * scale[1], (row + .5) * TEST_MAP.tileSize - depth / 2];
  const matrix = [cosine * scale[0], 0, -sine * scale[0], 0,
    0, scale[1], 0, 0, sine * scale[2], 0, cosine * scale[2], 0, ...position, 1];
  const center = mesh.minimum.map((value, axis) => (value + mesh.maximum[axis]) / 2);
  for (let axis = 0; axis < 3; axis++) matrix[12 + axis] +=
    matrix[axis] * center[0] + matrix[4 + axis] * center[1] + matrix[8 + axis] * center[2];
  records.push({id: String(records.length + 1), model, asset, className, position,
    matrix, bounds: size, rotation: [0, yaw, 0], enabled: 1});
}

TEST_MAP.rows.forEach((line, row) => [...line].forEach((tile, column) => {
  if (tile === 'S' || tile === 'C') place(column, row, 'test-map-steel', steel,
    [96, tile === 'C' ? 40 : 48, 96], 'SYcScnObjGeneral');
  if (tile === 'B') place(column, row, 'obj05443', brick, [96, 48, 96], 'SYcScnObjBreach');
  if (tile === 'W') place(column, row, 'obj05424', TEST_MAP.assets.box, [84, 50, 84], 'SYcScnObjBreach');
  if (tile === 'G') {
    for (const offsetX of [-.28, 0, .28]) for (const offsetZ of [-.28, 0, .28]) {
      place(column + offsetX, row + offsetZ, 'obj05413', TEST_MAP.assets.plant,
        [34, 28, 0], 'SYcScnObjPlant');
      place(column + offsetX, row + offsetZ, 'obj05413', TEST_MAP.assets.plant,
        [34, 28, 0], 'SYcScnObjPlant', 90);
    }
  }
}));

publish('scene-placements.json', upsert(json<MapEntry[]>('scene-placements.json'),
  {id, terrain, records, castles: [], resolved: records.length}, entry => entry.id === id));
const columns = width / 12, rows = depth / 12;
const cells = Buffer.alloc(columns * rows * 8);
for (let z = 0; z < rows; z++) for (let x = 0; x < columns; x++) {
  cells.writeUInt32LE(x > 0 && z > 0 && x < columns - 1 && z < rows - 1 ? 2 : 0,
    (z * columns + x) * 8 + 4);
}
const navigation = {minimum: [-width / 2, 0, -depth / 2], maximum: [width / 2, 0, depth / 2],
  width: columns, height: rows, cells: cells.toString('base64')};
const respawns = TEST_MAP.spawns.map((spawn, slot) => ({slot, heading: spawn.heading, team: spawn.team,
  position: [width / 2 - (spawn.column + .5) * 96, 0, (spawn.row + .5) * 96 - depth / 2]}));
publish('battlefields.json', upsert(json<MapEntry[]>('battlefields.json'),
  {id, terrainTriangles: loadGlbTriangles(terrain), collisionBoxes: [],
    respawnGroups: [respawns, respawns], navigationLayers: [navigation]}, entry => entry.id === id));
const grid = new NavigationGrid(navigation);
const surfaces = records.filter(placement => placement.className !== 'SYcScnObjPlant').map(placement => ({
  id: placement.id, enabled: true, cells: [...navigationOccupancy(
    placedCollisionMesh(loadGlbTriangles(placement.asset), placement.matrix, placement.position), grid)].sort((a, b) => a - b),
}));
publish(`movement/${id}.json`, {id, navigation, surfaces: [{id: 'terrain', enabled: true, cells: []}, ...surfaces]});

const audio = json<{maps: {mode: number; mapId: number; musicId: number; asset: string}[]}>('audio.json');
const music = audio.maps.find(entry => entry.mode === 1 && entry.mapId === 2)!;
audio.maps = upsert(audio.maps, {mode: TEST_MAP.mode, mapId: TEST_MAP.id,
  musicId: music.musicId, asset: music.asset}, entry => entry.mapId === TEST_MAP.id);
publish('audio.json', audio);

/** The selector thumbnail uses the same grid and installed texture bytes. */
const image = (path: string): string => `data:image/png;base64,${readFileSync(webAssetPath(path)).toString('base64')}`;
const pictures: string[] = [];
TEST_MAP.rows.forEach((line, row) => [...line].forEach((tile, column) => {
  const x = column * 96, y = row * 96;
  if ('SCBW'.includes(tile)) pictures.push(`<rect x="${x + 2}" y="${y + 2}" width="92" height="92" rx="3" fill="url(#${tile === 'B' ? 'brick' : tile === 'W' ? 'wood' : 'steel'})" stroke="#28333b" stroke-width="3"/>`);
  if (tile === 'G') pictures.push(`<rect x="${x}" y="${y}" width="96" height="96" fill="#3c792b"/>`,
    `<image x="${x}" y="${y}" width="96" height="96" href="${image(TEST_MAP.assets.plantTexture)}"/>`);
}));
writeFileSync(webAssetPath(`${directory}/preview.svg`), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${depth}"><defs>
<pattern id="ground" width="192" height="192" patternUnits="userSpaceOnUse"><image width="192" height="192" href="${image(TEST_MAP.assets.ground)}"/></pattern>
<pattern id="steel" width="96" height="96" patternUnits="userSpaceOnUse"><image width="96" height="96" href="${image(TEST_MAP.assets.metal)}"/></pattern>
<pattern id="wood" width="96" height="96" patternUnits="userSpaceOnUse"><image width="96" height="96" href="${image('Data/scnobj/obj05424/obj05424.png')}"/></pattern>
<pattern id="brick" width="96" height="96" patternUnits="userSpaceOnUse"><svg width="96" height="96" viewBox="0 143 256 113" preserveAspectRatio="none"><image width="256" height="256" href="${image(TEST_MAP.assets.brick)}"/></svg></pattern>
</defs><rect width="${width}" height="${depth}" fill="url(#ground)"/>${pictures.join('')}</svg>`);
const ui = json<{imagesets: {attributes: {Name: string}; images: {Name: string; Width: string; Height: string; asset: string}[]}[]}>('ui.json');
for (const set of ui.imagesets.filter(set => set.attributes.Name === 'xiaoditu0')) {
  const name = ['data', 'ui', 'xiaoditu', `${id}.tga`].join('\\');
  set.images = upsert(set.images, {Name: name, Width: '106', Height: '86',
    asset: `${directory}/preview.svg`}, entry => entry.Name === name);
}
publish('ui.json', ui);
console.log(`${TEST_MAP.name} (${id}): ${records.length} placements, ${respawns.length} team spawns`);
