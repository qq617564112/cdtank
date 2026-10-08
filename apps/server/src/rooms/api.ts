import type {ApiCall, WsServer} from 'tsrpc';
import type {ServiceType} from '../../../shared/protocols/serviceProto';
import type {ReqJoin, ResJoin, ReqListRooms, ResListRooms, ReqQuickMatch, ResQuickMatch}
  from '../../../shared/protocols';
import type {World} from '../world';

interface RoomSession {
  roomId: string;
  playerId: string;
}

/** Existing room commands on the authenticated connection; World owns lifecycle rules. */
export function registerRoomApis(
  server: WsServer<ServiceType>,
  world: World,
  sessionByConnection: Map<string, RoomSession>,
  roomTankId: (connectionId: string, requestedId: number) => number,
  bindAccountState: (connectionId: string, playerId: string) => void,
  broadcastRoomState: (roomId: string) => void,
  displayName: (connectionId: string) => string,
): void {
  server.implementApi('ResumeRoom', async call => {
    const session = sessionByConnection.get(call.conn.id);
    if (!session || session.roomId !== call.req.roomId || session.playerId !== call.req.playerId) {
      return call.error('原房间保留已结束，请重新加入', {code: 'ROOM_RESUME_REJECTED'});
    }
    const snapshot = world.snapshot(session.roomId);
    if (!snapshot || !snapshot.players.some(player => player.id === session.playerId)) {
      return call.error('原房间保留已结束，请重新加入', {code: 'ROOM_RESUME_REJECTED'});
    }
    await call.succ({snapshot, inputSequence: world.playerInputSequence(session.playerId)});
    broadcastRoomState(session.roomId);
  });

  server.implementApi('Join', async (call: ApiCall<ReqJoin, ResJoin>) => {
    let result;
    try {
      result = world.joinRoom(call.req.roomId ?? 'R1', call.conn.id, displayName(call.conn.id), roomTankId(call.conn.id, call.req.tankId), call.req.password);
    } catch (error) {
      await call.error(error instanceof Error ? error.message : '加入失败', {code: 'ROOM_JOIN_REJECTED'});
      return;
    }
    sessionByConnection.set(call.conn.id, {roomId: result.roomId, playerId: result.playerId});
    bindAccountState(call.conn.id, result.playerId);
    await call.succ({
      playerId: result.playerId,
      room: {
        id: result.roomId,
        name: world.roomName(result.roomId),
        mode: result.mode,
        mapId: result.mapId,
        players: world.roomPlayers(result.roomId),
        round: world.snapshot(result.roomId)!.match!.round,
        phase: world.snapshot(result.roomId)!.phase,
      },
      serverTime: Date.now(),
    });
    broadcastRoomState(result.roomId);
  });

  server.implementApi('ListMaps', async call => {
    await call.succ({maps: world.listMaps()});
  });

  server.implementApi('CreateRoom', async call => {
    try {
      const result = world.createAndJoin(call.conn.id, call.req.mode, call.req.mapId,
        call.req.roomName, displayName(call.conn.id), roomTankId(call.conn.id, call.req.tankId), call.req.password, call.req.minPlayers, call.req.maxPlayers, call.req.friendlyFire);
      sessionByConnection.set(call.conn.id, {roomId: result.roomId, playerId: result.playerId});
      bindAccountState(call.conn.id, result.playerId);
      const snapshot = world.snapshot(result.roomId)!;
      await call.succ({playerId: result.playerId, serverTime: Date.now(), room: {
        id: result.roomId, name: world.roomName(result.roomId), mode: result.mode, mapId: result.mapId,
        players: world.roomPlayers(result.roomId), round: snapshot.match!.round, phase: snapshot.phase,
      }});
      broadcastRoomState(result.roomId);
    } catch (error) {
      await call.error(error instanceof Error ? error.message : '创建房间失败', {code: 'ROOM_CONFLICT'});
    }
  });

  server.implementApi('EditRoom', async call => {
    const session = sessionByConnection.get(call.conn.id);
    if (!session) return call.error('请先加入房间', {code: 'NOT_JOINED'});
    try {
      const round = world.editRoom(session.playerId, call.req);
      await call.succ({round});
      broadcastRoomState(session.roomId);
    } catch (error) {
      await call.error(error instanceof Error ? error.message : '编辑房间失败', {code: 'ROOM_EDIT_REJECTED'});
    }
  });

  server.implementApi('ListRooms', async (call: ApiCall<ReqListRooms, ResListRooms>) => {
    await call.succ({rooms: world.listRooms()});
  });

  server.implementApi('Ready', async call => {
    const session = sessionByConnection.get(call.conn.id);
    if (!session) return call.error('请先加入房间', {code: 'NOT_JOINED'});
    try {
      const round = call.req.resourcesLoaded
        ? world.resourcesLoaded(session.playerId, call.req.round)
        : world.ready(session.playerId, call.req.round, call.req.isReady);
      await call.succ({round});
      broadcastRoomState(session.roomId);
    } catch (error) {
      await call.error(error instanceof Error ? error.message : '准备失败', {code: 'ROUND_CONFLICT'});
    }
  });

  server.implementApi('Rematch', async call => {
    const session = sessionByConnection.get(call.conn.id);
    if (!session) return call.error('请先加入房间', {code: 'NOT_JOINED'});
    try {
      await call.succ({round: world.rematch(session.playerId, call.req.round)});
      broadcastRoomState(session.roomId);
    } catch (error) {
      await call.error(error instanceof Error ? error.message : '返回房间失败', {code: 'ROUND_CONFLICT'});
    }
  });

  server.implementApi('ChangeTeam', async call => {
    const session = sessionByConnection.get(call.conn.id);
    if (!session) return call.error('请先加入房间', {code: 'NOT_JOINED'});
    try {
      const team = world.changeTeam(session.playerId, call.req.round, call.req.team);
      await call.succ({round: call.req.round, team});
      broadcastRoomState(session.roomId);
    } catch (error) {
      await call.error(error instanceof Error ? error.message : '换队失败', {code: 'TEAM_CONFLICT'});
    }
  });

  server.implementApi('Cpu', async call => {
    const session = sessionByConnection.get(call.conn.id);
    if (!session) return call.error('请先加入房间', {code: 'NOT_JOINED'});
    try {
      const playerId = world.manageCpu(session.playerId, call.req.round, call.req.operation,
        call.req.tankId, call.req.playerId, call.req.loadout, call.req.team);
      await call.succ({round: call.req.round, playerId});
      broadcastRoomState(session.roomId);
    } catch (error) {
      await call.error(error instanceof Error ? error.message : 'CPU操作失败', {code: 'CPU_CONFLICT'});
    }
  });

  server.implementApi('Autopilot', async call => {
    const session = sessionByConnection.get(call.conn.id);
    if (!session) return call.error('请先加入房间', {code: 'NOT_JOINED'});
    try {
      world.configureAutopilot(session.playerId, call.req.round, call.req.enabled);
      await call.succ({round: call.req.round, enabled: call.req.enabled});
      broadcastRoomState(session.roomId);
    } catch (error) {
      await call.error(error instanceof Error ? error.message : 'AI托管设置失败', {code: 'AUTOPILOT_CONFLICT'});
    }
  });

  server.implementApi('QuickMatch', async (call: ApiCall<ReqQuickMatch, ResQuickMatch>) => {
    let result;
    try {
      result = world.quickMatch(call.conn.id, displayName(call.conn.id), roomTankId(call.conn.id, call.req.tankId));
    } catch (error) {
      return call.error(error instanceof Error ? error.message : '快速匹配失败', {code: 'ROOM_JOIN_REJECTED'});
    }
    sessionByConnection.set(call.conn.id, {roomId: result.roomId, playerId: result.playerId});
    bindAccountState(call.conn.id, result.playerId);
    await call.succ({roomId: result.roomId});
    broadcastRoomState(result.roomId);
  });
}
