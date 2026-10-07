import {DEFAULT_QUICK_CHAT_PREFERENCES, validateQuickChatPreferences} from '../settings/quick-chat-preferences';
import type {QuickChatKey, QuickChatPreferences} from '../settings/quick-chat-preferences';
import type {Family} from '../../network/family';
import type {MsgFamilyChat} from '../../../shared/protocols/MsgFamilyChat';
import {CHAT_NOTICE_FADE_MS, CHAT_NOTICE_FULL_MS} from './battle-chat-visibility';

export interface BattleChatSnapshot {
  visible: boolean;
  phase: string;
  sourceActive: boolean;
  editing: boolean;
  noticePhase: 'hidden' | 'full' | 'fading';
  confirmedSends: number;
  players: readonly {id: string; name: string}[];
  messages: readonly {id: number; text: string}[];
  draft: string;
  targetName: string;
  channel: 0 | 1 | 2 | 3 | 5;
  status: string;
  pending: boolean;
  generation: number;
}

/** Acknowledged room chat state. Presentation and keyboard listeners belong to React. */
export class BattleChat {
  private state: BattleChatSnapshot = {
    visible: false, phase: '', sourceActive: false, editing: false, noticePhase: 'hidden', confirmedSends: 0,
    players: [], messages: [], draft: '', targetName: '', channel: 0, status: '', pending: false, generation: 0,
  };
  private nextMessage = 0;
  private noticeTimer?: ReturnType<typeof setTimeout>;
  private readonly listeners = new Set<() => void>();
  private readonly familyMessageIds = new Set<string>();
  private readonly unsubscribeAccountContext: () => void;
  private quickChats: QuickChatPreferences = {...DEFAULT_QUICK_CHAT_PREFERENCES};
  constructor(private readonly send: (text: string, channel: 0 | 1 | 2 | 3 | 5, targetName?: string) => Promise<void>,
    private readonly releaseKeys: () => void, readonly family: Family,
    subscribeAccountContext: (listener: () => void) => () => void) {
    this.unsubscribeAccountContext = subscribeAccountContext(() => this.resetSession());
  }

  readonly getSnapshot = (): BattleChatSnapshot => this.state;
  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {this.listeners.delete(listener);};
  };
  private update(next: Partial<BattleChatSnapshot>): void {
    this.state = {...this.state, ...next};
    for (const listener of this.listeners) listener();
  }
  dispose(): void {
    this.unsubscribeAccountContext();
    this.family.dispose();
  }
  releaseInputKeys(): void {this.releaseKeys();}
  setDraft(draft: string): void {this.update({draft});}
  setTargetName(targetName: string): void {if (!this.state.pending) this.update({targetName});}
  setStatus(status: string): void {this.update({status});}
  setChannel(channel: 0 | 1 | 2 | 3 | 5): void {
    if (this.state.pending) return;
    this.update({channel});
    if (channel === 5) void this.family.refresh();
  }
  /** Opens the editor when the battle source layout is the active presentation. */
  openEditor(): void {
    if (!this.state.visible || !this.state.sourceActive || this.state.editing) return;
    this.cancelNotice();
    this.update({editing: true, status: '', noticePhase: 'hidden'});
  }
  /** Leaves edit mode but preserves the draft; used by Esc and by confirmed sends. */
  closeEditor(): void {if (this.state.editing) this.update({editing: false});}
  /** Clears any transient incoming-message notice and its timers. */
  cancelNotice(): void {
    if (this.noticeTimer !== undefined) {clearTimeout(this.noticeTimer); this.noticeTimer = undefined;}
    if (this.state.noticePhase !== 'hidden') this.update({noticePhase: 'hidden'});
  }
  /** Stops pending notice timers without notifying listeners; used on view teardown. */
  cancelNoticeTimer(): void {
    if (this.noticeTimer !== undefined) {clearTimeout(this.noticeTimer); this.noticeTimer = undefined;}
  }
  setPhase(phase: string): void {
    const sourceActive = phase === 'PLAYING' || phase === 'FINISHED';
    if (phase === this.state.phase && sourceActive === this.state.sourceActive) return;
    if (!sourceActive) this.cancelNotice();
    this.update({phase, sourceActive, ...(sourceActive ? {} : {editing: false, noticePhase: 'hidden' as const})});
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
      this.update({status: '', editing: false, confirmedSends: this.state.confirmedSends + 1,
        ...(clearDraft && this.state.draft.trim() === text ? {draft: ''} : {})});
      // A confirmed send closes compose; surface the acknowledged message as a notice.
      if (this.state.sourceActive) this.startNotice();
    }).catch(error => {
      if (generation === this.state.generation) this.update({status: String(error)});
    }).finally(() => {
      if (generation === this.state.generation) this.update({pending: false});
    });
  }
  receivedPrivate(text: string): void {if (this.state.visible) this.message(text);}
  receivedFamily(message: MsgFamilyChat): void {
    if (!this.state.visible) return;
    const key = `${message.familyId}:${message.id}`;
    if (this.familyMessageIds.has(key)) return;
    this.familyMessageIds.add(key);
    this.message(message.message);
  }
  resetSession(): void {
    this.cancelNotice();
    this.familyMessageIds.clear();
    this.nextMessage = 0;
    this.update({editing: false, noticePhase: 'hidden', messages: [], draft: '', targetName: '',
      pending: false, status: '', generation: this.state.generation + 1});
  }
  show(): void {this.update({visible: true});}
  message(text: string): void {
    this.update({messages: [...this.state.messages, {id: ++this.nextMessage, text}].slice(-50)});
    if (this.state.sourceActive && !this.state.editing) this.startNotice();
  }
  /** Confirmed-message frame: full opacity, then a short blur fade to hidden. */
  private startNotice(): void {
    if (this.noticeTimer !== undefined) clearTimeout(this.noticeTimer);
    this.update({noticePhase: 'full'});
    this.noticeTimer = setTimeout(() => {
      this.noticeTimer = undefined;
      if (!this.state.sourceActive || this.state.editing) return;
      this.update({noticePhase: 'fading'});
      this.noticeTimer = setTimeout(() => {
        this.noticeTimer = undefined;
        if (!this.state.sourceActive || this.state.editing) return;
        this.update({noticePhase: 'hidden'});
      }, CHAT_NOTICE_FADE_MS);
    }, CHAT_NOTICE_FULL_MS);
  }
  clear(): void {
    this.cancelNotice();
    this.familyMessageIds.clear();
    this.nextMessage = 0;
    this.update({visible: false, phase: '', sourceActive: false, editing: false, noticePhase: 'hidden',
      confirmedSends: 0, players: [], messages: [], draft: '', targetName: '', channel: 0,
      status: '', pending: false, generation: this.state.generation + 1});
  }
}
