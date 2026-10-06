import './source-chat-intimate.css';
import {useLayoutEffect, useRef, useState, type RefObject} from 'react';
import {HomeSourceLayout, type HomeSourceUi} from '../resources/source-ui-layout';
import {SourceStaticImage} from '../resources/source-static-image';
import {sourceProps} from '../resources/source-ui-props';
import {RoomIntimateScrollbar} from './room-intimate-scrollbar';

export interface RoomIntimatePlayer {id: string; name: string;}

/** Original room list geometry; names remain a confirmed room-roster projection. */
export function SourceChatIntimate({ui, waiting, players, selectedName, pending, composing, choose}: {
  ui: HomeSourceUi; waiting: boolean; players: readonly RoomIntimatePlayer[];
  selectedName: string; pending: boolean; composing: RefObject<boolean>;
  choose: (name: string) => void;
}) {
  const suffix = waiting ? 'chat_intimatelist.xml' : 'game_main_intimatelist.xml';
  const layout = new HomeSourceLayout(ui, suffix);
  const root = layout.control('all').properties.AbsoluteRect.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
  const list = useRef<HTMLDivElement>(null);
  const [candidate, setCandidate] = useState(() => players.find(player => player.name === selectedName)?.id);
  const active = players.some(player => player.id === candidate) ? candidate
    : players.find(player => player.name === selectedName)?.id ?? players[0]?.id;
  const selection = sourceProps(ui, layout, suffix, 'lstIntimate', layout.control('lstIntimate').properties.SelectionImage);
  useLayoutEffect(() => {
    const button = [...list.current?.querySelectorAll<HTMLButtonElement>('[data-room-intimate-player]') ?? []]
      .find(value => value.dataset.roomIntimatePlayer === active);
    (button ?? list.current)?.focus();
  }, []);
  return <div className={`source-room-intimate-menu ${waiting ? 'source-room-intimate-waiting' : 'source-room-intimate-playing'}`}
    data-room-intimate-menu="" style={{width: root[2] - root[0], height: root[3] - root[1]}}
    onKeyDown={event => event.stopPropagation()} onKeyUp={event => event.stopPropagation()}>
    {['all', 'biaoqingfuhaokuang'].map(name => <SourceStaticImage key={name} ui={ui} layout={layout}
      suffix={suffix} name={name} offsetX={-root[0]} offsetY={-root[1]} aria-hidden="true" />)}
    <div {...sourceProps(ui, layout, suffix, 'lstIntimate', undefined, -root[0], -root[1])}
      className="source-room-intimate-scroll-shell">
    <div ref={list} className="source-room-intimate-list" data-room-intimate-list="" data-roster-binding="web-confirmed-room-snapshot"
      tabIndex={-1} role="listbox" aria-label="当前房间密语对象">
      {players.map((player, index) => <button key={player.id} type="button" role="option"
        data-room-intimate-player={player.id} aria-selected={player.id === active}
        tabIndex={player.id === active ? 0 : -1} disabled={pending} title={player.name}
        data-source-selection-asset={player.id === active ? selection['data-source-asset'] : undefined}
        style={player.id === active ? {backgroundImage: selection.style.backgroundImage} : undefined}
        onFocus={() => setCandidate(player.id)} onClick={() => {
          if (!pending && !composing.current) choose(player.name);
        }} onKeyDown={event => {
          const next = event.key === 'ArrowDown' ? Math.min(index + 1, players.length - 1)
            : event.key === 'ArrowUp' ? Math.max(index - 1, 0) : event.key === 'Home' ? 0
            : event.key === 'End' ? players.length - 1 : undefined;
          if (next !== undefined) {
            event.preventDefault();
            const button = list.current?.querySelectorAll<HTMLButtonElement>('[data-room-intimate-player]')[next];
            button?.focus(); button?.scrollIntoView({block: 'nearest'});
          }
        }}>{player.name}</button>)}
      {!players.length && <output role="status">当前房间名单未取得</output>}
    </div>
    <RoomIntimateScrollbar list={list} ui={ui} properties={layout.control('lstIntimate').properties}/>
    </div>
  </div>;
}
