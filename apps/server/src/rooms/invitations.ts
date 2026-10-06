import {randomUUID} from 'node:crypto';
import type {WsServer} from 'tsrpc';
import type {ServiceType} from '../../../shared/protocols/serviceProto';
import type {World} from '../world';

/** Rebuilt untargeted recruitment: only authenticated lobby connections receive it. */
export function registerRoomInvitations(server: WsServer<ServiceType>, world: World,
  accounts: ReadonlyMap<string,string>, sessions: ReadonlyMap<string,{roomId:string;playerId:string}>): void {
  const cooldowns = new Map<string,number>();
  server.flows.postDisconnectFlow.push(input => {cooldowns.delete(input.conn.id); return input;});
  server.implementApi('RoomInvite', async call => {
    const session = sessions.get(call.conn.id);
    const snapshot = session && world.snapshot(session.roomId);
    const player = snapshot?.players.find(value => value.id === session?.playerId);
    const room = world.listRooms().find(value => value.id === session?.roomId);
    if (!accounts.has(call.conn.id) || !session || !snapshot || !room || !player || player.isCpu
        || call.req.roomId !== session.roomId || call.req.round !== snapshot.match?.round
        || snapshot.phase !== 'WAITING' || room.playerCount >= room.maxPlayers) {
      return call.error('当前房间不能发送邀请', {code:'INVITE_REJECTED'});
    }
    const now = Date.now();
    if ((cooldowns.get(call.conn.id) ?? 0) > now) {
      return call.error('请稍后再次邀请', {code:'INVITE_COOLDOWN'});
    }
    const recipients = server.connections.filter(conn => accounts.has(conn.id) && !sessions.has(conn.id));
    if (!recipients.length) return call.error('当前没有可邀请的大厅玩家', {code:'INVITE_EMPTY'});
    const invitationId = randomUUID(), expiresAt = now + 30000;
    cooldowns.set(call.conn.id, expiresAt);
    await server.broadcastMsg('RoomInvitation', {invitationId, room, senderName: player.name, expiresAt}, recipients);
    await call.succ({invitationId, expiresAt, recipientCount:recipients.length});
  });
}
