import {useSyncExternalStore} from 'react';
import './match.css';
import type {MsgRoomSnapshot, ResultPlayer} from '../../../../shared/protocols';
import {WaitingRoomView} from '../lobby/waiting-room';
import {CpuLoadoutView} from '../lobby/cpu-loadout';
import type {CpuLoadoutItem} from '../../../../shared/protocols/PtlCpu';
import {BattlePlayPage} from './battle-play-page';
import {BattleSummaryPage} from './battle-summary-page';
import type {WaitingRoomActions} from '../lobby/waiting-room';

interface MatchPlayer {
  id: string;
  name: string;
  team: number;
  isCpu: boolean;
  isAutopilot: boolean;
  ready: boolean;
}

interface MatchViewState {
  phase: string;
  round: number;
  playerId: string;
  mode: number;
  title: string;
  objective: string;
  status: string;
  pending: boolean;
  ready: boolean;
  readyAvailable: boolean;
  team?: number;
  isAutopilot: boolean;
  canManageCpu: boolean;
  hasLocalPlayer: boolean;
  voted: boolean;
  players: MatchPlayer[];
  results: ResultPlayer[];
  boosts: {kind: string; text: string}[];
  ammoSlots: {slot: number; itemTableId: number; quantity: number}[];
  waiting?: MsgRoomSnapshot;
}

/** Network snapshots publish only the match controls' semantic presentation. */
export class BattleMatch {
  private state?: MatchViewState;
  private readonly listeners = new Set<() => void>();
  private key = '';
  private context = '';
  private generation = 0;
  private pending = false;
  private requestStatus = '';
  private defaultStatus = '';
  private targetSecond = -1;
  private direction = '';
  private readyAvailable = false;

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {this.listeners.delete(listener);};
  };
  readonly getSnapshot = (): MatchViewState | undefined => this.state;

  readonly waitingActions: WaitingRoomActions = {
    ready: isReady => this.request(() => this.ready(isReady), '正在提交准备状态…'),
    team: team => this.request(() => this.changeTeam(team), '正在换队…'),
    leave: () => this.request(async () => {
      if (!this.leave) throw new Error('退出入口不可用');
      await this.leave();
    }, '正在退出房间…'),
    invite: () => this.request(async () => {
      if (!this.invite) throw new Error('邀请入口不可用');
      return this.invite();
    }, '正在发送邀请…'),
  };

  constructor(private readonly rematch: () => Promise<void>,
              private readonly ready: (isReady: boolean) => Promise<void>,
              private readonly changeTeam: (team: number) => Promise<void>,
              private readonly cpu?: (operation: 'ADD' | 'REMOVE', playerId?: string) => Promise<void>,
              private readonly autopilot?: (enabled: boolean) => Promise<void>,
              private readonly leave?: () => Promise<void>,
              private readonly invite?: () => Promise<number>,
              private readonly configureCpu?: (playerId: string, loadout: CpuLoadoutItem[]) => Promise<void>) {}

  get supportsCpu(): boolean {return !!this.cpu;}
  get supportsCpuLoadout(): boolean {return !!this.configureCpu;}
  configureCpuLoadout(playerId: string, loadout: CpuLoadoutItem[]): Promise<void> {
    return this.request(async () => {
      if (!this.configureCpu) throw new Error('CPU配置入口不可用');
      await this.configureCpu(playerId, loadout);
    }, '正在确认CPU配给…');
  }
  get supportsAutopilot(): boolean {return !!this.autopilot;}

  requestReady(): void {
    if (!this.state || !this.state.readyAvailable) return;
    this.run(() => this.waitingActions.ready(!this.state!.ready));
  }

  requestTeam(team: number): void {this.run(() => this.waitingActions.team(team));}

  requestCpu(operation: 'ADD' | 'REMOVE', playerId?: string): void {
    if (this.cpu) this.run(() => this.request(() => this.cpu!(operation, playerId), '正在更新CPU…'));
  }

  requestAutopilot(): void {
    if (this.autopilot && this.state) {
      const enabled = !this.state.isAutopilot;
      this.run(() => this.request(() => this.autopilot!(enabled), '正在切换AI托管…'));
    }
  }

  requestRematch(): void {this.run(() => this.request(this.rematch, '正在提交再战请求…'));}

  requestLeave(): void {this.run(() => this.waitingActions.leave());}

  setReadyAvailable(available: boolean): void {
    if (this.readyAvailable === available) return;
    this.readyAvailable = available;
    if (this.state) this.publish({...this.state, readyAvailable: available});
  }

  update(snapshot: MsgRoomSnapshot, playerId: string): void {
    const match = snapshot.match;
    if (!match) {this.clear(); return;}
    const context = `${snapshot.roomId}:${match.round}:${snapshot.phase}:${playerId}`;
    if (this.context !== context) {
      this.context = context;
      this.generation++;
      this.pending = false;
      this.requestStatus = '';
      this.targetSecond = -1;
      this.direction = '';
    }
    const local = snapshot.players.find(player => player.id === playerId);
    const ready = match.readyPlayerIds.includes(playerId);
    const waiting = snapshot.phase === 'WAITING';
    let title = `第 ${match.round} 局 · ${snapshot.mode <= 3 ? local?.team === 0 ? '猫队' : '狗队' : '个人战'}`;
    let objective = '';
    let status = '';
    if (waiting) {
      title = `第 ${match.round} 局 · 等待开战`;
      objective = `准备完成 ${match.readyPlayerIds.length}/${snapshot.players.length} 人。至少 ${match.minPlayers} 人${match.maxPlayers === undefined ? '' : `，容量 ${match.maxPlayers} 人`}，所有人主动准备后开战。${snapshot.mode <= 3 ? `友伤${match.friendlyFire ? '开启' : '关闭'}。` : ''}`;
      if (snapshot.mode <= 3) status = ready ? '取消准备后可换队。' : '换队后全员需重新准备，猫狗两队都有人才能开局。';
    } else {
      const second = Math.floor(snapshot.serverTime / 1000);
      if (second !== this.targetSecond) {
        this.targetSecond = second;
        this.direction = this.targetDirection(snapshot, playerId);
      }
      switch (snapshot.mode) {
        case 1:
          objective = `击毁敌方消耗出击次数。猫队 ${match.teamLives[0]} · 狗队 ${match.teamLives[1]}；先耗尽的一方落败。`;
          break;
        case 2:
          objective = `驶入占领圈，独占累计 ${match.targetScore} 秒获胜。猫队 ${snapshot.teamScores[0].toFixed(1)} · 狗队 ${snapshot.teamScores[1].toFixed(1)}；双方进入时暂停计时。${this.direction}`;
          break;
        case 3:
          objective = `保护本队的王，击毁敌方的王获胜。${snapshot.players.filter(player => player.isVIP).map(player => `${player.team === 0 ? '猫队' : '狗队'}王 ${player.name} ${player.hp}/${player.maxHp}`).join(' · ')}`;
          break;
        case 4:
          objective = `每人独立作战，先击毁 ${match.targetScore} 辆获胜；时间到时比较击毁数与战斗得分。`;
          break;
        case 5:
          objective = `射击场景物件，摧毁最多者获胜。剩余 ${match.objectives.filter(value => value.hp > 0).length}/${match.objectives.length}；你的摧毁数 ${local?.objectivesDestroyed ?? 0}。${this.direction}`;
          break;
      }
    }
    const result = snapshot.phase === 'FINISHED' ? match.result : undefined;
    if (result) {
      const own = result.players.find(player => player.id === playerId);
      const outcomes = {WIN: '胜利', LOSE: '失败', DRAW: '平局'};
      title = `第 ${result.round} 局 · ${own ? outcomes[own.outcome] : '对局结束'}`;
      const winner = result.winnerPlayerId
        ? result.players.find(player => player.id === result.winnerPlayerId)?.name
        : result.winnerTeam < 0 ? '平局' : result.winnerTeam === 0 ? '猫队' : '狗队';
      const reasons = {TIME_LIMIT: '时间结束', OBJECTIVE: '目标达成', FORFEIT: '对手离开'};
      objective = `${reasons[result.reason]} · ${winner}${winner === '平局' ? '' : '获胜'}`;
      status = `再战确认 ${match.rematchPlayerIds.length}/${snapshot.players.length} 人。所有在房玩家同意且达到开局人数（${match.minPlayers} 人）时开始下一局。`;
    }
    const boosts: MatchViewState['boosts'] = [];
    const seconds = (expiresAt: number): number => Math.max(0, Math.ceil((expiresAt - snapshot.serverTime) / 1000));
    if (snapshot.phase === 'PLAYING' && local) {
      if (local.attackBoost) boosts.push({kind: 'attack', text: `攻击提升 ${local.attackBoost.attackPercent}% · 额外火力 ${local.attackBoost.attackBonus} · 剩余 ${seconds(local.attackBoost.expiresAt)} 秒`});
      if (local.defenseBoost) boosts.push({kind: 'defense', text: `防御提升 · 剩余 ${seconds(local.defenseBoost.expiresAt)} 秒`});
      if (local.invincibility) boosts.push({kind: 'invincibility', text: `无敌 · 剩余 ${seconds(local.invincibility.expiresAt)} 秒`});
      if (local.speedBoost) boosts.push({kind: 'speed', text: `速度提升 · 剩余 ${seconds(local.speedBoost.expiresAt)} 秒`});
      if (local.turnBoost) boosts.push({kind: 'turn', text: `回旋提升 · 剩余 ${seconds(local.turnBoost.expiresAt)} 秒`});
    }
    // The waiting view needs room metadata and roster, never simulation coordinates.
    const waitingSnapshot: MsgRoomSnapshot | undefined = waiting ? {
      roomId: snapshot.roomId, roomInfo: snapshot.roomInfo, mode: snapshot.mode,
      phase: snapshot.phase, serverTime: 0, tick: 0, remaining: 0, bullets: [], teamScores: [], winnerTeam: -1,
      players: snapshot.players.map(player => ({
        id: player.id, name: player.name, team: player.team, tankId: player.tankId,
        x: 0, y: 0, z: 0, yaw: 0, aim: 0, hp: 0, maxHp: 0, alive: true,
        score: 0, kills: 0, deaths: 0, respawnAt: 0, isVIP: false,
        isCpu: player.isCpu, isAutopilot: player.isAutopilot,
        cpuLoadout: player.cpuLoadout?.map(item => ({...item})),
      })),
      match: {round: match.round, readyPlayerIds: [...match.readyPlayerIds], rematchPlayerIds: [],
        minPlayers: match.minPlayers, maxPlayers: match.maxPlayers, friendlyFire: match.friendlyFire,
        targetScore: match.targetScore, teamLives: [], objectives: [], cpuManagerId: match.cpuManagerId},
    } : undefined;
    this.defaultStatus = status;
    this.publish({phase: snapshot.phase, round: match.round, playerId, mode: snapshot.mode,
      title, objective, status, pending: this.pending, ready, readyAvailable: this.readyAvailable, team: local?.team,
      ammoSlots: local?.ammoSlots?.map(slot => ({...slot})) ?? [],
      isAutopilot: !!local?.isAutopilot, canManageCpu: match.cpuManagerId === playerId,
      hasLocalPlayer: !!local, voted: match.rematchPlayerIds.includes(playerId),
      players: waiting ? snapshot.players.map(player => ({id: player.id, name: player.name, team: player.team,
        isCpu: !!player.isCpu, isAutopilot: !!player.isAutopilot, ready: match.readyPlayerIds.includes(player.id)})) : [],
      results: result?.players.map(player => ({...player})) ?? [], boosts, waiting: waitingSnapshot});
  }

  private publish(state?: MatchViewState): void {
    const key = JSON.stringify([state, this.requestStatus]);
    if (key === this.key) return;
    this.key = key;
    this.state = state ? {...state, status: this.requestStatus || state.status} : undefined;
    this.listeners.forEach(listener => listener());
  }

  private refreshRequest(): void {
    if (!this.state) return;
    this.key = '';
    this.publish({...this.state, status: this.defaultStatus, pending: this.pending});
  }

  private async request<T>(action: () => Promise<T>, status: string): Promise<T> {
    if (this.pending) throw new Error('请等待上一请求完成');
    const generation = this.generation;
    this.pending = true;
    this.requestStatus = status;
    this.refreshRequest();
    try {
      const value = await action();
      if (generation === this.generation) this.requestStatus = '';
      return value;
    } catch (error) {
      if (generation === this.generation) this.requestStatus = error instanceof Error ? error.message : String(error);
      throw error;
    } finally {
      if (generation === this.generation) {this.pending = false; this.refreshRequest();}
    }
  }

  private run(action: () => Promise<unknown>): void {
    if (this.pending) return;
    void action().catch(() => {});
  }

  private targetDirection(snapshot: MsgRoomSnapshot, playerId: string): string {
    const player = snapshot.players.find(value => value.id === playerId);
    const targets = snapshot.match!.objectives.filter(value => value.kind === 'CAPTURE' || value.hp > 0);
    if (!player || !targets.length) return '';
    const distance = (target: {x: number; z: number}): number => Math.hypot(target.x - player.x, target.z - player.z);
    const target = [...targets].sort((a, b) => distance(a) - distance(b))[0];
    const angle = Math.atan2(target.x - player.x, target.z - player.z) - player.yaw;
    const turn = Math.atan2(Math.sin(angle), Math.cos(angle));
    return `最近目标 ${target.id} 距离 ${Math.round(distance(target))}，${Math.abs(turn) < 0.2 ? '在正前方' : turn > 0 ? '向右转' : '向左转'}。`;
  }

  clear(): void {
    this.readyAvailable = false;
    this.generation++;
    this.context = '';
    this.defaultStatus = '';
    this.pending = false;
    this.requestStatus = '';
    this.targetSecond = -1;
    this.direction = '';
    this.publish();
  }
}

export function BattleMatchView({panel, validation = false}: {panel: BattleMatch; validation?: boolean}) {
  const state = useSyncExternalStore(panel.subscribe, panel.getSnapshot, panel.getSnapshot);
  if (!state) return null;
  const waiting = state.phase === 'WAITING';
  const finished = state.phase === 'FINISHED';
  if (finished && !validation) return <section data-match-panel="" data-phase={state.phase}
    data-round={state.round} aria-label="对局结算">
    <BattleSummaryPage results={state.results} playerId={state.playerId} round={state.round} mode={state.mode}
      title={state.title} objective={state.objective} status={state.status} pending={state.pending}
      voted={state.voted} hasLocalPlayer={state.hasLocalPlayer}
      requestRematch={() => panel.requestRematch()} leave={() => panel.requestLeave()} />
  </section>;
  if (waiting && !validation) return <section data-match-panel="" data-phase={state.phase}
    data-round={state.round} data-formal-waiting-page="" aria-label="等待房间">
    {state.waiting && <WaitingRoomView formal key={`${state.waiting.roomId}:${state.round}`} snapshot={state.waiting}
      playerId={state.playerId} externalBusy={state.pending} readyAvailable={state.readyAvailable} actions={panel.waitingActions}
      management={<>
        {panel.supportsCpu && state.canManageCpu && <button type="button" data-add-cpu=""
          disabled={state.pending} onClick={() => panel.requestCpu('ADD')}>添加 CPU</button>}
        {state.canManageCpu && panel.supportsCpu && state.waiting?.players.filter(player => player.isCpu).map(player =>
          <div key={player.id}>
            <button type="button" data-remove-cpu={player.id} disabled={state.pending}
              onClick={() => panel.requestCpu('REMOVE', player.id)}>移除 {player.name}</button>
            {panel.supportsCpuLoadout && <CpuLoadoutView player={player} busy={state.pending}
              configure={loadout => panel.configureCpuLoadout(player.id, loadout)}/>}
          </div>)}
        {panel.supportsAutopilot && state.hasLocalPlayer && <button type="button" data-autopilot=""
          disabled={state.pending} aria-pressed={state.isAutopilot}
          title="AI自动移动、开火和使用你已配置的道具；使用会消耗你的库存"
          onClick={() => panel.requestAutopilot()}>{state.isAutopilot ? '结束托管，自己操作' : 'AI托管我的战车'}</button>}
        <output data-waiting-management-status="" role="status">{state.readyAvailable ? state.status : '载入地图和战车…'}</output>
      </>}/>} 
  </section>;
  if (state.phase === 'PLAYING' && !validation) return <BattlePlayPage round={state.round}
    busy={state.pending} canLeave={state.hasLocalPlayer} leave={() => {void panel.waitingActions.leave();}}
    feedback={<>
      {state.ammoSlots.length > 0 && <p data-ammo-stock="" aria-label="本局特殊弹药">
        {state.ammoSlots.map(slot => <span key={slot.slot} data-ammo-slot={slot.slot}
          data-ammo-item={slot.itemTableId} data-ammo-quantity={slot.quantity}>槽{slot.slot}：{slot.quantity}发{' '}</span>)}
      </p>}
      {state.boosts.map(boost => <p key={boost.kind}
        {...{[boost.kind === 'invincibility' ? 'data-invincibility-status' : `data-${boost.kind}-boost-status`]: ''}}>{boost.text}</p>)}
    </>}>
    <h2>{state.title}</h2>
    <p>{state.objective}</p>
    {panel.supportsAutopilot && state.hasLocalPlayer && <button type="button" data-autopilot=""
      disabled={state.pending} aria-pressed={state.isAutopilot}
      title="AI自动移动、开火和使用你已配置的道具；使用会消耗你的库存"
      onClick={() => panel.requestAutopilot()}>{state.isAutopilot ? '结束托管，自己操作' : 'AI托管我的战车'}</button>}
    <p role="status">{state.status}</p>
  </BattlePlayPage>;
  return <section className={`battle-match${finished ? ' match-finished' : ''}`} data-match-panel=""
    data-phase={state.phase} data-round={state.round} aria-label="对局目标与结算">
    {state.waiting && <WaitingRoomView key={`${state.waiting.roomId}:${state.round}`} snapshot={state.waiting}
      playerId={state.playerId} externalBusy={state.pending} readyAvailable={state.readyAvailable} actions={panel.waitingActions} />}
    {waiting && <button type="button" data-ready="" disabled={state.pending || !state.hasLocalPlayer || !state.readyAvailable}
      onClick={() => panel.requestReady()}>{state.ready ? '取消准备' : '准备'}</button>}
    {waiting && panel.supportsCpu && state.canManageCpu && <button type="button" data-add-cpu=""
      disabled={state.pending} onClick={() => panel.requestCpu('ADD')}>添加 CPU</button>}
    {panel.supportsAutopilot && state.hasLocalPlayer && <button type="button" data-autopilot=""
      disabled={state.pending} aria-pressed={state.isAutopilot}
      title="AI自动移动、开火和使用你已配置的道具；使用会消耗你的库存"
      onClick={() => panel.requestAutopilot()}>{state.isAutopilot ? '结束托管，自己操作' : 'AI托管我的战车'}</button>}
    {waiting && state.mode <= 3 && <div>{['猫队', '狗队'].map((name, team) =>
      <button key={team} type="button" data-change-team={team} disabled={state.pending || state.ready || state.team === team || !state.hasLocalPlayer}
        aria-pressed={state.team === team} onClick={() => panel.requestTeam(team)}>加入{name}</button>)}</div>}
    {waiting && <ul data-waiting-roster="">{state.players.map(player => <li key={player.id}
      data-waiting-player={player.id} data-team={player.team}>
      {state.mode <= 3 ? player.team === 0 ? '猫队' : '狗队' : '个人战'} · {player.name}{player.id === state.playerId ? '（你）' : ''}{player.isAutopilot ? ' · AI托管' : ''} · {player.ready ? '已准备' : '未准备'}
      {player.isCpu && panel.supportsCpu && state.canManageCpu && <button type="button" data-remove-cpu={player.id}
        disabled={state.pending} onClick={() => panel.requestCpu('REMOVE', player.id)}>移除 CPU</button>}
    </li>)}</ul>}
    {!waiting && <button type="button" data-leave-room disabled={state.pending || !state.hasLocalPlayer}
      onClick={() => {void panel.waitingActions.leave();}}>离开房间</button>}
    <h2>{state.title}</h2>
    <p>{state.objective}</p>
    {!waiting && state.ammoSlots.length > 0 && <p data-ammo-stock="" aria-label="本局特殊弹药">
      {state.ammoSlots.map(slot => <span key={slot.slot} data-ammo-slot={slot.slot}
        data-ammo-item={slot.itemTableId} data-ammo-quantity={slot.quantity}>
        槽{slot.slot}：{slot.quantity}发{' '}
      </span>)}
    </p>}
    {state.boosts.map(boost => <p key={boost.kind} {...{[boost.kind === 'invincibility' ? 'data-invincibility-status' : `data-${boost.kind}-boost-status`]: ''}}>{boost.text}</p>)}
    {finished && <div><table data-result-table=""><caption>本局成绩</caption>
      <thead><tr>{['名次', '玩家', '击毁/阵亡', '目标', '战斗分', '胜负分', '合计'].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead>
      <tbody>{state.results.map(player => <tr key={player.id} data-result-player={player.id} className={player.id === state.playerId ? 'match-self' : undefined}>
        <td>{player.rank}</td><td>{player.name}</td><td>{player.kills}/{player.deaths}</td>
        <td>{player.objectivesDestroyed}</td><td>{player.combatScore}</td><td>{player.outcomeBonus}</td><td>{player.totalScore}</td>
      </tr>)}</tbody>
    </table></div>}
    {finished && <button type="button" data-rematch="" disabled={state.pending || state.voted}
      onClick={() => panel.requestRematch()}>{state.voted ? '已同意再战' : '再来一局'}</button>}
    <p role="status">{state.status}</p>
  </section>;
}
