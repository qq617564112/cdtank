import {getScenePlantContactObb} from '../scene-objects';
import type {RoleObb} from '../../../shared/movement/obb-intersection';

const frames = new Map<number, {time: number; bounds: Map<string, RoleObb>}>();

/** A plant is sampled once per authority frame, shared by all participant contacts. */
export function animatedPlantContact(mapId: number, placementId: string, seconds: number): RoleObb {
  let frame = frames.get(mapId);
  if (!frame || frame.time !== seconds) {
    frame = {time: seconds, bounds: new Map()};
    frames.set(mapId, frame);
  }
  let obb = frame.bounds.get(placementId);
  if (!obb) {
    obb = getScenePlantContactObb(mapId, placementId, seconds);
    frame.bounds.set(placementId, obb);
  }
  return obb;
}
