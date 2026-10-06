import type {MsgRoomSnapshot} from '../../../../shared/protocols';

/** Rebuilt roster projection; native slot order is recorded separately as a source gap. */
export function waitingRoomSlots(snapshot: MsgRoomSnapshot) {
  const slots = Array.from({length: 12}, () => undefined as MsgRoomSnapshot['players'][number] | undefined);
  const counts = [0, 0];
  for (const player of snapshot.players) {
    if (snapshot.mode > 3) {
      const index = counts[0]++;
      if (index < slots.length) slots[index] = player;
    } else if (player.team === 0 || player.team === 1) {
      const ordinal = counts[player.team]++;
      if (ordinal < 6) slots[player.team * 6 + ordinal] = player;
    }
  }
  return {slots, overflow: snapshot.players.filter(player => !slots.includes(player))};
}

/** Native 50e14d/50e5cc uses definition+0xc; Web supplies its recovered tankId. */
export function waitingTankReference(tankId: number): string | undefined {
  if (!Number.isSafeInteger(tankId) || tankId <= 0) return undefined;
  return `set:tanke0 image:${['data', 'ui', 'tanke', `${String(tankId).padStart(3, '0')}.tga`].join('\\')}`;
}

/** Older servers omit metadata; do not infer it from live remaining time or room IDs. */
export function waitingRoomInfo(snapshot: MsgRoomSnapshot) {
  const info = snapshot.roomInfo;
  return {
    name: info?.name ?? '资料不可用',
    mapName: info?.mapName ?? '资料不可用',
    time: info ? String(info.timeLimitSeconds) : '—',
    locked: !!info?.hasPassword,
    description: info?.mapDescription || (info ? '暂无地图说明' : '服务器未提供房间资料'),
  };
}
