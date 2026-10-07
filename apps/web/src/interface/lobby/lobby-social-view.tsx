import {TradeSourcePage} from '../account/trade-source-page';
import {SourceConfirmView} from '../dialogs/source-confirm-view';
import {useCallback, useEffect, useRef, useState, useSyncExternalStore} from 'react';
import type {Battle} from '../../match/battle';
import {LobbyPlayerListView} from './lobby-player-list';
import {PlayerInfoView} from './player-info';
import {PlayerSearchView} from './player-search';
import {useSourceUi} from './source-react';
import {HomeSourceLayout} from '../resources/source-ui-layout';
import {SourceButton} from '../resources/source-button';
import {SourceStaticImage} from '../resources/source-static-image';
import type {FriendRecord} from '../../../../shared/protocols/PtlFriends';
import type {ResPlayerSearch} from '../../../../shared/protocols/PtlPlayerSearch';

type SelectedPlayer = {accountId: string; name: string; online?: boolean; inRoom?: boolean;
  title?: FriendRecord['title']; fromSearch?: boolean};

/** React owns directory selection and the profile session; accounts own relationships. */
export function LobbySocialView({battle}: {battle: Battle}) {
  const presence = useSyncExternalStore(battle.lobbyPresence.subscribe, battle.lobbyPresence.getSnapshot);
  const blacklist = useSyncExternalStore(battle.blacklist.subscribe, battle.blacklist.getSnapshot);
  const trade = useSyncExternalStore(battle.trade.subscribe, battle.trade.getSnapshot);
  const [dismissedTrade, setDismissedTrade] = useState<string>();
  const friends = useSyncExternalStore(battle.friends.subscribe, battle.friends.getSnapshot);
  const [tab, setTab] = useState<'players' | 'friends'>('players');
  const [selected, setSelected] = useState<SelectedPlayer | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchButton = useRef<HTMLButtonElement>(null);
  const accountContext = useSyncExternalStore(
    useCallback((listener: () => void) => battle.subscribeAccountContext(listener), [battle]),
    useCallback(() => battle.accountContext, [battle]));
  const {ui} = useSourceUi(true, ['playerlist.xml']);
  const layout = ui ? new HomeSourceLayout(ui, 'playerlist.xml') : undefined;
  const queryPlayerProfile = useCallback((accountId: string) => battle.playerProfile(accountId), [battle]);
  const queryPlayerSearch = useCallback((name: string): Promise<ResPlayerSearch> => battle.playerSearch(name), [battle]);
  useEffect(() => {battle.lobbyPresence.start(); return () => battle.lobbyPresence.stop();}, [battle]);
  useEffect(() => {
    if (presence.status === '连接已断开') {setSelected(null); setSearchOpen(false);}
  }, [presence.status]);
  useEffect(() => {
    if (presence.inRoom) {setSelected(null); setSearchOpen(false); return;}
    void battle.friends.refresh(); void battle.blacklist.refresh(); void battle.trade.refresh();
    const timer = setInterval(() => {
      if (battle.isConnected && !document.hidden) {void battle.friends.refresh(); void battle.blacklist.refresh(); void battle.trade.refresh();}
    }, 2000);
    return () => clearInterval(timer);
  }, [battle, presence.inRoom]);
  useEffect(() => {setSearchOpen(false); setSelected(null);}, [accountContext.generation]);
  const relation = friends.friends.find(player => player.accountId === selected?.accountId);
  const onlinePlayer = presence.players.find(player => player.accountId === selected?.accountId);
  const profile = selected ? {accountId: selected.accountId, name: relation?.name ?? onlinePlayer?.name ?? selected.name,
    title: relation?.title?.name ?? onlinePlayer?.title?.name ?? selected.title?.name
      ?? blacklist.blocked.find(player => player.accountId === selected.accountId)?.title?.name,
    isBlocked: blacklist.blocked.some(player => player.accountId === selected.accountId),
    isFriend: !!relation, online: relation?.online ?? (onlinePlayer ? true : selected.online) ?? false,
    inRoom: relation?.inRoom ?? selected.inRoom ?? false} : null;
  function chooseTarget(player: {accountId: string; name: string}): void {
    battle.lobbyChat.chooseTarget(player);
    requestAnimationFrame(() => document.querySelector<HTMLInputElement>('[data-lobby-chat-input]')?.focus());
  }
  function openFromSearch(player: FriendRecord): void {
    setSelected({...player, fromSearch: true});
    setSearchOpen(false);
    void battle.friends.refresh(); void battle.blacklist.refresh();
  }
  function closeProfile(): void {
    const fromSearch = selected?.fromSearch;
    setSelected(null);
    if (fromSearch) {
      const target = searchButton.current;
      requestAnimationFrame(() => {if (target?.isConnected) target.focus();});
    }
  }
  const tradeValue = trade.value, tradeSession = tradeValue?.session;
  const showTrade = !presence.inRoom && tradeSession && dismissedTrade !== tradeSession.id;
  useEffect(() => {if (showTrade) {setSelected(null); setSearchOpen(false);}}, [showTrade]);
  const incomingTrade = tradeSession?.inviterAccountId !== tradeValue?.account.accountId;
  const peerName = tradeSession?.parties.find(party => party.accountId !== tradeValue?.account.accountId)?.name;
  const closeTrade = () => {
    if (!tradeSession || trade.pending) return;
    if (tradeSession.phase === 'OPEN' || tradeSession.phase === 'INVITED') {
      void battle.trade.act({operation: 'CANCEL', sessionId: tradeSession.id});
    } else setDismissedTrade(tradeSession.id);
  };
  return <>
    {ui && layout && <>
      <SourceButton ui={ui} layout={layout} suffix="playerlist.xml" source="PlayerTab" className="lobby-source-tab" selected={tab === 'players'}
        data-lobby-player-tab onClick={() => {setTab('players'); setSelected(null);}} aria-label="大厅玩家"/>
      <SourceButton ui={ui} layout={layout} suffix="playerlist.xml" source="FriendTab" className="lobby-source-tab" selected={tab === 'friends'}
        data-lobby-friend-tab onClick={() => {setTab('friends'); setSelected(null); void battle.friends.refresh(); void battle.blacklist.refresh();}} aria-label="好友"/>
      <SourceStaticImage ui={ui} layout={layout} suffix="playerlist.xml"
        name={tab === 'friends' ? 'picFriendTabSelect' : 'picPlayerTabSelect'} className="lobby-source-picture"/>
    </>}
    <LobbyPlayerListView players={tab === 'friends' ? friends.friends.map(player => ({...player,
      name: `${player.name}${player.online ? player.inRoom ? '（对局中）' : '' : '（离线）'}`})) : presence.players}
      status={tab === 'friends' ? friends.status : presence.loading ? '载入玩家…' : presence.status}
      chooseTarget={player => {
        const canonical = friends.friends.find(row => row.accountId === player.accountId);
        chooseTarget(canonical ?? player);
      }} openPlayer={player => {
        const canonical = friends.friends.find(row => row.accountId === player.accountId);
        setSelected(canonical ?? player); void battle.friends.refresh(); void battle.blacklist.refresh();
      }}/>
    <button ref={searchButton} type="button" className="lobby-player-search-launcher"
      data-lobby-player-search="" aria-haspopup="dialog" aria-expanded={searchOpen}
      onClick={() => setSearchOpen(true)}>查找玩家</button>
    <PlayerInfoView open={!!profile && !presence.inRoom && !showTrade} player={profile} pending={friends.pending || blacklist.pending || trade.pending} status={trade.status || blacklist.status || friends.status}
      query={queryPlayerProfile}
      onAddFriend={() => {if (selected) void battle.friends.change('ADD', selected.accountId);}}
      onRemoveFriend={() => {if (selected) void battle.friends.change('REMOVE', selected.accountId);}}
      onAddBlacklist={() => {if (selected) void battle.blacklist.change('ADD', selected.accountId);}}
      onRemoveBlacklist={() => {if (selected) void battle.blacklist.change('REMOVE', selected.accountId);}}
      onExchange={() => {if (selected) {void battle.trade.act({operation: 'INVITE', targetAccountId: selected.accountId}).then(() => {
        const session = battle.trade.getSnapshot().value?.session;
        if (session?.phase === 'INVITED') setSelected(null);
      });}}}
      onClose={closeProfile}/>
    <PlayerSearchView open={searchOpen} query={queryPlayerSearch} onSelect={openFromSearch} onClose={() => setSearchOpen(false)}/>
    {showTrade && tradeSession.phase === 'INVITED' && <SourceConfirmView label="交易邀请" binding="web-trade-invitation"
      message={incomingTrade ? `${peerName} 请求与你交易，是否接受？` : `等待 ${peerName} 接受交易邀请`}
      pending={trade.pending} disabled={!incomingTrade} status={trade.status}
      confirm={() => void battle.trade.act({operation: 'RESPOND', sessionId: tradeSession.id, accept: true})}
      cancel={() => void battle.trade.act(incomingTrade ? {operation: 'RESPOND', sessionId: tradeSession.id, accept: false}
        : {operation: 'CANCEL', sessionId: tradeSession.id})}/>} 
    {showTrade && tradeSession.phase !== 'INVITED' && tradeValue && <TradeSourcePage state={tradeValue}
      pending={trade.pending} status={trade.status} act={request => void battle.trade.act(request)} close={closeTrade}/>}
  </>;
}
