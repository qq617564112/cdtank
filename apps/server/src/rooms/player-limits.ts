interface PlayerLimitMap {
  sourceMinPlayers: number;
  maxPlayers: number;
}

/** Rebuilt room policy over the recovered map bounds. */
export function selectPlayerLimits(map: PlayerLimitMap, minPlayers?: number, maxPlayers?: number): {
  minPlayers: number; maxPlayers: number;
} {
  const minimum = minPlayers ?? map.sourceMinPlayers;
  const maximum = maxPlayers ?? map.maxPlayers;
  if (!Number.isInteger(minimum) || !Number.isInteger(maximum)
      || minimum < map.sourceMinPlayers || minimum > maximum || maximum > map.maxPlayers) {
    throw new Error(`房间人数须为整数且满足 ${map.sourceMinPlayers} ≤ 最少人数 ≤ 最多人数 ≤ ${map.maxPlayers}`);
  }
  return {minPlayers: minimum, maxPlayers: maximum};
}

export function roomMaxPlayers(room: {maxPlayers?: number; map: {maxPlayers: number}}): number {
  return room.maxPlayers ?? room.map.maxPlayers;
}

export function roomMinPlayers(room: {minPlayers?: number; map: {sourceMinPlayers: number}}): number {
  return room.minPlayers ?? Math.max(1, room.map.sourceMinPlayers);
}
