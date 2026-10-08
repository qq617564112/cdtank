import {FIELD_ROAD_HD} from './field-road-hd';

/** Castle actions belong to the model; each scene supplies its own placement. */
export function castleResourceFile(mapId: number): string {
  if (mapId === FIELD_ROAD_HD.id) return `scene-castle-${FIELD_ROAD_HD.sceneId}.json`;
  const libraryMapId = [2, 5, 6, 10, 11].includes(mapId) ? mapId
    : [1, 3, 8, 12, 13].includes(mapId) ? 6
    : mapId === 23 ? 23 : 2;
  return `scene-castle-${String(libraryMapId).padStart(4, '0')}.json`;
}
