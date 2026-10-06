import {roomMaxPlayers} from './player-limits';
import {TANKS} from '../config';
import {BotController} from '../battle/cpu/controller';
import type {PlayerState} from '../battle/player-state';
import type {RoomState, JoinResult} from './state';
import {readyCpus} from './preparation';
import {configureRoomCpuLoadout} from './cpu-loadout';
import type {CpuLoadoutItem} from '../../../shared/protocols/PtlCpu';

/** World verifies current membership, round and WAITING before invoking. */
export function manageRoomCpu(room: RoomState, owner: PlayerState, operation: 'ADD' | 'REMOVE' | 'CONFIGURE',
  tankId: number, cpuId: string | undefined, insert: () => JoinResult, loadout?: CpuLoadoutItem[]): string {
  if (owner.cpu || room.creatorClientId !== owner.clientId) {
    throw new Error('只有房主可以管理CPU');
  }
  if (operation === 'CONFIGURE') return configureRoomCpuLoadout(room, owner, cpuId, loadout);
  if (operation === 'REMOVE') {
    const cpu = cpuId ? room.players.get(cpuId) : undefined;
    if (!cpu?.cpu) throw new Error('CPU不存在');
    room.players.delete(cpu.id);
    room.ready.clear();
    readyCpus(room);
    return cpu.id;
  }
  if (operation !== 'ADD' || !TANKS.some(tank => tank.id === tankId)) throw new Error('战车不存在');
  if (room.players.size >= roomMaxPlayers(room)) throw new Error('房间已满');
  const joined = insert();
  room.players.get(joined.playerId)!.cpu = new BotController();
  room.ready.clear();
  readyCpus(room);
  return joined.playerId;
}
