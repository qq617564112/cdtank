import './player-search.css';
import {useEffect, useRef, useState, type FormEvent} from 'react';
import type {FriendRecord} from '../../../shared/protocols/PtlFriends';
import type {ResPlayerSearch} from '../../../shared/protocols/PtlPlayerSearch';

export interface PlayerSearchViewProps {
  open: boolean;
  query: (name: string) => Promise<ResPlayerSearch>;
  onSelect: (player: FriendRecord) => void;
  onClose: () => void;
}

const accountTag = (accountId: string): string => `#${accountId.slice(0, 6)}`;
const playerState = (player: FriendRecord): {key: string; text: string} =>
  player.online ? player.inRoom ? {key: 'in-room', text: '房间中'} : {key: 'online', text: '在线'}
    : {key: 'offline', text: '离线'};

/** Player directory entry: one explicit exact-nickname submit lists every matching account. */
export function PlayerSearchView(props: PlayerSearchViewProps) {
  return props.open ? <PlayerSearchSession {...props}/> : null;
}

function PlayerSearchSession({query, onSelect, onClose}: PlayerSearchViewProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const escapePending = useRef(false);
  const composing = useRef(false);
  const live = useRef(true);
  const inFlight = useRef(false);
  const revision = useRef(0);
  const [name, setName] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState<FriendRecord[] | null>(null);
  useEffect(() => {
    const element = dialog.current!;
    const origin = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    element.showModal();
    input.current?.focus();
    return () => {
      live.current = false;
      if (element.open) element.close();
      if (origin && origin.isConnected) origin.focus();
    };
  }, []);
  function submit(): void {
    if (inFlight.current || composing.current) return;
    inFlight.current = true;
    const request = ++revision.current;
    setPending(true);
    setError('');
    setResults(null);
    void query(name.trim()).then(value => {
      if (!live.current || request !== revision.current) return;
      setResults(value.players);
    }).catch(reason => {
      if (!live.current || request !== revision.current) return;
      setError(reason instanceof Error ? reason.message : String(reason));
    }).finally(() => {
      if (request !== revision.current) return;
      inFlight.current = false;
      if (!live.current) return;
      setPending(false);
    });
  }
  function onSubmit(event: FormEvent): void {
    event.preventDefault();
    submit();
  }
  const close = () => {if (!pending && !inFlight.current) onClose();};
  return <dialog ref={dialog} data-player-search="" aria-label="查找玩家" aria-busy={pending}
    onCancel={event => {event.preventDefault(); close();}}
    onKeyDown={event => {
      event.stopPropagation();
      if (event.key !== 'Escape') return;
      event.preventDefault();
      if (!event.nativeEvent.isComposing && !composing.current && !pending) escapePending.current = true;
    }} onKeyUp={event => {
      event.stopPropagation();
      if (event.key === 'Escape' && escapePending.current) {escapePending.current = false; close();}
    }}>
    <div className="player-search-stage">
      <form className="player-search-form" onSubmit={onSubmit}>
        <label className="player-search-label" htmlFor="player-search-name">玩家昵称</label>
        <input ref={input} id="player-search-name" className="player-search-input" type="text" name="name"
          autoComplete="off" autoCorrect="off" spellCheck={false} value={name}
          onChange={event => setName(event.target.value)}
          onKeyDown={event => {
            event.stopPropagation();
            if (event.key === 'Enter' && (event.nativeEvent.isComposing || composing.current)) event.preventDefault();
          }} onKeyUp={event => event.stopPropagation()}
          onCompositionStart={() => {composing.current = true;}}
          onCompositionEnd={() => {composing.current = false;}}/>
        <button className="player-search-submit" type="submit" disabled={pending}>查找</button>
      </form>
      <output className="player-search-status" role="status" aria-live="polite">
        {pending ? '查找中…' : !error && results && results.length === 0 ? '未找到玩家' : ''}
      </output>
      {error && <div className="player-search-error" role="alert">
        <span>{error}</span>
        <button type="button" data-player-search-retry="" disabled={pending} onClick={submit}>重试</button>
      </div>}
      {results && results.length > 0 && <ul className="player-search-results" aria-label="查找结果">
        {results.map(player => {
          const state = playerState(player);
          return <li key={player.accountId}>
            <button type="button" data-player-search-result={player.accountId} title={player.name}
              onClick={() => onSelect(player)}>
              <span className="player-search-result-name">{player.name}</span>
              <span className="player-search-result-tag">{accountTag(player.accountId)}</span>
              <span className="player-search-result-state" data-search-state={state.key}>{state.text}</span>
              {player.title && <span className="player-search-result-title">{player.title.name}</span>}
            </button>
          </li>;
        })}
      </ul>}
    </div>
  </dialog>;
}
