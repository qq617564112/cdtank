import {GameMessage} from '../resources/game-message';
import {GameSelectionHighlight} from '../resources/game-selection-highlight';
import {SourceFeedbackText} from '../resources/source-feedback-text';
import './lobby-player-list.css';
import {GameScrollbar} from '../resources/game-scrollbar';
import {useEffect, useRef, useState, type KeyboardEvent} from 'react';
import {HomeSourceLayout} from '../resources/source-ui-layout';
import {loadUiFont} from '../resources/source-ui-fonts';
import {sourceProps, useSourceUi} from './source-react';
import {playButtonSound} from '../../audio/button-sound';
import {isMobileDevice} from '../../platform/device';

interface LobbyPlayerListProps {
  players: readonly {accountId: string; name: string}[];
  status: string;
  openPlayer?: (player: {accountId: string; name: string}) => void;
  chooseTarget?: (player: {accountId: string; name: string}) => void;
}

/** Account identities remain authoritative; selection only marks a local list row. */
export function LobbyPlayerListView({players, status, chooseTarget, openPlayer}: LobbyPlayerListProps) {
  const {ui, error} = useSourceUi(true, ['playerlist.xml']);
  const [selected, setSelected] = useState('');
  const [fontReady, setFontReady] = useState(false);
  const list = useRef<HTMLUListElement>(null);
  useEffect(() => {
    if (selected && !players.some(player => player.accountId === selected)) setSelected('');
  }, [players, selected]);
  useEffect(() => {
    let live = true;
    void loadUiFont().then(() => {if (live) setFontReady(true);}).catch(() => {});
    return () => {live = false;};
  }, []);
  const selectedId = players.some(player => player.accountId === selected) ? selected : '';
  const layout = ui ? new HomeSourceLayout(ui, 'playerlist.xml') : undefined;
  const props = layout ? sourceProps(ui!, layout, 'playerlist.xml', 'PlayerList') : undefined;
  function move(event: KeyboardEvent<HTMLButtonElement>, index: number): void {
    if (event.key === 'F10' && event.shiftKey) {event.preventDefault(); event.stopPropagation(); openPlayer?.(players[index]); return;}
    if (event.key === 'Enter') {
      event.preventDefault(); event.stopPropagation();
      if (chooseTarget) {playButtonSound(); chooseTarget(players[index]);}
      return;
    }
    const next = event.key === 'ArrowDown' ? index + 1 : event.key === 'ArrowUp' ? index - 1
      : event.key === 'Home' ? 0 : event.key === 'End' ? players.length - 1 : -1;
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.stopPropagation();
    event.preventDefault();
    if (next < 0) return;
    const player = players[Math.min(next, players.length - 1)];
    if (!player) return;
    setSelected(player.accountId);
    const button = list.current?.querySelector<HTMLButtonElement>(`[data-lobby-player-index="${Math.min(next, players.length - 1)}"]`);
    button?.focus(); button?.scrollIntoView({block: 'nearest'});
  }
  return <div {...props} className="lobby-player-scroll-shell"
    style={{...props?.style, height: 'var(--lobby-player-list-height, 393px)'}}><ul ref={list} className="lobby-player-list" data-lobby-player-list=""
    data-source-font="xiangjiao-brush" data-source-font-provider="web-ttf" data-source-font-ready={fontReady}
    role="listbox" aria-label="大厅玩家列表" aria-busy={!ui} title={error || status || undefined}>
    {players.map((player, index) => <li key={player.accountId} role="presentation">
      <button type="button" role="option" data-lobby-player-account={player.accountId} data-lobby-player-index={index}
        aria-selected={selectedId === player.accountId} title={player.name}
        data-touch-double-click={chooseTarget && !isMobileDevice() ? '' : undefined}
        onContextMenu={event => {event.preventDefault(); setSelected(player.accountId); openPlayer?.(player);}}
        onClick={() => {setSelected(player.accountId); if (isMobileDevice()) openPlayer?.(player);}}
        onDoubleClick={() => {if (!isMobileDevice()) chooseTarget?.(player);}} onKeyDown={event => move(event, index)}
        onKeyUp={event => {
          if (['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter'].includes(event.key) || event.key === 'F10' && event.shiftKey) event.stopPropagation();
        }}>
        {selectedId === player.accountId && <GameSelectionHighlight/>}
        <SourceFeedbackText text={player.name}/></button>
    </li>)}
  </ul><GameMessage data-lobby-presence-status="" text={error || status}/><GameScrollbar list={list} step={20} label="玩家列表滚动条"/></div>;
}
