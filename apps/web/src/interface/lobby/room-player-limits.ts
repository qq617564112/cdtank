import type {MapOption} from '../../../../shared/protocols';

/** Web validation follows the reconstructed server room policy. */
export class RoomPlayerLimits {
  constructor(private readonly minimum: HTMLInputElement,
              private readonly maximum: HTMLInputElement) {}

  reset(map: MapOption | undefined): void {
    for (const input of [this.minimum, this.maximum]) {
      input.disabled = !map;
      input.min = String(map?.sourceMinPlayers ?? 1);
      input.max = String(map?.maxPlayers ?? 1);
      input.step = '1';
    }
    this.minimum.value = String(map?.sourceMinPlayers ?? 1);
    this.maximum.value = String(map?.maxPlayers ?? 1);
  }

  read(map: MapOption | undefined): {minPlayers: number; maxPlayers: number} {
    if (!map) throw new Error('没有可用地图');
    const minPlayers = this.minimum.valueAsNumber;
    const maxPlayers = this.maximum.valueAsNumber;
    if (!Number.isInteger(minPlayers) || !Number.isInteger(maxPlayers)
        || minPlayers < map.sourceMinPlayers || minPlayers > maxPlayers
        || maxPlayers > map.maxPlayers) {
      throw new Error(`人数须为整数，且 ${map.sourceMinPlayers} ≤ 开局人数 ≤ 房间容量 ≤ ${map.maxPlayers}`);
    }
    return {minPlayers, maxPlayers};
  }
}
