import {DEFAULT_QUICK_CHAT_PREFERENCES, validateQuickChatPreferences} from '../settings/quick-chat-preferences';
import type {QuickChatKey, QuickChatPreferences} from '../settings/quick-chat-preferences';

export interface BattleChatSnapshot {
  visible: boolean;
  sourceActive: boolean;
  players: readonly {id: string; name: string}[];
  messages: readonly {id: number; text: string}[];
  draft: string;
  targetName: string;
  channel: 0 | 1 | 2 | 3;
  status: string;
  pending: boolean;
  generation: number;
}

/** Acknowledged room chat state. Presentation and keyboard listeners belong to React. */
export class BattleChat {
  private state: BattleChatSnapshot = {
    visible: false, sourceActive: false, players: [], messages: [], draft: '', targetName: '', channel: 0,
    status: '', pending: false, generation: 0,
  };
  private nextMessage = 0;
  private readonly listeners = new Set<() => void>();
  private quickChats: QuickChatPreferences = {...DEFAULT_QUICK_CHAT_PREFERENCES};
  constructor(private readonly send: (text: string, channel: 0 | 1 | 2 | 3, targetName?: string) => Promise<void>,
    private readonly releaseKeys: () => void) {}

  readonly getSnapshot = (): BattleChatSnapshot => this.state;
  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {this.listeners.delete(listener);};
  };
  private update(next: Partial<BattleChatSnapshot>): void {
    this.state = {...this.state, ...next};
    for (const listener of this.listeners) listener();
  }
  releaseInputKeys(): void {this.releaseKeys();}
  setDraft(draft: string): void {this.update({draft});}
  setTargetName(targetName: string): void {if (!this.state.pending) this.update({targetName});}
  setStatus(status: string): void {this.update({status});}
  setChannel(channel: 0 | 1 | 2 | 3): void {
    if (!this.state.pending) this.update({channel});
  }
  setPhase(phase: string): void {
    const sourceActive = phase === 'PLAYING' || phase === 'FINISHED';
    if (sourceActive !== this.state.sourceActive) this.update({sourceActive});
  }
  setPlayers(players: readonly {id: string; name: string}[]): void {
    if (players.length === this.state.players.length && players.every((player, index) =>
      player.id === this.state.players[index].id && player.name === this.state.players[index].name)) return;
    this.update({players: players.map(({id, name}) => ({id, name}))});
  }
  setQuickChats(preferences: QuickChatPreferences): void {
    const valid = validateQuickChatPreferences(preferences);
    if (!valid) throw new Error('快捷聊天配置无效');
    this.quickChats = valid;
  }
  sendQuickChat(key: QuickChatKey): void {
    const text = this.quickChats[key].trim();
    if (text) this.sendText(text, false);
  }
  sendDraft(): void {
    const text = this.state.draft.trim();
    if (!this.state.visible || this.state.pending) return;
    if (!text || text.length > 72 || /[\u0000-\u001f\u007f]/.test(text)) {
      this.update({status: '请输入1至72字符的有效内容'});
      return;
    }
    this.sendText(text, true);
  }
  private sendText(text: string, clearDraft: boolean): void {
    if (!this.state.visible || this.state.pending) return;
    const generation = this.state.generation;
    const channel = this.state.channel;
    const targetName = this.state.targetName;
    if (channel === 2 && !targetName.trim()) {this.update({status: '请填写密语对象'}); return;}
    this.update({pending: true, status: '正在发送…'});
    void this.send(text, channel, targetName).then(() => {
      if (generation !== this.state.generation) return;
      this.update({status: '', ...(clearDraft && this.state.draft.trim() === text ? {draft: ''} : {})});
    }).catch(error => {
      if (generation === this.state.generation) this.update({status: String(error)});
    }).finally(() => {
      if (generation === this.state.generation) this.update({pending: false});
    });
  }
  receivedPrivate(text: string): void {if (this.state.visible) this.message(text);}
  show(): void {this.update({visible: true});}
  message(text: string): void {
    this.update({messages: [...this.state.messages, {id: ++this.nextMessage, text}].slice(-50)});
  }
  clear(): void {
    this.update({visible: false, sourceActive: false, players: [], messages: [], draft: '', targetName: '', channel: 0,
      status: '', pending: false, generation: this.state.generation + 1});
  }
}
