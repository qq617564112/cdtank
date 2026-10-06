import {TradeSourcePage} from '../account/trade-source-page';
import {SourceConfirmView} from '../dialogs/source-confirm-view';
import {useEffect, useState, useSyncExternalStore} from 'react';
import type {Battle} from '../../match/battle';
import {LobbyPlayerListView} from './lobby-player-list';
import {PlayerInfoView} from './player-info';
import {useSourceUi} from './source-react';
import {HomeSourceLayout} from '../resources/source-ui-layout';
import {SourceButton} from '../resources/source-button';
import {SourceStaticImage} from '../resources/source-static-image';

/** React owns directory selection and the profile session; accounts own relationships. */
export function LobbySocialView({battle}: {battle: Battle}) {
  const presence = useSyncExternalStore(battle.lobbyPresence.subscribe, battle.lobbyPresence.getSnapshot);
  const blacklist = useSyncExternalStore(battle.blacklist.subscribe, battle.blacklist.getSnapshot);
  const trade = useSyncExternalStore(battle.trade.subscribe, battle.trade.getSnapshot);
  const [dismissedTrade, setDismissedTrade] = useState<string>();
  const friends = useSyncExternalStore(battle.friends.subscribe, battle.friends.getSnapshot);
  const [tab, setTab] = useState<'players' | 'friends'>('players');
  const [selected, setSelected] = useState<{accountId: string; name: string} | null>(null);
  const {ui} = useSourceUi(true, ['playerlist.xml']);
  const layout = ui ? new HomeSourceLayout(ui, 'playerlist.xml') : undefined;
  useEffect(() => {battle.lobbyPresence.start(); return () => battle.lobbyPresence.stop();}, [battle]);
  useEffect(() => {
    if (presence.status === '连接已断开') setSelected(null);
  }, [presence.status]);
  useEffect(() => {
    if (presence.inRoom) {setSelected(null); return;}
    void battle.friends.refresh(); void battle.blacklist.refresh(); void battle.trade.refresh();
    const timer = setInterval(() => {
      if (battle.isConnected && !document.hidden) {void battle.friends.refresh(); void battle.blacklist.refresh(); void battle.trade.refresh();}
    }, 2000);
    return () => clearInterval(timer);
  }, [battle, presence.inRoom]);
  const relation = friends.friends.find(player => player.accountId === selected?.accountId);
  const onlinePlayer = presence.players.find(player => player.accountId === selected?.accountId);
  const profile = selected ? {accountId: selected.accountId, name: relation?.name ?? onlinePlayer?.name ?? selected.name,
    isBlocked: blacklist.blocked.some(player => player.accountId === selected.accountId),
    isFriend: !!relation, online: relation?.online ?? !!onlinePlayer, inRoom: relation?.inRoom ?? false} : null;
  function chooseTarget(player: {accountId: string; name: string}): void {
    battle.lobbyChat.chooseTarget(player);
    requestAnimationFrame(() => document.querySelector<HTMLInputElement>('[data-lobby-chat-input]')?.focus());
  }
  const tradeValue = trade.value, tradeSession = tradeValue?.session;
  const showTrade = !presence.inRoom && tradeSession && dismissedTrade !== tradeSession.id;
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
        data-lobby-player-tab onClick={() => setTab('players')} aria-label="大厅玩家"/>
      <SourceButton ui={ui} layout={layout} suffix="playerlist.xml" source="FriendTab" className="lobby-source-tab" selected={tab === 'friends'}
        data-lobby-friend-tab onClick={() => {setTab('friends'); void battle.friends.refresh(); void battle.blacklist.refresh();}} aria-label="好友"/>
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
    <PlayerInfoView open={!!profile && !presence.inRoom && !showTrade} player={profile} pending={friends.pending || blacklist.pending || trade.pending} status={trade.status || blacklist.status || friends.status}
      onAddFriend={() => {if (selected) void battle.friends.change('ADD', selected.accountId);}}
      onRemoveFriend={() => {if (selected) void battle.friends.change('REMOVE', selected.accountId);}}
      onAddBlacklist={() => {if (selected) void battle.blacklist.change('ADD', selected.accountId);}}
      onRemoveBlacklist={() => {if (selected) void battle.blacklist.change('REMOVE', selected.accountId);}}
      onExchange={() => {if (selected) {void battle.trade.act({operation: 'INVITE', targetAccountId: selected.accountId}).then(() => {
        const session = battle.trade.getSnapshot().value?.session;
        if (session?.phase === 'INVITED') setSelected(null);
      });}}}
      onClose={() => setSelected(null)}/>
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
