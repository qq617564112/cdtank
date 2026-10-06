import './lobby-chat-intimate.css';
import {useEffect, useRef, useState, type RefObject} from 'react';
import {HomeSourceLayout, type HomeSourceUi} from '../resources/source-ui-layout';
import {SourceButton} from '../resources/source-button';
import {SourceStaticImage} from '../resources/source-static-image';
import {sourceProps} from '../resources/source-ui-props';
import {LobbyIntimateScrollbar} from './lobby-intimate-scrollbar';

export interface LobbyIntimatePlayer {accountId: string; name: string;}

/** Source list bounds consume the current authoritative lobby directory. */
export function LobbyChatIntimate({ui, players, selected, open, pending, status, composing,
  toggle, close, choose}: {
  ui: HomeSourceUi; players: readonly LobbyIntimatePlayer[]; selected?: string;
  open: boolean; pending: boolean; status: string; composing: RefObject<boolean>;
  toggle: () => void; close: () => void; choose: (player: LobbyIntimatePlayer) => void;
}) {
  const menu = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const blockClick = useRef(false);
  const [candidate, setCandidate] = useState(selected);
  const active = players.some(player => player.accountId === candidate) ? candidate
    : players.some(player => player.accountId === selected) ? selected : players[0]?.accountId;
  const chat = new HomeSourceLayout(ui, 'chat.xml');
  const source = new HomeSourceLayout(ui, 'chat_intimatelist.xml');
  const selection = sourceProps(ui, source, 'chat_intimatelist.xml', 'lstIntimate', source.control('lstIntimate').properties.SelectionImage);
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Element && !event.target.closest('[data-lobby-intimate-menu], [data-lobby-intimate-toggle]')) close();
    };
    window.addEventListener('pointerdown', outside); window.addEventListener('blur', close);
    return () => {window.removeEventListener('pointerdown', outside); window.removeEventListener('blur', close);};
  }, [close]);
  function focusCandidate(): void {
    const buttons = menu.current?.querySelectorAll<HTMLButtonElement>('[data-lobby-intimate-account]');
    const row = [...buttons ?? []].find(button => button.dataset.lobbyIntimateAccount === active);
    (row ?? menu.current)?.focus();
  }
  return <div style={{display: 'contents'}} onPointerDownCapture={event => {
    if (event.target instanceof Element && event.target.closest('[data-lobby-intimate-toggle]')) {
      blockClick.current = composing.current;
      if (blockClick.current) event.preventDefault();
    }
  }} onPointerCancelCapture={() => {blockClick.current = false;}} onClickCapture={event => {
    if (event.target instanceof Element && event.target.closest('[data-lobby-intimate-toggle]')
        && (blockClick.current || composing.current)) {
      blockClick.current = false; event.preventDefault(); event.stopPropagation();
    }
  }}>
    <SourceButton ui={ui} layout={chat} suffix="chat.xml" source="btnExpandIntimate"
      data-lobby-whisper-choose="" data-lobby-intimate-toggle="" aria-label="选择密语对象"
      aria-haspopup="listbox" aria-expanded={open} disabled={pending} onClick={() => {
        if (pending || composing.current) return;
        toggle(); requestAnimationFrame(focusCandidate);
      }} />
    {open && <div ref={menu} className="lobby-intimate-menu" data-lobby-intimate-menu="" tabIndex={-1}>
      {['all', 'biaoqingfuhaokuang'].map(name => <SourceStaticImage key={name} ui={ui} layout={source}
        suffix="chat_intimatelist.xml" name={name} offsetX={-78} offsetY={-35} aria-hidden="true" />)}
      <div {...sourceProps(ui, source, 'chat_intimatelist.xml', 'lstIntimate', undefined, -78, -35)}
        className="lobby-intimate-scroll-shell">
      <div ref={list} data-lobby-intimate-list="" className="lobby-intimate-list" role="listbox"
        aria-label="当前大厅密语对象" data-directory-binding="web-confirmed-lobby-presence">
        {players.map((player, index) => <button key={player.accountId} type="button" role="option"
          data-lobby-intimate-account={player.accountId} aria-selected={active === player.accountId}
          tabIndex={active === player.accountId ? 0 : -1} disabled={pending} title={player.name}
          style={active === player.accountId ? {backgroundImage: selection.style.backgroundImage} : undefined}
          data-source-selection-asset={active === player.accountId ? selection['data-source-asset'] : undefined}
          onClick={() => {if (!pending && !composing.current) choose(player);}}
          onFocus={() => setCandidate(player.accountId)} onKeyDown={event => {
            const next = event.key === 'ArrowDown' ? Math.min(index + 1, players.length - 1)
              : event.key === 'ArrowUp' ? Math.max(index - 1, 0) : event.key === 'Home' ? 0
              : event.key === 'End' ? players.length - 1 : undefined;
            if (next !== undefined) {
              event.preventDefault();
              const button = menu.current?.querySelectorAll<HTMLButtonElement>('[data-lobby-intimate-account]')[next];
              button?.focus(); button?.scrollIntoView({block: 'nearest'});
            }
          }}>{player.name}</button>)}
        {!players.length && <output role="status">{status || '当前大厅没有可选对象'}</output>}
      </div>
      <LobbyIntimateScrollbar list={list} ui={ui} properties={source.control('lstIntimate').properties}/>
      </div>
    </div>}
  </div>;
}
