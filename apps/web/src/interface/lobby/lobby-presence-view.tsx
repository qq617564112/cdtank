import {useEffect, useSyncExternalStore} from 'react';
import type {LobbyPresence} from '../../network/lobby-presence';
import {LobbyPlayerListView} from './lobby-player-list';

/** React subscribes to member changes, never to frame-by-frame battle state. */
export function LobbyPresenceView({presence, chooseTarget}: {presence: LobbyPresence; chooseTarget?: (player: {accountId: string; name: string}) => void}) {
  const state = useSyncExternalStore(presence.subscribe, presence.getSnapshot);
  useEffect(() => {presence.start(); return () => presence.stop();}, [presence]);
  return <LobbyPlayerListView chooseTarget={chooseTarget} players={state.players} status={state.loading ? '载入玩家…' : state.status}/>;
}
