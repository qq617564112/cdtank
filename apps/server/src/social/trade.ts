import {randomUUID} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import type {WsServer} from 'tsrpc';
import type {ServiceType} from '../../../shared/protocols/serviceProto';
import type {ReqTrade, ResTrade, TradeOffer, TradeSession} from '../../../shared/protocols/PtlTrade';
import type {AccountStore} from '../account-store';
import type {PreparedTradeOffer} from '../accounts/trade';

interface Session {
  id: string; revision: number; phase: TradeSession['phase']; reason?: string;
  connectionIds: string[];
  members: [string, string]; offers: [PreparedTradeOffer, PreparedTradeOffer];
  shown: [boolean, boolean]; confirmed: [boolean, boolean];
}
const emptyOffer = (): TradeOffer => ({money: 0, originality: 0, skillPoints: 0, records: []});

/** Rebuilt online account sessions; original actions remain Show/Unshow/Exchange/Cancel. */
export function registerTradeApi(server: WsServer<ServiceType>, accounts: AccountStore,
  identities: ReadonlyMap<string, string>, rooms: ReadonlyMap<string, {roomId: string; playerId: string}>):
  {assertLobbyAvailable(accountId: string): void} {
  const byAccount = new Map<string, Session>();
  const active = (session: Session | undefined) => session?.phase === 'INVITED' || session?.phase === 'OPEN';
  const connections = (accountId: string) => server.connections.filter(conn => identities.get(conn.id) === accountId && !rooms.has(conn.id));
  const inRoom = (accountId: string) => [...identities].some(([connectionId, id]) => id === accountId && rooms.has(connectionId));
  function snapshot(accountId: string, session = byAccount.get(accountId)): ResTrade {
    return {account: accounts.tradeAccount(accountId), session: session && {
      id: session.id, revision: session.revision, phase: session.phase, reason: session.reason,
      inviterAccountId: session.members[0], parties: session.members.map((id, index) => {
        const visible = id === accountId || session.shown[index] || session.phase === 'COMPLETED';
        return {accountId: id, name: accounts.displayName(id), offer: visible ? session.offers[index].offer : emptyOffer(),
          records: visible ? session.offers[index].records : [], shown: session.shown[index], confirmed: session.confirmed[index]};
      }),
    }};
  }
  async function publish(session: Session): Promise<void> {
    for (const id of session.members) await server.broadcastMsg('TradeState', snapshot(id, session), connections(id));
  }
  function cancel(session: Session, reason: string): void {
    session.phase = 'CANCELLED'; session.reason = reason; session.revision++;
    session.shown = [false, false]; session.confirmed = [false, false];
  }
  server.flows.postDisconnectFlow.push(input => {
    for (const session of new Set(byAccount.values())) {
      if (active(session) && session.connectionIds.includes(input.conn.id)) {
        cancel(session, '交易连接已断开'); void publish(session);
      }
    }
    return input;
  });
  async function request(accountId: string, req: ReqTrade): Promise<ResTrade> {
    let session = byAccount.get(accountId);
    if (req.operation === 'QUERY') return snapshot(accountId);
    if (inRoom(accountId)) throw new Error('请先离开房间再交易');
    if (req.operation === 'INVITE') {
      const target = req.targetAccountId;
      if (!target || target === accountId) throw new Error('请选择另一位玩家');
      if (!connections(target).length || inRoom(target)) throw new Error('对方不在大厅');
      if (accounts.isBlocked(accountId, target) || accounts.isBlocked(target, accountId)) throw new Error('无法向屏蔽关系玩家发起交易');
      if (active(session) || active(byAccount.get(target))) throw new Error('玩家已有进行中的交易');
      for (const id of [accountId, target]) if (!accounts.tradeAccount(id).wallet) throw new Error('交易双方须先建立角色资料');
      session = {id: randomUUID(), revision: 1, phase: 'INVITED', members: [accountId, target],
        connectionIds: [...connections(accountId), ...connections(target)].map(conn => conn.id),
        offers: [{offer: emptyOffer(), records: []}, {offer: emptyOffer(), records: []}], shown: [false, false], confirmed: [false, false]};
      for (const id of session.members) byAccount.set(id, session);
    } else {
      if (!session || req.sessionId !== session.id) throw new Error('交易会话已结束');
      const index = session.members.indexOf(accountId);
      if (index < 0) throw new Error('不属于该交易会话');
      if (req.operation === 'CANCEL') {
        if (active(session)) cancel(session, '交易已取消');
      } else if (req.operation === 'RESPOND') {
        if (session.phase !== 'INVITED' || index !== 1 || typeof req.accept !== 'boolean') throw new Error('交易邀请不能在此状态回应');
        if (req.accept) {session.phase = 'OPEN'; session.revision++;} else cancel(session, '交易邀请已拒绝');
      } else {
        if (session.phase === 'COMPLETED' && req.operation === 'CONFIRM') return snapshot(accountId);
        if (session.phase !== 'OPEN') throw new Error('交易不在可操作阶段');
        if (session.members.some(id => inRoom(id) || !connections(id).length)) {
          cancel(session, '交易双方须保持在大厅'); await publish(session); throw new Error(session.reason);
        }
        if (req.expectedRevision !== session.revision) throw new Error('交易报价已改变，请查看最新状态');
        if (req.operation === 'OFFER') {
          if (!req.offer) throw new Error('交易报价缺失');
          session.offers[index] = accounts.prepareTrade(accountId, req.offer);
          session.shown = [false, false]; session.confirmed = [false, false];
        } else if (req.operation === 'SHOW') {
          const prepared = accounts.prepareTrade(accountId, req.offer ?? session.offers[index].offer);
          if (!isDeepStrictEqual(prepared, session.offers[index])) session.shown = [false, false];
          session.offers[index] = prepared;
          session.shown[index] = true; session.confirmed = [false, false];
        } else if (req.operation === 'UNSHOW') {
          session.shown[index] = false; session.confirmed = [false, false];
        } else if (req.operation === 'CONFIRM') {
          if (!session.shown.every(Boolean)) throw new Error('请先等待双方展示报价');
          session.confirmed[index] = true;
          if (session.confirmed.every(Boolean)) {
            try {accounts.settleTrade(session.id, session.members, session.offers); session.phase = 'COMPLETED';}
            catch (error) {
              session.confirmed = [false, false]; session.shown = [false, false]; session.revision++;
              await publish(session); throw error;
            }
          }
        } else throw new Error('交易操作无效');
        session.revision++;
      }
    }
    await publish(session!);
    return snapshot(accountId);
  }
  server.implementApi('Trade', async call => {
    const accountId = identities.get(call.conn.id);
    if (!accountId) return call.error('请先登录账户', {code: 'ACCOUNT_REQUIRED'});
    try {await call.succ(await request(accountId, call.req));}
    catch (error) {await call.error(error instanceof Error ? error.message : '交易失败', {code: 'TRADE_REJECTED'});}
  });
  return {assertLobbyAvailable(accountId: string): void {
    if (active(byAccount.get(accountId))) throw new Error('请先完成或取消交易');
  }};
}
