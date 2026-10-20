import type {IncomingMessage, ServerResponse} from 'node:http';
import type {WsServer} from 'tsrpc';
import type {ServiceType} from '../../../shared/protocols/serviceProto';
import type {ResAccount} from '../../../shared/protocols/PtlAccount';
import type {ReqAddRoomCpu, ResAddRoomCpu, RoomCpuHttpError} from '../../../shared/http/room-cpu';
import type {RoomWorld} from './world-interface';

interface RoomSession {
  roomId: string;
  playerId: string;
}

function sendJson(response: ServerResponse, status: number, body: ResAddRoomCpu | RoomCpuHttpError): void {
  response.writeHead(status, {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store'});
  response.end(JSON.stringify(body));
}

function isAddCpuRequest(value: unknown): value is ReqAddRoomCpu {
  if (typeof value !== 'object' || value === null) return false;
  const input = value as {requesterPlayerId?: unknown; round?: unknown; tankId?: unknown; team?: unknown};
  return typeof input.requesterPlayerId === 'string' && input.requesterPlayerId.length > 0
    && typeof input.round === 'number' && Number.isInteger(input.round) && input.round > 0
    && (input.tankId === undefined || (typeof input.tankId === 'number'
      && Number.isInteger(input.tankId) && input.tankId > 0))
    && (input.team === undefined || input.team === 0 || input.team === 1);
}

/** Reuse authenticated live WebSocket sessions without querying account storage. */
export function createRoomCpuHttpHandler(server: WsServer<ServiceType>, world: RoomWorld,
  accounts: ReadonlyMap<string, string>, sessions: ReadonlyMap<string, RoomSession>,
  broadcastRoomState: (roomId: string) => void):
  (request: IncomingMessage, response: ServerResponse) => boolean {
  const tokensByConnection = new Map<string, string>();
  server.flows.preApiReturnFlow.push(input => {
    if (input.call.service.name === 'Account') {
      if (input.return.isSucc) {
        const account: ResAccount = input.return.res;
        tokensByConnection.set(input.call.conn.id, account.token);
      } else if (!accounts.has(input.call.conn.id)) tokensByConnection.delete(input.call.conn.id);
    }
    return input;
  });
  server.flows.postDisconnectFlow.push(input => {
    tokensByConnection.delete(input.conn.id);
    return input;
  });

  async function addCpu(request: IncomingMessage, response: ServerResponse, roomId: string): Promise<void> {
    const authorization = request.headers.authorization;
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : undefined;
    if (!token || !server.connections.some(candidate =>
      accounts.has(candidate.id) && tokensByConnection.get(candidate.id) === token)) {
      sendJson(response, 401, {error: {code: 'ACCOUNT_REQUIRED', message: '请先登录账户'}});
      return;
    }
    let input: unknown;
    try {
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(chunk as Buffer);
      input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch {
      sendJson(response, 400, {error: {code: 'INVALID_REQUEST', message: 'CPU请求格式无效'}});
      return;
    }
    if (!isAddCpuRequest(input)) {
      sendJson(response, 400, {error: {code: 'INVALID_REQUEST', message: 'CPU请求参数无效'}});
      return;
    }
    const connection = server.connections.find(candidate => {
      const session = sessions.get(candidate.id);
      return accounts.has(candidate.id) && tokensByConnection.get(candidate.id) === token
        && session?.roomId === roomId && session.playerId === input.requesterPlayerId;
    });
    const session = connection ? sessions.get(connection.id) : undefined;
    if (!session) {
      sendJson(response, 403, {error: {code: 'NOT_JOINED', message: '请先加入当前房间'}});
      return;
    }
    let playerId: string;
    try {
      playerId = await world.manageCpu(session.playerId, input.round, 'ADD', input.tankId,
        undefined, undefined, input.team);
    } catch (error) {
      sendJson(response, 409, {error: {code: 'CPU_CONFLICT',
        message: error instanceof Error ? error.message : 'CPU添加失败'}});
      return;
    }
    sendJson(response, 201, {round: input.round, playerId});
    broadcastRoomState(roomId);
  }

  return (request, response) => {
    const pathname = (request.url ?? '/').split('?')[0];
    const match = /^\/+(?:game\/)?api\/rooms\/([^/]+)\/cpus$/.exec(pathname);
    if (!match) return false;
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    if (request.method === 'OPTIONS') {
      response.writeHead(204);
      response.end();
      return true;
    }
    if (request.method !== 'POST') {
      response.setHeader('Allow', 'POST');
      sendJson(response, 405, {error: {code: 'METHOD_NOT_ALLOWED', message: '请使用POST添加CPU'}});
      return true;
    }
    void addCpu(request, response, match[1]);
    return true;
  };
}
