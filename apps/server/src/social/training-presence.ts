import type {WsServer} from 'tsrpc';
import type {ServiceType} from '../../../shared/protocols/serviceProto';

/** Training publishes account availability without registering a simulation room. */
export function registerTrainingPresenceApi(server: WsServer<ServiceType>,
  accounts: ReadonlyMap<string, string>, sessions: ReadonlyMap<string, unknown>): (connectionId: string) => boolean {
  const training = new Map<string, string>();
  server.flows.postDisconnectFlow.push(input => {training.delete(input.conn.id); return input;});
  server.implementApi('TrainingPresence', async call => {
    const accountId = accounts.get(call.conn.id);
    if (!accountId) return call.error('请先登录账户', {code: 'ACCOUNT_REQUIRED'});
    if (call.req.active && sessions.has(call.conn.id)) {
      return call.error('请先离开联机房间', {code: 'ALREADY_JOINED'});
    }
    if (call.req.active) training.set(call.conn.id, accountId);
    else training.delete(call.conn.id);
    await call.succ({active: call.req.active});
  });
  return connectionId => {
    const accountId = accounts.get(connectionId);
    return accountId !== undefined && [...training.values()].includes(accountId);
  };
}
