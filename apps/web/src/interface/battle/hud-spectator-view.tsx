import './hud-spectator-view.css';
import {useMemo, useSyncExternalStore} from 'react';
import {SourceButton} from '../resources/source-button';
import {HomeSourceLayout} from '../resources/source-ui-layout';
import {sourcePicture} from './hud-source-controls';
import type {BattleHud, SourceUi} from './battle-hud';

export function HudSpectatorView({hud, data}: {hud: BattleHud; data: SourceUi}) {
  const state = useSyncExternalStore(hud.spectator.subscribe, hud.spectator.getSnapshot);
  const ui = useMemo(() => ({layouts: data.layouts, imagesets: data.imagesets.map(set => ({
    ...set, attributes: {Name: set.attributes.Name},
  }))}), [data]);
  const layout = useMemo(() => new HomeSourceLayout(ui, 'roomlist.xml'), [ui]);
  if (!state.active) return null;
  const player = state.players.find(value => value.id === state.playerId);
  const panel = data.layouts.find(value => value.path === 'ui/layouts/game_main.xml')
    ?.windows.find(value => value.name === 'picBattleInfoPanel');
  return <section className="hud-spectator" aria-label="友军观战"
    style={sourcePicture(data, panel?.properties.Image)}
    onKeyDown={event => event.stopPropagation()} onKeyUp={event => event.stopPropagation()}>
    <SourceButton ui={ui} layout={layout} suffix="roomlist.xml" source="btnPageUp"
      style={{left: 6, top: 8, width: 26, height: 37}}
      aria-label="观战上一位友军" title="上一位友军" disabled={state.players.length < 2}
      onClick={() => hud.spectator.switchPlayer(-1)} />
    <span className="hud-spectator-name" data-dynamic-font="xiangjiao-brush" aria-live="polite" title={player?.name}>
      {player ? `观战：${player.name}` : '暂无存活友军'}
    </span>
    <SourceButton ui={ui} layout={layout} suffix="roomlist.xml" source="btnPageDown"
      style={{left: 264, top: 8, width: 26, height: 37}}
      aria-label="观战下一位友军" title="下一位友军" disabled={state.players.length < 2}
      onClick={() => hud.spectator.switchPlayer(1)} />
  </section>;
}
