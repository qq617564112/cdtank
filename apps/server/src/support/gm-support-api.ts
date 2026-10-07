import type {WsServer} from 'tsrpc';
import type {MsgGmReply} from '../../../shared/protocols/MsgGmReply';
import type {ServiceType} from '../../../shared/protocols/serviceProto';
import type {AccountStore} from '../account-store';

interface GmSupportCursor {
  accountId: string;
  afterId: number;
}

/** Authenticated-page read API and single global cursor poller for final operator replies. */
export function registerGmSupportApi(server: WsServer<ServiceType>, accounts: AccountStore,
  accountByConnection: ReadonlyMap<string, string>): void {
  const cursors = new Map<string, GmSupportCursor>();

  server.implementApi('GmSupport', async call => {
    const accountId = accountByConnection.get(call.conn.id);
    if (!accountId) return call.error('请先登录账户', {code: 'ACCOUNT_REQUIRED'});
    cursors.delete(call.conn.id);
    try {
      const result = accounts.gmSupportReplies(accountId, call.req.afterId ?? 0);
      if (!result.hasMore) {
        cursors.set(call.conn.id, {accountId, afterId: result.nextAfterId});
      }
      await call.succ(result);
    } catch (error) {
      await call.error(error instanceof Error ? error.message : 'GM回复查询失败',
        {code: 'GM_SUPPORT_REJECTED'});
    }
  });

  server.flows.postDisconnectFlow.push(input => {
    cursors.delete(input.conn.id);
    return input;
  });

  let polling = false;
  const timer = setInterval(() => {
    if (polling) return;
    polling = true;
    void poll().finally(() => {polling = false;});
  }, 1000);
  timer.unref();

  async function poll(): Promise<void> {
    for (const [connectionId, cursor] of [...cursors]) {
      if (accountByConnection.get(connectionId) !== cursor.accountId) {
        cursors.delete(connectionId);
        continue;
      }
      const connection = server.connections.find(item => item.id === connectionId);
      if (!connection) {
        cursors.delete(connectionId);
        continue;
      }
      try {
        const result = accounts.gmSupportReplies(cursor.accountId, cursor.afterId);
        for (const reply of result.replies) {
          if (accountByConnection.get(connectionId) !== cursor.accountId) {
            cursors.delete(connectionId);
            break;
          }
          const message: MsgGmReply = {accountId: cursor.accountId, reply};
          await server.broadcastMsg('GmReply', message, [connection]);
          cursor.afterId = reply.id;
        }
      } catch (error) {
        console.error('GM reply push pending', error);
      }
    }
  }
}
