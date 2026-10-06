import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {webAssetPath} from './runtime/content-paths';

export interface SceneBreakable {
  id: string;
  model: string;
  matrix: number[];
  dimensions: number[];
}

interface SourcePlacement {
  id: string;
  model: string;
  className: string;
  matrix: number[];
  bounds: number[];
  asset?: string;
  tail?: string;
  enabled?: number;
}

const scenes = JSON.parse(readFileSync(resolve(
  process.env.SCENE_PLACEMENTS ?? webAssetPath('scene-placements.json')), 'utf8')) as
  Array<{id: string; records: SourcePlacement[]; castles: SourcePlacement[]}>;
const breakables = new Map(scenes.map(scene => [Number(scene.id), scene.records
  .filter(record => record.className === 'SYcScnObjBreach').map(record => {
    if (!record.asset || record.matrix.length !== 16 || record.bounds.length !== 3
        || ![...record.matrix, ...record.bounds].every(Number.isFinite)
        || record.bounds.some(value => value < 0) || !record.bounds.some(value => value > 0)) {
      throw new Error(`场景物件${scene.id}/${record.id}资源或包围尺寸无效`);
    }
    return {id: record.id, model: record.model, matrix: record.matrix, dimensions: record.bounds};
  })]));

/** Source instance identity/transform; OBB collision use remains a rebuilt policy. */
export function getSceneBreakables(mapId: number): readonly SceneBreakable[] {
  const entries = breakables.get(mapId);
  if (!entries) throw new Error(`缺少地图${mapId}的原场景记录`);
  return entries;
}

/** Original CAS placement and initial HP; attack permission is battle policy. */
export function getSceneCastles(mapId: number): readonly (SceneBreakable & {hp: number})[] {
  const scene = scenes.find(scene => Number(scene.id) === mapId);
  if (!scene) throw new Error(`缺少地图${mapId}的原场景记录`);
  return scene.castles.map(source => ({id: source.id, model: source.model,
    matrix: source.matrix, dimensions: source.bounds,
    hp: Buffer.from(source.tail!, 'hex').readUInt32LE(4)}));
}

/** Original Crush identity, enabled bit and OBB, separate from its effect parent. */
export function getSceneCrushes(mapId: number): readonly (SceneBreakable & {enabled: boolean})[] {
  const scene = scenes.find(scene => Number(scene.id) === mapId);
  if (!scene) throw new Error(`缺少地图${mapId}的原场景记录`);
  return scene.records.filter(source => source.className === 'SYcScnObjCrush').map(source => ({
    id: source.id, model: source.model, matrix: source.matrix, dimensions: source.bounds,
    enabled: source.enabled === 1,
  }));
}

/** Original Plant order and OBB; enabled participation is a rebuilt room policy. */
export function getScenePlants(mapId: number): readonly (SceneBreakable & {enabled: boolean})[] {
  const scene = scenes.find(scene => Number(scene.id) === mapId);
  if (!scene) throw new Error(`缺少地图${mapId}的原场景记录`);
  return scene.records.filter(source => source.className === 'SYcScnObjPlant').map(source => ({
    id: source.id, model: source.model, matrix: source.matrix, dimensions: source.bounds,
    enabled: source.enabled === 1,
  }));
}
