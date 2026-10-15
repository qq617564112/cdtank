import {useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore} from 'react';
import {setButtonSoundBattleActive} from './audio/button-sound';
import type {Battle} from './match/battle';
import {LobbyView} from './interface/lobby/room-controls';
import {LobbyChatView} from './interface/lobby/lobby-chat-view';
import {LobbySocialView} from './interface/lobby/lobby-social-view';
import {BattleMatchView} from './interface/battle/battle-match';
import {BattleChatView} from './interface/battle/battle-chat-view';
import {BattleHudView} from './interface/battle/battle-hud-view';
import {MobileBattleHud} from './interface/battle/mobile-battle-hud';
import {isMobileDevice} from './platform/device';
import {BattleScoreboardView} from './interface/battle/battle-scoreboard-view';
import {VolumeSettingsView} from './interface/settings/volume-settings';
import {KeySettingsView, KeyBindingsHint} from './interface/settings/key-settings';
import {SettingsSourceView} from './interface/settings/settings-source-view';
import {TutorialSettingsBar} from './interface/settings/tutorial-settings-source-view';
import {QuickChatSettingsView} from './interface/settings/quick-chat-settings';
import type {InitialSettings} from './interface/settings/settings-startup';
import {HomeInventoryView} from './interface/home/home-inventory';
import {HomeEquipmentView} from './interface/home/home-equipment';
import {HomeRolesView} from './interface/home/home-roles';
import {AccountShopView} from './interface/account/shop';
import {AccountHistoryView} from './interface/account/history';
import {HistoryIntroSourceView} from './interface/account/history-intro-source-view';
import {LoginSourceView} from './interface/login/login-source-view';
import {ChannelSourceView} from './interface/login/channel-source-view';
import {useLoginNavigation} from './interface/login/use-login-navigation';
import {navigateGame, roomPath, useGameRoute, useNavigationChoice, useRouteDialog, useNavigationNumber} from './navigation/route';
import {readQuickStart} from './navigation/quick-start';
import {GameMessageHost, showGameMessage} from './interface/resources/game-message';
import type {ImageLoadingScreen} from './interface/resources/image-loading-screen';
import {DialogButton} from './interface/resources/dialog-button';
import {usePageImages} from './interface/resources/use-page-images';

interface AppProps {battle: Battle; canvas: HTMLCanvasElement; hud: HTMLOutputElement; settings: InitialSettings;
  loadingScreen: ImageLoadingScreen; validation?: boolean;}

/** One page root; scene and transport remain independent of React render cycles. */
export function App(props: AppProps) {
  return <><GameMessageHost/><GamePages {...props}/></>;
}

function GamePages({battle,canvas,hud,settings,loadingScreen,validation=false}: AppProps) {
  const login = useLoginNavigation(battle, validation);
  const route = useGameRoute();
  const [inventoryOpen, setInventoryOpen] = useRouteDialog('inventory');
  const [equipmentOpen, setEquipmentOpen] = useRouteDialog('equipment');
  const [equipmentTankInstance, setEquipmentTankInstance] = useNavigationNumber('equipmentTank');
  const [rolesKind, setRolesKind] = useNavigationChoice('roleKind', ['tank', 'pet'], 'tank');
  const [rolesOpen, setRolesOpen] = useRouteDialog('roles');
  const [shopOpen, setShopOpen] = useRouteDialog('shop');
  const [textureOriginInstance, setTextureOriginInstance] = useNavigationNumber('textureTank');
  const [, setRoleInstance] = useNavigationNumber('roleInstance');
  const [historyOpen, setHistoryOpen] = useRouteDialog('history');
  const [historyIntroOpen, setHistoryIntroOpen] = useRouteDialog('history-intro');
  const [keysOpen, setKeysOpen] = useRouteDialog('keys');
  const [quickChatOpen, setQuickChatOpen] = useRouteDialog('settings');
  const [keyBindings, setKeyBindings] = useState(settings.keys.bindings);
  const [quickStart, setQuickStart] = useState(readQuickStart);
  const quickStartRequested = useRef(false);
  const startingQuickMatch = !validation && login.phase === 'lobby' && !!quickStart;
  const match = useSyncExternalStore(battle.matchPanel.subscribe, battle.matchPanel.getSnapshot, battle.matchPanel.getSnapshot);
  useLayoutEffect(() => {
    setButtonSoundBattleActive(match?.phase === 'PLAYING');
    return () => {setButtonSoundBattleActive(false);};
  }, [match?.phase]);
  const battleActive = !!match && match.phase !== 'WAITING'
    || login.restoring && (route.page === 'battle' || route.page === 'results');
  const matchLoading = match?.phase === 'LOADING'
    || match?.phase === 'PLAYING' && match.loading.progress < 1;
  const pageArtwork = usePageImages(battleActive, login.restoring || startingQuickMatch || matchLoading);
  const retryBattleAfterArtwork = useRef(false);
  useEffect(() => {
    if (!pageArtwork.ready || !retryBattleAfterArtwork.current) return;
    retryBattleAfterArtwork.current = false;
    battle.matchPanel.retryLoading?.();
  }, [battle, pageArtwork.ready]);
  function retryBattleLoading(): void {
    if (pageArtwork.error) {
      retryBattleAfterArtwork.current = true;
      pageArtwork.retry();
    } else battle.matchPanel.retryLoading?.();
  }
  const [mobile] = useState(isMobileDevice);
  const [scoreboardOpen, setScoreboardOpen] = useState(false);
  const [exitRequest, setExitRequest] = useState(0);
  useEffect(() => {setScoreboardOpen(false);}, [match?.roomId, match?.round, match?.phase]);
  useEffect(() => {
    if (validation || login.restoring || login.phase !== 'lobby' || !quickStart || quickStartRequested.current) return;
    quickStartRequested.current = true;
    void battle.startQuickMatch(quickStart.mapId, quickStart.tankId).catch(error => {
      hud.value = error instanceof Error ? error.message : String(error);
      showGameMessage(hud.value, 'error');
    }).finally(() => {setQuickStart(undefined);});
  }, [battle, hud, validation, login.restoring, login.phase, quickStart]);
  useEffect(() => {
    if (validation || login.restoring || login.phase !== 'lobby') return;
    if (battle.inRoom && match) navigateGame(roomPath(match.roomId, match.phase), true);
    else if (!battle.inRoom && route.roomId) navigateGame('/lobby', true);
  }, [battle, validation, login.restoring, login.phase, match?.roomId, match?.phase, route.page, route.roomId]);
  const settingsOrigin = useRef<HTMLButtonElement | null>(null);
  function closeKeys(): void {
    document.querySelector<HTMLDialogElement>('#key-settings')?.close();
    setKeysOpen(false);
    document.querySelector<HTMLButtonElement>('#open-key-settings')?.focus();
  }
  function closeQuickChat(): void {
    document.querySelector<HTMLDialogElement>(validation ? '#quick-chat-settings' : '#source-settings')?.close();
    setQuickChatOpen(false);
    const origin = settingsOrigin.current;
    settingsOrigin.current = null;
    if (origin?.isConnected && !origin.disabled) origin.focus();
    else document.querySelector<HTMLButtonElement>('#open-quick-chat-settings')?.focus();
  }
  function openSettingsFromHeader(): void {
    settingsOrigin.current = document.activeElement instanceof HTMLButtonElement ? document.activeElement : null;
    setQuickChatOpen(true);
  }
  const shopOrigin = useRef<HTMLButtonElement | null>(null);
  function openShop(): void {
    shopOrigin.current = document.activeElement instanceof HTMLButtonElement ? document.activeElement : null;
    setTextureOriginInstance(undefined);
    setShopOpen(true);
  }
  function closeShop(): void {
    document.querySelector<HTMLDialogElement>('#account-shop')?.close();
    setShopOpen(false);
    if (textureOriginInstance !== undefined) {
      setRolesKind('tank');
      setRolesOpen(true);
      return;
    }
    const origin = shopOrigin.current;
    if (origin?.isConnected && !origin.disabled) origin.focus();
    else document.querySelector<HTMLButtonElement>('#open-shop')?.focus();
  }
  function closeHistory(): void {
    document.querySelector<HTMLDialogElement>('#account-history')?.close();
    setHistoryOpen(false);
    document.querySelector<HTMLButtonElement>('#open-history')?.focus();
  }
  function closeRoles(): void {
    document.querySelector<HTMLDialogElement>('#home-roles')?.close();
    setRolesOpen(false);
    setTextureOriginInstance(undefined);
    document.querySelector<HTMLButtonElement>('#open-roles, [data-room-card-home]')?.focus();
  }
  function closeEquipment(): void {
    document.querySelector<HTMLDialogElement>('#home-equipment')?.close();
    setEquipmentOpen(false);
    setEquipmentTankInstance(undefined);
    const origin = document.querySelector<HTMLButtonElement>('#home-inventory[open] #open-equipment')
      ?? document.querySelector<HTMLButtonElement>(validation ? '#battle-controls #open-equipment' : '[data-room-card-home]');
    origin?.focus();
  }
  const inventoryOrigin = useRef<HTMLButtonElement | null>(null);
  function openInventory(): void {
    inventoryOrigin.current = document.activeElement instanceof HTMLButtonElement ? document.activeElement : null;
    setInventoryOpen(true);
  }
  function closeInventory(): void {
    document.querySelector<HTMLDialogElement>('#home-inventory')?.close();
    setInventoryOpen(false);
    const origin = inventoryOrigin.current;
    if (origin?.isConnected && !origin.disabled) origin.focus();
    else document.querySelector<HTMLButtonElement>('#open-home')?.focus();
  }
  useEffect(() => {
    if (!battleActive) return;
    settingsOrigin.current = null;
    shopOrigin.current = null;
    inventoryOrigin.current = null;
  }, [battleActive]);
  const restoringArtwork = !pageArtwork.ready;
  const restoringSession = !validation && login.restoring;
  const artworkProgress = pageArtwork.ready ? 1 : pageArtwork.progress
    ? (pageArtwork.progress.completed + pageArtwork.progress.decoded)
      / Math.max(1, pageArtwork.progress.total + pageArtwork.progress.decodeTotal) : 0;
  const loadingError = pageArtwork.error || (matchLoading ? match?.loading.error : undefined);
  const loadingStatus = restoringSession ? '正在恢复游戏会话…'
    : startingQuickMatch ? '正在创建自动托管对局…' : matchLoading && match
    ? match.status || `${match.loading.status}${match.loading.progress === 1
      ? `（${match.loadedPlayers}/${match.loadingPlayers} 人）` : ''}` : '正在准备界面…';
  const loadingProgress = restoringSession || startingQuickMatch ? undefined : matchLoading && match
    ? artworkProgress * 0.1 + match.loading.progress * 0.9 : artworkProgress;
  const loadingPage = restoringSession || startingQuickMatch || restoringArtwork || matchLoading ? {
    progress: loadingProgress, status: loadingStatus, error: loadingError || undefined,
    'aria-label': matchLoading ? '正在载入对局' : loadingStatus, 'aria-busy': !loadingError,
    className: matchLoading ? 'battle-loading-page' : undefined,
    'data-match-panel': matchLoading ? '' : undefined, 'data-phase': matchLoading ? 'LOADING' : undefined,
    'data-round': matchLoading ? match?.round : undefined, 'data-battle-loading': matchLoading ? '' : undefined,
    'data-session-restoring': restoringSession ? '' : undefined, 'data-ui-restoring': restoringArtwork ? '' : undefined,
    actions: loadingError && <DialogButton type="button" disabled={!!match?.pending || restoringArtwork && !pageArtwork.error}
      onClick={matchLoading ? retryBattleLoading : pageArtwork.retry}>重新载入</DialogButton>,
  } : undefined;
  useLayoutEffect(() => {loadingScreen.setGameLoading(loadingPage);}, [loadingScreen, loadingPage]);
  return <>
    {!restoringSession && !restoringArtwork && !validation && login.phase !== 'lobby' && <>
    {login.phase === 'login' && <LoginSourceView busy={login.busy} status={login.status}
      savedAccount={login.savedAccount} hasSavedIdentity={login.hasSavedIdentity}
      saveAccount={login.saveAccount} onSaveAccount={login.setSaveAccount}
      onLogin={login.login} onRegister={login.register} onExit={login.exit}
      onSettings={()=>setQuickChatOpen(true)}/>}
    {login.phase === 'channel' && <ChannelSourceView busy={login.busy} status={login.status}
      channels={login.channels} ping={login.ping} selectedId={login.selectedId} onSelect={login.setSelectedId}
      onEnter={login.enter} onBack={login.back}/>}
    {login.phase === 'closed' && <main className="game-closed-page" aria-label="已退出游戏"><button type="button" onClick={login.reopen}>返回登录</button></main>}
    <HistoryIntroSourceView open={historyIntroOpen} close={()=>setHistoryIntroOpen(false)}/>
    <SettingsSourceView battle={battle} open={quickChatOpen} close={closeQuickChat} initial={settings} onKeysSaved={setKeyBindings}/>
    </>}
    {!restoringSession && (validation || login.phase === 'lobby') && <>
    <LobbyView battle={battle} canvas={canvas} hud={hud} validation={validation} artworkReady={!battleActive && pageArtwork.ready}
      headerContent={<TutorialSettingsBar onSettings={openSettingsFromHeader} onExit={login.back}/>}
      chatContent={mobile ? undefined : <LobbyChatView chat={battle.lobbyChat} presence={battle.lobbyPresence}/>} playerContent={<LobbySocialView battle={battle}/>} openInventory={openInventory}
      openEquipment={()=>{setEquipmentTankInstance(undefined);setEquipmentOpen(true);}} openRoles={()=>setRolesOpen(true)}
      openShop={openShop} openHistory={()=>setHistoryOpen(true)}/>
    {validation && <aside className="controls">
      <h1>猫狗大作战 · 验证</h1>
      <button id="fullscreen" type="button" onClick={()=>{
        void document.documentElement.requestFullscreen().catch(error=>{hud.value=String(error);showGameMessage(hud.value,'error');});
      }}>全屏</button>
      <button id="open-key-settings" type="button" onClick={()=>setKeysOpen(true)}>键位设置</button>
      <button id="open-quick-chat-settings" type="button" onClick={()=>setQuickChatOpen(true)}>快捷聊天设置</button>
      <button data-open-history-intro="" type="button" onClick={()=>setHistoryIntroOpen(true)}>原介绍整页</button>
      <VolumeSettingsView battle={battle} initial={settings.audio}/>
      <div id="battle-status-host" hidden ref={element=>{if(element && hud.parentElement!==element)element.append(hud);}}/>
      <KeyBindingsHint bindings={keyBindings}/>
    </aside>}
    {!validation && <div className="game-status" hidden ref={element=>{if(element && hud.parentElement!==element)element.append(hud);}}/>}
    {!restoringArtwork && <BattleMatchView validation={validation} panel={battle.matchPanel} exitRequest={exitRequest}/>}
    {!restoringArtwork && <BattleChatView chat={battle.chat} formal={!validation} mobile={mobile}/>}
    {battleActive && pageArtwork.ready && (mobile ? <MobileBattleHud battle={battle} scoreboardOpen={scoreboardOpen} onScoreboard={() => {
      battle.clearTouchInput(); battle.chat.closeEditor(); setScoreboardOpen(value => !value);
    }}/> : <BattleHudView hud={battle.originalHud} items={battle.itemInventory} onUseSlot={battle.useHudSlot}/>)}
    {battleActive && pageArtwork.ready && <BattleScoreboardView hud={battle.originalHud} bindings={keyBindings}
      open={mobile ? scoreboardOpen : undefined} onClose={() => setScoreboardOpen(false)}
      onLeave={mobile && match?.phase === 'PLAYING' ? () => {
        setScoreboardOpen(false); setExitRequest(value => value + 1);
      } : undefined}/>}
    {!battleActive && pageArtwork.ready && <>
    <HomeInventoryView onRolePage={kind => {setRolesKind(kind);setRoleInstance(undefined);setTextureOriginInstance(undefined);closeInventory();setRolesOpen(true);}} battle={battle} open={inventoryOpen} close={closeInventory}/>
    <HomeEquipmentView battle={battle} open={equipmentOpen} close={closeEquipment} tankInstanceId={equipmentTankInstance}
      onPlayerPage={() => {closeEquipment();openInventory();}}
      onRolePage={kind => {setRolesKind(kind);setRoleInstance(kind === 'tank' ? equipmentTankInstance : undefined);setTextureOriginInstance(kind === 'tank' ? equipmentTankInstance : undefined);closeEquipment();setRolesOpen(true);}}/>
    <HomeRolesView initialSelectedInstance={textureOriginInstance} onEquipmentPage={instanceId => {closeRoles();setEquipmentTankInstance(instanceId);setEquipmentOpen(true);}} onPlayerPage={() => {closeRoles();openInventory();}} initialKind={rolesKind} battle={battle} open={rolesOpen} close={closeRoles}/>
    <AccountShopView onEquipmentPage={() => {
      document.querySelector<HTMLDialogElement>('#account-shop')?.close();
      setShopOpen(false);
      setEquipmentTankInstance(undefined);
      setTextureOriginInstance(undefined);
      setEquipmentOpen(true);
    }} initialTextureInstance={textureOriginInstance} source={battle} open={shopOpen} close={closeShop}/>
    <AccountHistoryView source={battle} open={historyOpen} close={closeHistory}/>
    {validation && <HistoryIntroSourceView open={historyIntroOpen} close={()=>setHistoryIntroOpen(false)}/>}
    <KeySettingsView battle={battle} open={keysOpen} close={closeKeys} initial={settings.keys} onSaved={setKeyBindings}/>
    {validation ? <QuickChatSettingsView battle={battle} open={quickChatOpen} close={closeQuickChat} initial={settings.quickChat}/>
      : <SettingsSourceView battle={battle} open={quickChatOpen} close={closeQuickChat} initial={settings} onKeysSaved={setKeyBindings}/>}
    </>}
    </>}
  </>;
}
