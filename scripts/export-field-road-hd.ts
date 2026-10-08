import {copyFileSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {FIELD_ROAD_HD} from '../apps/shared/maps/field-road-hd';
import {webAssetPath} from '../apps/server/src/runtime/content-paths';

interface TextureEntry {source: string; png: string; outputSize: number[];}
interface Inventory {models: string[]; textures: TextureEntry[];}
interface MapEntry {id: string; [key: string]: unknown;}
interface Gltf {
  buffers: {byteLength: number}[];
  bufferViews: {buffer: number; byteOffset?: number; byteLength: number}[];
  materials: {name: string; pbrMetallicRoughness: {baseColorTexture?: {index: number}}}[];
  textures: {source: number; sampler?: number}[];
  images: {bufferView: number; mimeType: string}[];
}
interface BreachLibrary {resources: {reference: string}[];}
interface UiImage {Name: string; Width: string; Height: string; asset: string;}
interface Ui {imagesets: {attributes: {Name: string}; images: UiImage[]}[];}

const workspace = fileURLToPath(new URL('../', import.meta.url));
const inventory = JSON.parse(readFileSync(resolve(workspace, 'art/field-road-hd/inventory.json'), 'utf8')) as Inventory;
const texturePaths = new Map(inventory.textures.map(entry => [entry.source.toLowerCase(), entry]));
const modelPaths = new Set(inventory.models);
const runtimePath = (source: string): string => `${FIELD_ROAD_HD.assetRoot}/${source}`;

function json<T>(name: string): T {
  return JSON.parse(readFileSync(webAssetPath(name), 'utf8')) as T;
}

function write(name: string, data: Buffer | string): void {
  const path = webAssetPath(name);
  mkdirSync(dirname(path), {recursive: true});
  writeFileSync(path, data);
}

function publish(name: string, value: unknown): void {
  write(name, JSON.stringify(value));
}

/** Only installed artwork paths change; source references and coordinates stay native. */
function replaceAssets(value: unknown): unknown {
  if (typeof value === 'string') {
    const texture = texturePaths.get(value.toLowerCase());
    return texture ? runtimePath(texture.source) : modelPaths.has(value) ? runtimePath(value) : value;
  }
  if (Array.isArray(value)) return value.map(replaceAssets);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, replaceAssets(child)]));
  }
  return value;
}

/** Repack PNG views while copying geometry, UV, animation and vertex data verbatim. */
function publishModel(source: string): void {
  const original = readFileSync(webAssetPath(source));
  const jsonLength = original.readUInt32LE(12);
  const model = JSON.parse(original.subarray(20, 20 + jsonLength).toString()) as Gltf;
  const binary = original.subarray(28 + jsonLength);
  const replacements = new Map<number, TextureEntry>();
  const sharedSamplers = new Map<string, number>();
  for (const material of model.materials) {
    const index = material.pbrMetallicRoughness.baseColorTexture?.index;
    if (index === undefined) continue;
    const image = model.images[model.textures[index].source];
    const path = `${dirname(source)}/${material.name.replace(/\.[^.]+$/, '.png')}`;
    const texture = texturePaths.get(path.toLowerCase());
    if (!texture) throw new Error(`缺少高清贴图：${path}`);
    replacements.set(image.bufferView, texture);
    image.mimeType = 'image/png';
    // Terrain repeats the same artwork in several primitives. Reuse its GPU
    // texture when the original sampler is also identical.
    const samplerKey = `${texture.source}:${model.textures[index].sampler ?? -1}`;
    const shared = sharedSamplers.get(samplerKey);
    if (shared === undefined) sharedSamplers.set(samplerKey, index);
    else material.pbrMetallicRoughness.baseColorTexture!.index = shared;
  }
  const pieces: Buffer[] = [];
  const sharedTextures = new Map<string, {offset: number; length: number}>();
  let length = 0;
  model.bufferViews.forEach((view, index) => {
    const texture = replacements.get(index);
    const shared = texture && sharedTextures.get(texture.source);
    if (shared) {
      view.byteOffset = shared.offset;
      view.byteLength = shared.length;
      return;
    }
    const bytes = texture ? readFileSync(resolve(workspace, texture.png))
      : binary.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
    const padding = (4 - length % 4) % 4;
    if (padding) pieces.push(Buffer.alloc(padding));
    length += padding;
    view.byteOffset = length;
    view.byteLength = bytes.length;
    pieces.push(bytes);
    if (texture) sharedTextures.set(texture.source, {offset: length, length: bytes.length});
    length += bytes.length;
  });
  model.buffers[0].byteLength = length;
  const encoded = Buffer.from(JSON.stringify(model));
  const metadata = Buffer.alloc(Math.ceil(encoded.length / 4) * 4, 32);
  encoded.copy(metadata);
  const payload = Buffer.concat([...pieces, Buffer.alloc((4 - length % 4) % 4)]);
  const header = Buffer.alloc(20);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(28 + metadata.length + payload.length, 8);
  header.writeUInt32LE(metadata.length, 12);
  header.writeUInt32LE(0x4e4f534a, 16);
  const chunk = Buffer.alloc(8);
  chunk.writeUInt32LE(payload.length, 0);
  chunk.writeUInt32LE(0x004e4942, 4);
  write(runtimePath(source), Buffer.concat([header, metadata, chunk, payload]));
}

for (const texture of inventory.textures) {
  const target = webAssetPath(runtimePath(texture.source));
  mkdirSync(dirname(target), {recursive: true});
  copyFileSync(resolve(workspace, texture.png), target);
}
for (const model of inventory.models) publishModel(model);

for (const name of ['scene-placements.json', 'battlefields.json']) {
  const entries = json<MapEntry[]>(name);
  const source = entries.find(entry => entry.id === FIELD_ROAD_HD.sourceSceneId);
  if (!source) throw new Error(`缺少田野路数据：${name}`);
  const variant = {...replaceAssets(source) as MapEntry, id: FIELD_ROAD_HD.sceneId};
  publish(name, [...entries.filter(entry => entry.id !== FIELD_ROAD_HD.sceneId), variant]);
}
const movement = json<MapEntry>(`movement/${FIELD_ROAD_HD.sourceSceneId}.json`);
publish(`movement/${FIELD_ROAD_HD.sceneId}.json`, {...movement, id: FIELD_ROAD_HD.sceneId});

for (const prefix of ['scene-terrain-material', 'scene-plant', 'scene-water', 'scene-castle',
  'scene-effects', 'scene-environment-sound']) {
  const source = json<Record<string, unknown>>(`${prefix}-${FIELD_ROAD_HD.sourceSceneId}.json`);
  publish(`${prefix}-${FIELD_ROAD_HD.sceneId}.json`, {
    ...replaceAssets(source) as Record<string, unknown>, mapId: FIELD_ROAD_HD.id,
  });
}

for (const [source, target, models] of [
  ['scene-breach-0002-05427.json', 'scene-breach-1002-05427.json', ['obj05427']],
  ['scene-breach-0021.json', 'scene-breach-1002-05422.json', ['obj05422']],
  ['scene-breach-0014.json', 'scene-breach-1002-05425-05428.json', ['obj05425', 'obj05426', 'obj05428']],
] as const) {
  const library = json<BreachLibrary>(source);
  library.resources = library.resources.filter(resource =>
    models.some(model => resource.reference.toLowerCase().includes(`/${model}/`)));
  publish(target, replaceAssets(library));
}

const audio = json<{maps: {mode: number; mapId: number}[]}>('audio.json');
const tracks = audio.maps.filter(entry => entry.mapId === FIELD_ROAD_HD.sourceId);
const music = [1, 2, 3, 4, 5].map(mode => ({
  ...(tracks.find(entry => entry.mode === mode) ?? tracks[0]), mode, mapId: FIELD_ROAD_HD.id,
}));
audio.maps = [...audio.maps.filter(entry => entry.mapId !== FIELD_ROAD_HD.id), ...music];
publish('audio.json', audio);

const preview = `${FIELD_ROAD_HD.assetRoot}/preview.png`;
write(preview, readFileSync(resolve(workspace, 'art/field-road-hd/map-preview.png')));
const ui = json<Ui>('ui.json');
for (const set of ui.imagesets.filter(set => set.attributes.Name === 'xiaoditu0')) {
  const name = ['data', 'ui', 'xiaoditu', `${FIELD_ROAD_HD.sceneId}.tga`].join('\\');
  set.images = [...set.images.filter(entry => entry.Name !== name), {
    Name: name, Width: '106', Height: '86', asset: preview,
  }];
}
publish('ui.json', ui);
console.log(`${FIELD_ROAD_HD.name} (${FIELD_ROAD_HD.id}): ${inventory.textures.length} textures, ${inventory.models.length} models`);
