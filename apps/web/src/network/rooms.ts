import type {WsClient} from 'tsrpc-browser';
import type {ServiceType} from '../../../shared/protocols/serviceProto';
import type {ReqCreateRoom} from '../../../shared/protocols/PtlCreateRoom';
import type {ReqEditRoom} from '../../../shared/protocols/PtlEditRoom';
import type {ReqKickRoomPlayer} from '../../../shared/protocols/PtlKickRoomPlayer';
import type {ReqJoin} from '../../../shared/protocols/PtlJoin';
import type {ReqReady} from '../../../shared/protocols/PtlReady';
import type {ReqChangeTeam} from '../../../shared/protocols/PtlChangeTeam';
import type {ReqCpu} from '../../../shared/protocols/PtlCpu';
import type {ReqAutopilot} from '../../../shared/protocols/PtlAutopilot';
import type {ReqRematch} from '../../../shared/protocols/PtlRematch';
import type {LeavePenalty, ReqLeave, ResLeave} from '../../../shared/protocols/PtlLeave';
import type {ReqRoomInvite} from '../../../shared/protocols/PtlRoomInvite';
import type {ReqAddRoomCpu, ResAddRoomCpu, RoomCpuHttpError} from '../../../shared/http/room-cpu';
import {gameServerHttpUrl} from './connection-preferences';

/** HTTP CPU additions and room requests on the authenticated WebSocket. */
export class RoomConnection {
  constructor(private readonly client: WsClient<ServiceType>,
    private readonly ensureConnected: () => Promise<void>,
    private readonly accountToken: () => string | undefined) {}

  async chat(text: string, channel: 0 | 1 = 0): Promise<void> {
    const result = await this.client.callApi('RoomChat', {channel, text});
    if (!result.isSucc) throw new Error(result.err.message);
  }

  async whisper(request: import('../../../shared/protocols/PtlRoomWhisper').ReqRoomWhisper): Promise<void> {
    const result = await this.client.callApi('RoomWhisper', request);
    if (!result.isSucc) throw new Error(result.err.message);
  }

  async leave(request: ReqLeave): Promise<ResLeave> {
    const result = await this.client.callApi('Leave', request);
    if (!result.isSucc) throw new Error(result.err.message);
    return result.res;
  }

  async quoteExitPenalty(request: ReqLeave): Promise<LeavePenalty> {
    const result = await this.client.callApi('Leave', {...request, quoteOnly: true});
    if (!result.isSucc) throw new Error(result.err.message);
    if (!result.res.penalty) throw new Error('退出处罚报价不可用');
    return result.res.penalty;
  }

  async invite(request: ReqRoomInvite) {
    const result = await this.client.callApi('RoomInvite', request);
    if (!result.isSucc) throw new Error(result.err.message);
    return result.res;
  }

  async listRooms() {
    await this.ensureConnected();
    const result = await this.client.callApi('ListRooms', {});
    if (!result.isSucc) throw new Error(result.err.message);
    return result.res.rooms;
  }

  async listMaps() {
    await this.ensureConnected();
    const result = await this.client.callApi('ListMaps', {});
    if (!result.isSucc) throw new Error(result.err.message);
    return result.res.maps;
  }

  // Battle checks session cancellation before accepting or reporting a join result.
  create(request: ReqCreateRoom) {return this.client.callApi('CreateRoom', request);}
  join(request: ReqJoin) {return this.client.callApi('Join', request);}

  async edit(request: ReqEditRoom): Promise<void> {
    const result = await this.client.callApi('EditRoom', request);
    if (!result.isSucc) throw new Error(result.err.message);
  }

  async kick(request: ReqKickRoomPlayer): Promise<void> {
    const result = await this.client.callApi('KickRoomPlayer', request);
    if (!result.isSucc) throw new Error(result.err.message);
  }

  resume(request: import('../../../shared/protocols/PtlResumeRoom').ReqResumeRoom) {
    return this.client.callApi('ResumeRoom', request);
  }

  async ready(request: ReqReady): Promise<void> {
    const result = await this.client.callApi('Ready', request);
    if (!result.isSucc) throw new Error(result.err.message);
  }

  async changeTeam(request: ReqChangeTeam): Promise<void> {
    const result = await this.client.callApi('ChangeTeam', request);
    if (!result.isSucc) throw new Error(result.err.message);
  }

  async cpu(request: ReqCpu): Promise<void> {
    const result = await this.client.callApi('Cpu', request);
    if (!result.isSucc) throw new Error(result.err.message);
  }

  async addCpu(roomId: string, request: ReqAddRoomCpu): Promise<ResAddRoomCpu> {
    await this.ensureConnected();
    const token = this.accountToken();
    if (!token) throw new Error('请先登录账户');
    const response = await fetch(gameServerHttpUrl(`/game/api/rooms/${encodeURIComponent(roomId)}/cpus`), {
      method: 'POST',
      headers: {'Content-Type': 'application/json', Authorization: `Bearer ${token}`},
      body: JSON.stringify(request),
    });
    const body = await response.text();
    let result: Partial<ResAddRoomCpu & RoomCpuHttpError> | undefined;
    try {
      result = body ? JSON.parse(body) : undefined;
    } catch {
      throw new Error('新增机器人暂时无法确认，请查看房间状态后再操作');
    }
    if (!response.ok) {
      throw new Error(typeof result?.error?.message === 'string'
        ? result.error.message : `新增机器人请求失败（HTTP ${response.status}）`);
    }
    if (result?.round !== request.round || typeof result.playerId !== 'string' || !result.playerId) {
      throw new Error('新增机器人暂时无法确认，请查看房间状态后再操作');
    }
    return {round: result.round, playerId: result.playerId};
  }

  async autopilot(request: ReqAutopilot): Promise<void> {
    const result = await this.client.callApi('Autopilot', request);
    if (!result.isSucc) throw new Error(result.err.message);
  }

  async rematch(request: ReqRematch): Promise<void> {
    const result = await this.client.callApi('Rematch', request);
    if (!result.isSucc) throw new Error(result.err.message);
  }
}
