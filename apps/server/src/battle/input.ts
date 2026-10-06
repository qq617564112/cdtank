import type {MsgCall, WsServer} from 'tsrpc';
import type {ServiceType} from '../../../shared/protocols/serviceProto';
import type {MsgPlayerInput, MsgPlayerAction} from '../../../shared/protocols';
import type {World, WorldEvent} from '../world';

/** Route ordinary inputs to their authenticated participant; World decides effects. */
export function registerBattleInputs(server: WsServer<ServiceType>, world: World,
  sessions: ReadonlyMap<string, {roomId: string; playerId: string}>,
  broadcastEvent: (event: WorldEvent) => void): void {
  server.listenMsg('PlayerInput', (call: MsgCall<MsgPlayerInput>) => {
    const session = sessions.get(call.conn.id);
    if (!session) {
      return;
    }
    for (const event of world.updateInput(session.playerId, call.msg)) {
      broadcastEvent(event);
    }
  });

  server.listenMsg('PlayerAction', (call: MsgCall<MsgPlayerAction>) => {
    const session = sessions.get(call.conn.id);
    if (!session) {
      return;
    }
    for (const event of world.useAction(session.playerId, call.msg.action, call.msg.value)) {
      broadcastEvent(event);
    }
  });
}
