import './hud-spectator-view.css';
import {useSyncExternalStore} from 'react';
import {BattleArrowButton, BattleWoodPanel} from './battle-hud-artwork';
import type {BattleHud} from './battle-hud';

export function HudSpectatorView({hud}: {hud: BattleHud}) {
  const state = useSyncExternalStore(hud.spectator.subscribe, hud.spectator.getSnapshot);
  if (!state.active) return null;
  const player = state.players.find(value => value.id === state.playerId);
  return <BattleWoodPanel kind="spectator" className="hud-spectator" role="group" aria-label="友军观战"
    onKeyDown={event => event.stopPropagation()} onKeyUp={event => event.stopPropagation()}>
    <BattleArrowButton direction="left" style={{left: 8}}
      aria-label="观战上一位友军" title="上一位友军" disabled={state.players.length < 2}
      onClick={() => hud.spectator.switchPlayer(-1)}/>
    <span className="hud-spectator-name" aria-live="polite" title={player?.name}>
      {player ? `观战：${player.name}` : '暂无存活友军'}
    </span>
    <BattleArrowButton direction="right" style={{right: 8}}
      aria-label="观战下一位友军" title="下一位友军" disabled={state.players.length < 2}
      onClick={() => hud.spectator.switchPlayer(1)}/>
  </BattleWoodPanel>;
}
