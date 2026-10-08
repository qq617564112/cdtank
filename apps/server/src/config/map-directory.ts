import type {ModeMapConfig} from '../config';

interface SceneMap {
  id: string;
  records: {className: string}[];
  castles: {className: string}[];
}

/** Published scenes extend the original rows with the same mode rules. */
export function playableMapDirectory(sourceMaps: ModeMapConfig[], scenes: SceneMap[],
  strings: Record<string, string>[]): ModeMapConfig[] {
  const maps = [...sourceMaps];
  for (const scene of scenes) {
    const mapId = Number(scene.id);
    if (!Number.isInteger(mapId) || mapId < 1 || mapId > 25) continue;
    const name = strings.find(row => Number(row.ID) === 629 + mapId)!.String
      .replace(/^使用地图：/, '');
    for (const mode of [1, 2, 3, 4, 5]) {
      if (maps.some(map => map.mode === mode && map.mapId === mapId)) continue;
      if (mode === 2 && scene.castles.length === 0) continue;
      if (mode === 5 && !scene.records.some(record => record.className === 'SYcScnObjBreach')) continue;
      const template = sourceMaps.find(map => map.mode === mode)!;
      maps.push({...template, mapId, name, description: name,
        sourceMinPlayers: mode <= 3 ? 2 : 1, maxPlayers: 12});
    }
  }
  return maps;
}
