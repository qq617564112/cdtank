import {SourceFeedbackText} from '../resources/source-feedback-text';
import './lobby-player-list.css';
import {PlayerListScrollbar} from './player-list-scrollbar';
import {useEffect, useRef, useState, type KeyboardEvent} from 'react';
import {HomeSourceLayout} from '../resources/source-ui-layout';
import {loadSourceUiFonts} from '../resources/source-ui-fonts';
import {sourceProps, useSourceUi} from './source-react';

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
    void loadSourceUiFonts().then(() => {if (live) setFontReady(true);}).catch(() => {});
    return () => {live = false;};
  }, []);
  const selectedId = players.some(player => player.accountId === selected) ? selected : '';
  const layout = ui ? new HomeSourceLayout(ui, 'playerlist.xml') : undefined;
  const props = layout ? sourceProps(ui!, layout, 'playerlist.xml', 'PlayerList') : undefined;
  const selection = layout ? sourceProps(ui!, layout, 'playerlist.xml', 'PlayerList', layout.control('PlayerList').properties.SelectionImage) : undefined;
  function move(event: KeyboardEvent<HTMLButtonElement>, index: number): void {
    if (event.key === 'F10' && event.shiftKey) {event.preventDefault(); event.stopPropagation(); openPlayer?.(players[index]); return;}
    if (event.key === 'Enter') {event.preventDefault(); event.stopPropagation(); chooseTarget?.(players[index]); return;}
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
  return <div {...props} className="lobby-player-scroll-shell"><ul ref={list} className="lobby-player-list" data-lobby-player-list=""
    data-source-font="SIMSUN" data-source-font-provider="web-ttf" data-source-font-ready={fontReady}
    role="listbox" aria-label="大厅玩家列表" aria-busy={!ui} title={error || status || undefined}>
    {(error || status) && <li role="presentation"><output data-lobby-presence-status="" role="status">{error || status}</output></li>}
    {players.map((player, index) => <li key={player.accountId} role="presentation">
      <button type="button" role="option" data-lobby-player-account={player.accountId} data-lobby-player-index={index}
        aria-selected={selectedId === player.accountId} title={player.name}
        style={selectedId === player.accountId ? {backgroundImage: selection?.style.backgroundImage} : undefined}
        data-source-selection-asset={selectedId === player.accountId ? selection?.['data-source-asset'] : undefined}
        onContextMenu={event => {event.preventDefault(); setSelected(player.accountId); openPlayer?.(player);}}
        onClick={() => setSelected(player.accountId)} onDoubleClick={() => chooseTarget?.(player)} onKeyDown={event => move(event, index)}
        onKeyUp={event => {
          if (['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter'].includes(event.key) || event.key === 'F10' && event.shiftKey) event.stopPropagation();
        }}><SourceFeedbackText text={player.name}/></button>
    </li>)}
  </ul>{ui && layout && <PlayerListScrollbar list={list} ui={ui} properties={layout.control('PlayerList').properties} />}</div>;
}
