import {GameMessage} from '../resources/game-message';
import {isMobileDevice} from '../../platform/device';
import {sourceDialogScale, subscribeGamePageViewport} from '../../platform/page-viewport';
import './player-search.css';
import {useEffect, useRef, useState, type FormEvent, type KeyboardEvent} from 'react';
import type {FriendRecord} from '../../../../shared/protocols/PtlFriends';
import type {ResPlayerSearch} from '../../../../shared/protocols/PtlPlayerSearch';
import {GameDialog, GameDialogTopbar, GameDialogPanel,
  GameDialogFootbar} from '../resources/game-dialog';
import {DialogButton} from '../resources/dialog-button';
import {CartoonInput} from '../resources/cartoon-controls';
import {GameButton} from '../resources/game-button';

export interface PlayerSearchViewProps {
  open: boolean;
  query: (name: string) => Promise<ResPlayerSearch>;
  onSelect: (player: FriendRecord) => void;
  onClose: () => void;
}

const accountTag = (accountId: string): string => `#${accountId.slice(0, 6)}`;
const SEARCH_PAGE_SIZE = 4;
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
  const [page, setPage] = useState(0);
  const mobile = isMobileDevice();
  const [scale, setScale] = useState(() => sourceDialogScale(520, 405));
  useEffect(() => {
    const resize = () => setScale(sourceDialogScale(520, 405));
    return subscribeGamePageViewport(resize);
  }, []);
  const count = results?.length ?? 0;
  const pages = Math.ceil(count / SEARCH_PAGE_SIZE);
  const visibleResults = results?.slice(page * SEARCH_PAGE_SIZE, (page + 1) * SEARCH_PAGE_SIZE) ?? [];
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
    setPage(0);
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
  function handleKeyDown(event: KeyboardEvent<HTMLElement>): void {
    event.stopPropagation();
    if (event.key === 'Escape') {
      event.preventDefault();
      if (!event.nativeEvent.isComposing && !composing.current && !pending) escapePending.current = true;
      return;
    }
    if (event.key === 'Enter' && (event.nativeEvent.isComposing || composing.current)) event.preventDefault();
  }
  function handleKeyUp(event: KeyboardEvent<HTMLElement>): void {
    event.stopPropagation();
    if (event.key === 'Escape' && escapePending.current) {escapePending.current = false; close();}
  }
  return <GameDialog ref={dialog} width={mobile ? 520 : 360} height={mobile ? 405 : undefined}
    uiScale={mobile ? scale : undefined} stageClassName="player-search-stage"
    data-player-search="" aria-label="查找玩家" aria-busy={pending}
    onCancel={event => {
      event.preventDefault();
      if (!composing.current && !pending) escapePending.current = true;
    }}
    onKeyDown={handleKeyDown} onKeyUp={handleKeyUp}>
    <GameDialogTopbar>
      <DialogButton kind="close" className="player-search-close" aria-label="关闭查找玩家"
        disabled={pending} onClick={close}/>
    </GameDialogTopbar>
    <GameDialogPanel className="player-search-panel">
      <div className="player-search-content">
        <form id="player-search-form" className="player-search-form" onSubmit={onSubmit}>
          <label className="player-search-label" htmlFor="player-search-name">玩家昵称</label>
          <CartoonInput ref={input} width={320} height={31} style={{width: '100%'}}
            id="player-search-name" className="player-search-input" type="text" name="name"
            autoComplete="off" autoCorrect="off" spellCheck={false} value={name}
            onChange={event => setName(event.target.value)}
            onKeyDown={handleKeyDown} onKeyUp={handleKeyUp}
            onCompositionStart={() => {composing.current = true;}}
            onCompositionEnd={() => {composing.current = false;}}/>
        </form>
        {error && <div className="player-search-error">
          <GameMessage text={error} tone="error"/>
          <DialogButton data-player-search-retry="" disabled={pending} onClick={submit}>重试</DialogButton>
        </div>}
        <section className="player-search-results-region" aria-label="查找结果" aria-busy={pending}>
          {count > 0 ? <ul className="player-search-results">
            {visibleResults.map(player => {
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
          </ul> : <GameMessage text={pending || error ? '' : results ? '未找到玩家' : ''}/>}
        </section>
        <nav className="player-search-pagination" aria-label="查找结果分页">
          <GameButton shape="previous" tone="neutral" aria-label="上一页"
            data-player-search-previous="" disabled={pending || page === 0}
            onClick={() => setPage(value => value - 1)}/>
          <output data-player-search-page="" aria-live="polite">
            共 {count} 位 · {pages ? page + 1 : 0} / {pages} 页
          </output>
          <GameButton shape="next" tone="neutral" aria-label="下一页"
            data-player-search-next="" disabled={pending || page + 1 >= pages}
            onClick={() => setPage(value => value + 1)}/>
        </nav>
      </div>
    </GameDialogPanel>
    <GameDialogFootbar className="player-search-footbar">
      <DialogButton className="player-search-submit" type="submit" form="player-search-form"
        disabled={pending}>查找</DialogButton>
      <DialogButton disabled={pending} onClick={close}>取消</DialogButton>
    </GameDialogFootbar>
  </GameDialog>;
}
