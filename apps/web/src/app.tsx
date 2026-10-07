import {useEffect, useRef, useState, useSyncExternalStore} from 'react';
import type {Battle} from './match/battle';
import {LobbyView} from './interface/lobby/room-controls';
import {LobbyChatView} from './interface/lobby/lobby-chat-view';
import {LobbySocialView} from './interface/lobby/lobby-social-view';
import {BattleMatchView} from './interface/battle/battle-match';
import {BattleChatView} from './interface/battle/battle-chat-view';
import {BattleHudView} from './interface/battle/battle-hud-view';
import {GmSupportView} from './interface/support/gm-support-view';
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

interface AppProps {battle: Battle; canvas: HTMLCanvasElement; hud: HTMLOutputElement; settings: InitialSettings; validation?: boolean;}

/** One page root; scene and transport remain independent of React render cycles. */
export function App({battle,canvas,hud,settings,validation=false}: AppProps) {
  const login = useLoginNavigation(battle, validation);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [equipmentOpen, setEquipmentOpen] = useState(false);
  const [equipmentTankInstance, setEquipmentTankInstance] = useState<number>();
  const [rolesKind, setRolesKind] = useState<'tank' | 'pet'>('tank');
  const [rolesOpen, setRolesOpen] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const [textureOriginInstance, setTextureOriginInstance] = useState<number>();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyIntroOpen, setHistoryIntroOpen] = useState(false);
  const [keysOpen, setKeysOpen] = useState(false);
  const [quickChatOpen, setQuickChatOpen] = useState(false);
  const [keyBindings, setKeyBindings] = useState(settings.keys.bindings);
  const accountGeneration = useSyncExternalStore(
    listener => battle.subscribeAccountContext(listener),
    () => battle.accountContext.generation,
    () => 0,
  );
  useEffect(() => {
    setEquipmentTankInstance(undefined);
    setTextureOriginInstance(undefined);
  }, [login.phase, accountGeneration]);
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
  if (!validation && login.phase !== 'lobby') return <>
    {login.phase === 'login' && <LoginSourceView busy={login.busy} status={login.status}
      savedAccount={login.savedAccount} hasSavedIdentity={login.hasSavedIdentity}
      saveAccount={login.saveAccount} onSaveAccount={login.setSaveAccount}
      onLogin={login.login} onRegister={login.register} onExit={login.exit}
      onSettings={()=>setQuickChatOpen(true)} onHistoryIntro={()=>setHistoryIntroOpen(true)}/>}
    {login.phase === 'channel' && <ChannelSourceView busy={login.busy} status={login.status}
      channels={login.channels} selectedId={login.selectedId} onSelect={login.setSelectedId}
      onEnter={login.enter} onBack={login.back} onExit={login.exit}/>}
    {login.phase === 'closed' && <main aria-label="已退出游戏"><button type="button" onClick={login.reopen}>返回登录</button></main>}
    <HistoryIntroSourceView open={historyIntroOpen} close={()=>setHistoryIntroOpen(false)}/>
    <SettingsSourceView battle={battle} open={quickChatOpen} close={closeQuickChat} initial={settings} onKeysSaved={setKeyBindings}/>
  </>;
  return <>
    <LobbyView battle={battle} canvas={canvas} hud={hud} validation={validation}
      headerContent={<TutorialSettingsBar onSettings={openSettingsFromHeader} onExit={login.exit}/>}
      chatContent={<LobbyChatView chat={battle.lobbyChat} presence={battle.lobbyPresence}/>} playerContent={<LobbySocialView battle={battle}/>} openInventory={openInventory}
      openEquipment={()=>{setEquipmentTankInstance(undefined);setEquipmentOpen(true);}} openRoles={()=>setRolesOpen(true)}
      openShop={openShop} openHistory={()=>setHistoryOpen(true)}/>
    {!validation && <GmSupportView inbox={battle.gmSupport}/>}
    {validation && <aside className="controls">
      <h1>猫狗大作战 · 验证</h1>
      <button id="fullscreen" type="button" onClick={()=>{
        void document.documentElement.requestFullscreen().catch(error=>{hud.value=String(error);});
      }}>全屏</button>
      <button id="open-key-settings" type="button" onClick={()=>setKeysOpen(true)}>键位设置</button>
      <button id="open-quick-chat-settings" type="button" onClick={()=>setQuickChatOpen(true)}>快捷聊天设置</button>
      <button data-open-history-intro="" type="button" onClick={()=>setHistoryIntroOpen(true)}>原介绍整页</button>
      <VolumeSettingsView battle={battle} initial={settings.audio}/>
      <div id="battle-status-host" ref={element=>{if(element && hud.parentElement!==element)element.append(hud);}}/>
      <KeyBindingsHint bindings={keyBindings}/>
    </aside>}
    {!validation && <div className="game-status" ref={element=>{if(element && hud.parentElement!==element)element.append(hud);}}/>}
    <BattleMatchView validation={validation} panel={battle.matchPanel}/>
    <BattleChatView chat={battle.chat} formal={!validation}/>
    <BattleHudView hud={battle.originalHud} items={battle.itemInventory} onUseSlot={battle.useHudSlot}/>
    <HomeInventoryView onRolePage={kind => {setRolesKind(kind);closeInventory();setRolesOpen(true);}} battle={battle} open={inventoryOpen} close={closeInventory} navigation={!validation ? <>
      <button id="open-history" type="button" onClick={()=>setHistoryOpen(true)}>对局记录</button>
      <button id="open-key-settings" type="button" onClick={()=>setKeysOpen(true)}>键位设置</button>
      <button id="open-quick-chat-settings" type="button" onClick={()=>setQuickChatOpen(true)}>系统设置</button>
    </> : undefined}/>
    <HomeEquipmentView battle={battle} open={equipmentOpen} close={closeEquipment} tankInstanceId={equipmentTankInstance}
      onPlayerPage={() => {closeEquipment();openInventory();}}
      onRolePage={kind => {
        setRolesKind(kind);setTextureOriginInstance(kind === 'tank' ? equipmentTankInstance : undefined);
        closeEquipment();setRolesOpen(true);
      }}/>
    <HomeRolesView initialSelectedInstance={textureOriginInstance} onTexturePage={instanceId => {
      closeRoles();
      setTextureOriginInstance(instanceId);
      setShopOpen(true);
    }} onEquipmentPage={instanceId => {closeRoles();setEquipmentTankInstance(instanceId);setEquipmentOpen(true);}} onPlayerPage={() => {closeRoles();openInventory();}} initialKind={rolesKind} battle={battle} open={rolesOpen} close={closeRoles}/>
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
  </>;
}
