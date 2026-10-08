import {isHiddenFromOpponent} from '../../../../shared/combat/optical-camouflage';
import type {MsgRoomSnapshot, PlayerSnapshot} from '../../../../shared/protocols/MsgRoomSnapshot';
import type {HudMinimapCamera} from './hud-minimap-bounds';

/** Rebuilt minimap projection. Coordinates are the snapshot's own world X/Z;
 * projection onto the original small map is the UI's decision. Effective enemy
 * optical camouflage and disguise hide actor markers under the shared observer rule.
 */
export interface HudMinimapSnapshot {
  visible: boolean;
  roomId?: string;
  round?: number;
  mapId?: number;
  imageUrl?: string;
  localPlayerId?: string;
  camera?: HudMinimapCamera;
  mode: number;
  players: readonly {id: string; name: string; team: number; x: number; z: number; yaw: number;
    alive: boolean; isVIP: boolean}[];
  objectives: readonly {id: string; kind: 'CAPTURE' | 'DESTROY'; x: number; z: number; hp: number;
    maxHp: number; ownerTeam: number; contested: boolean}[];
}

export function minimapState(snapshot: MsgRoomSnapshot, playerId: string | undefined): HudMinimapSnapshot {
  if (!['PLAYING', 'FINISHED'].includes(snapshot.phase)) {
    return {visible: false, roomId: snapshot.roomId, round: snapshot.match?.round,
      mapId: snapshot.roomInfo?.mapId, mode: snapshot.mode, players: [], objectives: []};
  }
  const local = playerId ? snapshot.players.find(player => player.id === playerId) : undefined;
  const players = snapshot.players.filter((player: PlayerSnapshot) =>
    !isHiddenFromOpponent(player, local, snapshot.mode)).map(player => ({
    id: player.id, name: player.name, team: player.team, x: player.x, z: player.z,
    yaw: player.bodyYaw ?? player.yaw, alive: player.alive, isVIP: player.isVIP,
  }));
  const objectives = (snapshot.match?.objectives ?? []).map(objective => ({
    id: objective.id, kind: objective.kind, x: objective.x, z: objective.z,
    hp: objective.hp, maxHp: objective.maxHp, ownerTeam: objective.ownerTeam, contested: objective.contested,
  }));
  return {
    visible: true,
    roomId: snapshot.roomId,
    round: snapshot.match?.round,
    mapId: snapshot.roomInfo?.mapId,
    localPlayerId: playerId,
    mode: snapshot.mode,
    players,
    objectives,
  };
}

export function sameMinimapState(left: HudMinimapSnapshot, right: HudMinimapSnapshot): boolean {
  if (left === right) return true;
  if (left.visible !== right.visible || left.roomId !== right.roomId || left.round !== right.round
      || left.mapId !== right.mapId || left.imageUrl !== right.imageUrl
      || left.localPlayerId !== right.localPlayerId || left.mode !== right.mode
      || left.players.length !== right.players.length || left.objectives.length !== right.objectives.length) return false;
  if (left.camera !== right.camera && (!left.camera || !right.camera
      || left.camera.x !== right.camera.x || left.camera.z !== right.camera.z
      || left.camera.forwardX !== right.camera.forwardX || left.camera.forwardZ !== right.camera.forwardZ
      || left.camera.rightX !== right.camera.rightX || left.camera.rightZ !== right.camera.rightZ)) return false;
  return left.players.every((player, index) => {
    const next = right.players[index];
    return player.id === next.id && player.name === next.name && player.team === next.team
      && player.x === next.x && player.z === next.z && player.yaw === next.yaw
      && player.alive === next.alive && player.isVIP === next.isVIP;
  }) && left.objectives.every((objective, index) => {
    const next = right.objectives[index];
    return objective.id === next.id && objective.kind === next.kind && objective.x === next.x
      && objective.z === next.z && objective.hp === next.hp && objective.maxHp === next.maxHp
      && objective.ownerTeam === next.ownerTeam && objective.contested === next.contested;
  });
}
