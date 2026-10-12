import './battle-scoreboard-view.css';
import {useEffect, useState, useSyncExternalStore} from 'react';
import {useSourceUi} from '../lobby/source-react';
import {HomeSourceLayout} from '../resources/source-ui-layout';
import {BattleScoreSheet, BattleScorePlayerRow} from './battle-score-sheet';
import type {BattleHud} from './battle-hud';
import type {ScoreboardPlayer, ScoreboardSnapshot} from './battle-scoreboard';
import {bindingCodes, keyLabel, type KeyBindings} from '../../match/input-bindings';

const SUFFIX = 'game_summary.xml';
const SCOREBOARD_COLUMNS = {
  name: {left: 68, width: 158},
  score: {left: 228, width: 48},
  metric: {left: 284, width: 60},
  last: {left: 346, width: 38},
} as const;

export function BattleScoreboardView({hud, bindings}: {hud: BattleHud; bindings: KeyBindings}) {
  const state = useSyncExternalStore(hud.scoreboard.subscribe, hud.scoreboard.getSnapshot);
  return state ? <Scoreboard key={`${state.roomId}:${state.round}`} state={state} bindings={bindings}/> : null;
}

function Scoreboard({state, bindings}: {state: ScoreboardSnapshot; bindings: KeyBindings}) {
  const [held, setHeld] = useState(false);
  const [page, setPage] = useState(0);
  const [scale, setScale] = useState(() => Math.min(innerWidth / 800, innerHeight / 600));
  const {ui, error} = useSourceUi(true, [SUFFIX]);
  useEffect(() => {
    const codes = bindingCodes(bindings, 'scoreboard');
    const pressed = new Set<string>();
    const down = (event: KeyboardEvent) => {
      if (!codes.includes(event.code)) return;
      if ((event.ctrlKey && event.code !== 'ControlLeft' && event.code !== 'ControlRight')
          || event.altKey || event.metaKey || event.shiftKey || event.isComposing || event.repeat) return;
      if (document.querySelector('dialog[open]') || (event.target instanceof HTMLElement
          && (event.target.closest('input, select, button, textarea') || event.target.isContentEditable))) return;
      event.preventDefault();
      pressed.add(event.code);
      setHeld(true);
    };
    const up = (event: KeyboardEvent) => {
      if (pressed.delete(event.code)) setHeld(pressed.size > 0);
    };
    const hide = () => {pressed.clear(); setHeld(false);};
    hide();
    const visibility = () => {if (document.hidden) hide();};
    const resize = () => setScale(Math.min(innerWidth / 800, innerHeight / 600));
    window.addEventListener('keydown', down, true);
    window.addEventListener('keyup', up, true);
    window.addEventListener('blur', hide);
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.removeEventListener('keydown', down, true);
      window.removeEventListener('keyup', up, true);
      window.removeEventListener('blur', hide);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [bindings]);

  const individual = state.mode > 3;
  const ranked = [...state.players].sort((left, right) => {
    const primary = state.mode === 4 ? right.kills - left.kills
      : state.mode === 5 ? right.objectivesDestroyed - left.objectivesDestroyed : right.score - left.score;
    return primary || right.score - left.score || right.kills - left.kills || left.deaths - right.deaths;
  });
  const teams = [0, 1].map(team => ranked.filter(player => player.team === team));
  const pages = Math.max(1, individual ? Math.ceil(ranked.length / 12)
    : Math.max(...teams.map(players => Math.ceil(players.length / 6))));
  const currentPage = Math.min(page, pages - 1);
  const layout = ui ? new HomeSourceLayout(ui, SUFFIX) : undefined;
  const stats = (player: ScoreboardPlayer) =>
    `击毁 ${player.kills} · 死亡 ${player.deaths}${state.mode === 5 ? ` · 目标 ${player.objectivesDestroyed}` : ''}`;
  if (!held) return null;
  return <section className="battle-scoreboard-viewport" aria-label="战斗计分板" data-battle-scoreboard=""
    data-scoreboard-round={state.round} data-scoreboard-mode={state.mode}>
    <div className="battle-scoreboard-stage battle-score-sheet-stage" style={{zoom: scale}} aria-busy={!ui}>
      {ui && <BattleScoreSheet ui={ui} layout={layout!} columns={SCOREBOARD_COLUMNS}
        individual={individual} headers={{
          metric: {control: 'DestroyTank', label: state.mode === 5 ? '摧毁物件数' : '击毁坦克数'}, last: '死亡',
        }}>
        {(['Cat', 'Dog'] as const).flatMap((side, team) => {
          const players = individual ? ranked.slice(currentPage * 12 + team * 6, currentPage * 12 + team * 6 + 6)
            : teams[team].slice(currentPage * 6, currentPage * 6 + 6);
          return players.map((player, row) => {
            const name = `${side}Player${row}`;
            const self = player.id === state.playerId;
            return <BattleScorePlayerRow key={player.id} ui={ui} layout={layout!}
              columns={SCOREBOARD_COLUMNS} source={name} self={self} name={player.name}
              portrait={player.petId !== undefined
                ? {petId: player.petId, outcome: player.alive ? 'WIN' : 'LOSE', frame: 1} : undefined}
              score={<span data-scoreboard-score={player.score}>{Math.trunc(player.score)}</span>}
              metric={<span data-scoreboard-kills={player.kills} data-scoreboard-objectives={player.objectivesDestroyed}>
                {state.mode === 5 ? player.objectivesDestroyed : player.kills}
              </span>}
              last={<span data-scoreboard-deaths={player.deaths}>{player.deaths}</span>}
              className="battle-scoreboard-row"
              data-scoreboard-player={player.id} data-scoreboard-self={self || undefined}
              data-scoreboard-alive={player.alive} aria-label={`${player.name}，得分 ${player.score}，${stats(player)}`}/>;
          });
        })}
      </BattleScoreSheet>}
      <h1 className="battle-scoreboard-title">{individual ? '个人计分板' : '战斗计分板'}</h1>
      <p className="battle-scoreboard-subtitle">第 <span className="battle-pixel-number">{state.round}</span> 局 · 实时战况</p>
      <p className="battle-scoreboard-hint">{error || (!ui ? '正在载入计分板…'
        : `按住 ${bindingCodes(bindings, 'scoreboard').map(keyLabel).join(' / ')} 查看 · 松开返回战斗`)}</p>
      {pages > 1 && <nav className="battle-scoreboard-pagination" aria-label="计分板分页"
        onPointerDown={event => event.preventDefault()}>
        <button type="button" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>上一页</button>
        <span className="battle-pixel-number">{currentPage + 1}/{pages}</span>
        <button type="button" disabled={currentPage + 1 === pages} onClick={() => setPage(currentPage + 1)}>下一页</button>
      </nav>}
    </div>
  </section>;
}
