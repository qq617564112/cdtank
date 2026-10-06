import type {GameConnection} from './game-connection';
import type {MsgLobbyWhisper} from '../../../shared/protocols/MsgLobbyWhisper';
import type {MsgLobbyChat} from '../../../shared/protocols/MsgLobbyChat';

interface LobbyChatState {
  generation: number;
  inRoom: boolean;
  draft: string;
  channel: 'public' | 'whisper' | 'friend';
  targetName: string;
  targetAccountId?: string;
  pending: boolean;
  status: string;
  messages: readonly ((MsgLobbyChat | MsgLobbyWhisper | import('../../../shared/protocols/MsgFriendChat').MsgFriendChat | import('../../../shared/protocols/MsgRoomWhisper').MsgRoomWhisper) & {channel: 'public' | 'whisper' | 'room-whisper' | 'friend'})[];
}

/** Session-only lobby messages on the existing authenticated transport. */
export class LobbyChat {
  private state: LobbyChatState = {generation: 0, inRoom: false, draft: '', channel: 'public', targetName: '', pending: false, status: '', messages: []};
  private readonly listeners = new Set<() => void>();
  readonly getSnapshot = (): LobbyChatState => this.state;
  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {this.listeners.delete(listener);};
  };

  constructor(private readonly connection: GameConnection) {
    connection.client.listenMsg('LobbyChat', message => {
      if (this.state.inRoom || this.state.messages.some(item => item.channel === 'public' && item.id === message.id)) return;
      this.update({messages: [...this.state.messages, {...message, channel: 'public' as const}].slice(-100)});
    });
    connection.client.listenMsg('LobbyWhisper', message => {
      if (this.state.inRoom || this.state.messages.some(item => item.channel === 'whisper' && item.id === message.id)) return;
      this.update({messages: [...this.state.messages, {...message, channel: 'whisper' as const}].slice(-100)});
    });
    connection.client.listenMsg('FriendChat', message => {
      if (this.state.inRoom || this.state.messages.some(item => item.channel === 'friend' && item.id === message.id)) return;
      this.update({messages: [...this.state.messages, {...message, channel: 'friend' as const}].slice(-100)});
    });
    connection.client.listenMsg('RoomWhisper', message => {
      if (this.state.inRoom) return;
      this.update({messages: [...this.state.messages, {...message, channel: 'room-whisper' as const}].slice(-100)});
    });
    connection.client.flows.postDisconnectFlow.push(input => {
      this.reset(this.state.inRoom, '连接已断开，发送时重新连接');
      return input;
    });
  }

  private update(patch: Partial<LobbyChatState>): void {
    this.state = {...this.state, ...patch};
    for (const listener of this.listeners) listener();
  }

  private reset(inRoom: boolean, status = ''): void {
    this.update({generation: this.state.generation + 1, inRoom, draft: '', channel: 'public', targetName: '', targetAccountId: undefined, pending: false, messages: [], status});
  }

  setInRoom(inRoom: boolean): void {
    if (inRoom !== this.state.inRoom) this.reset(inRoom);
  }

  setDraft(draft: string): void {this.update({draft});}

  setChannel(channel: 'public' | 'whisper' | 'friend'): void {
    if (!this.state.pending) this.update({channel, status: ''});
  }

  setTargetName(targetName: string): void {
    if (!this.state.pending) this.update({targetName, targetAccountId: undefined, status: ''});
  }

  chooseTarget(player: {accountId: string; name: string}): void {
    if (!this.state.pending && !this.state.inRoom) this.update({channel: 'whisper',
      targetName: player.name, targetAccountId: player.accountId, status: ''});
  }

  async connect(): Promise<void> {
    const generation = this.state.generation;
    try {
      await this.connection.ensureConnected();
      if (generation === this.state.generation) this.update({status: ''});
    } catch (error) {
      if (generation === this.state.generation) this.update({status: String(error)});
    }
  }

  async sendDraft(): Promise<void> {
    if (this.state.pending || this.state.inRoom) return;
    const text = this.state.draft;
    const {channel, targetAccountId, targetName} = this.state;
    if (!text.trim() || text.trim().length > 72) {
      this.update({status: '请输入1–72字符的大厅消息'});
      return;
    }
    if (channel === 'whisper' && !targetAccountId && !targetName.trim()) {
      this.update({status: '请填写密语对象'}); return;
    }
    const generation = this.state.generation;
    this.update({pending: true, status: ''});
    try {
      await this.connection.ensureConnected();
      if (generation !== this.state.generation) return;
      const result = channel === 'public'
        ? await this.connection.client.callApi('LobbyChat', {text})
        : channel === 'friend' ? await this.connection.client.callApi('FriendChat', {text})
        : await this.connection.client.callApi('LobbyWhisper', {text,
          ...(targetAccountId ? {targetAccountId} : {targetName})});
      if (generation !== this.state.generation) return;
      if (!result.isSucc) throw new Error(result.err.message);
      // The broadcast owns the log; the response only confirms this draft.
      this.update({draft: this.state.draft === text ? '' : this.state.draft, status: ''});
    } catch (error) {
      if (generation === this.state.generation) this.update({status: error instanceof Error ? error.message : String(error)});
    } finally {
      if (generation === this.state.generation) this.update({pending: false});
    }
  }
}
