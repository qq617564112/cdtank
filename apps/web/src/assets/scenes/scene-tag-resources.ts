import {loadStaticBinary, loadStaticJson} from '../static-resources';
import {TANK_TAG_FRAME_SIZE, type TankTagRange, type TankTagTrack} from '../tanks/tank-action-format';
import type {EffectVec3} from '../../render/effects/common/types';

interface SceneTagTrack {name: string; frames: TankTagTrack;}
interface CastleAction {
  name: string; asset: string; available: boolean; durationMs: number; tracks: SceneTagTrack[];
}
export interface CastleModelResource {
  sourcePlacementId: string; model: string; position: EffectVec3; matrix: number[]; actions: CastleAction[];
}
export interface HookLibrary {
  mapId: string; sourcePlacementId: string; model: string; className: string;
  asset: string; action: string; durationMs: number; track: SceneTagTrack; effect: string;
}
interface PackedTrack {name: string; frames: TankTagRange;}
interface PackedCastle extends Omit<CastleModelResource, 'actions'> {
  actions: (Omit<CastleAction, 'tracks'> & {tracks: PackedTrack[]})[];
}
interface PackedHook extends Omit<HookLibrary, 'track'> {track: PackedTrack; binary: string;}

function unpackTrack(track: PackedTrack, binary: ArrayBuffer): SceneTagTrack {
  const range = track.frames;
  return {...track, frames: {length: range.length,
    data: new Float32Array(binary, range.offset * 4, range.length * TANK_TAG_FRAME_SIZE)}};
}

/** A scene load shares each model's action tracks across its castle placements. */
export async function loadSceneCastleResources(path: string): Promise<CastleModelResource[]> {
  const document = await loadStaticJson<{castles: PackedCastle[]; binary: string}>(
    path.replace(/\.json$/, '.tracks.json'), false);
  const binary = await loadStaticBinary(document.binary);
  return document.castles.map(castle => ({...castle, actions: castle.actions.map(action => ({...action,
    tracks: action.tracks.map(track => unpackTrack(track, binary))}))}));
}

/** Keep one packed spout track for the scene-owned Hook instance. */
export async function loadSceneHookResource(path: string): Promise<HookLibrary> {
  const document = await loadStaticJson<PackedHook>(path.replace(/\.json$/, '.tracks.json'), false);
  const binary = await loadStaticBinary(document.binary);
  return {...document, track: unpackTrack(document.track, binary)};
}
