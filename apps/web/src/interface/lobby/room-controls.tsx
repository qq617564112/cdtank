import {LobbyIdentityView} from './lobby-identity-view';
import {useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode} from 'react';
import {LobbySourcePage} from './lobby-source-page';
import {RoomPasswordDialog} from './room-password-dialog';
import type {Battle} from '../../match/battle';
import {tankCatalog} from '../../assets/tanks/tank-view';
import {RoomCards} from './room-cards';
import {RoomMapSelector} from './room-map-selector';
import {RoomCreateDialog} from './room-create-dialog';
import {RoomInvitations} from './room-invitations';
import type {RoomCreateDraft} from './room-create-draft';
import {validateRoomCreateDraft} from './room-create-draft';
import {canJoinRoom, orderRooms, roomDirectoryPage, type RoomSort} from './room-directory';
import type {MsgRoomInvitation} from '../../../../shared/protocols/MsgRoomInvitation';
import {useRoomInputLimit} from './room-input-limit';
import {ROOM_NAME_MAX_CODEPOINTS, ROOM_PASSWORD_MAX_CODEPOINTS} from '../../../../shared/room-input';
import {waitingRoomInfo} from './waiting-room-state';

interface LobbyViewProps {validation?: boolean; chatContent?: ReactNode; playerContent?: ReactNode; headerContent?: ReactNode; battle: Battle; canvas: HTMLCanvasElement; hud: HTMLOutputElement; openInventory: () => void; openEquipment: () => void; openRoles: () => void; openShop: () => void; openHistory: () => void}
const MODE_NAMES = ['团队', '占领', '擒王', '混战', '破坏'];
const INITIAL_DRAFT: RoomCreateDraft = {mode: 1, mapId: 0, roomName: '一起对战', password: '', minPlayers: 1, maxPlayers: 1, friendlyFire: false};

/** Lobby state owns ordinary controls and the original source layout dialogs. */
export function LobbyView({validation = false, chatContent, playerContent, headerContent, battle, canvas, hud, openInventory, openEquipment, openRoles, openShop, openHistory}: LobbyViewProps) {
  const match = useSyncExternalStore(battle.matchPanel.subscribe, battle.matchPanel.getSnapshot, battle.matchPanel.getSnapshot);
  const waiting = match?.phase === 'WAITING';
  const [playerName, setPlayerName] = useState('坦克手'), [tankId, setTankId] = useState(0);
  const [tanks, setTanks] = useState<Awaited<ReturnType<typeof tankCatalog>>>([]);
  const [maps, setMaps] = useState<Awaited<ReturnType<Battle['listMaps']>>>([]);
  const [directory, setDirectory] = useState<Awaited<ReturnType<Battle['listRooms']>>>([]);
  const [draft, setDraft] = useState<RoomCreateDraft>(INITIAL_DRAFT);
  const [mapError, setMapError] = useState(''), [cpuStatus, setCpuStatus] = useState('');
  const [sort, setSort] = useState<RoomSort>('ID'), [pageIndex, setPageIndex] = useState(0), [selectedId, setSelectedId] = useState('');
  const [joinPassword, setJoinPassword] = useState('');
  const [passwordRoom, setPasswordRoom] = useState(''), [status, setStatus] = useState('');
  const roomNameRef = useRef<HTMLInputElement>(null), createPasswordRef = useRef<HTMLInputElement>(null), joinPasswordRef = useRef<HTMLInputElement>(null);
  const nameInput = useRoomInputLimit(roomNameRef, ROOM_NAME_MAX_CODEPOINTS, value => setDraft(previous => ({...previous, roomName: value})));
  const createPasswordInput = useRoomInputLimit(createPasswordRef, ROOM_PASSWORD_MAX_CODEPOINTS, value => setDraft(previous => ({...previous, password: value})));
  const joinPasswordInput = useRoomInputLimit(joinPasswordRef, ROOM_PASSWORD_MAX_CODEPOINTS, setJoinPassword);
  const [busy, setBusy] = useState(false), [refreshing, setRefreshing] = useState(false), [leaving, setLeaving] = useState(false);
  const [inBattle, setInBattle] = useState(false), [cardsOpen, setCardsOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false), [createOpen, setCreateOpen] = useState(false);
  const [invitations, setInvitations] = useState<MsgRoomInvitation[]>([]);
  const createOrigin = useRef<'cards' | 'controls'>('controls');
  const createAfterMap = useRef(false);
  const entering = useRef(false), joinRef = useRef<HTMLButtonElement>(null);
  const page = roomDirectoryPage(orderRooms(directory, sort), pageIndex, selectedId);
  const map = maps.find(value => value.mode === draft.mode && value.mapId === draft.mapId);
  const createEnabled = !busy && !!map && tanks.length > 0;
  const cpuEnabled = !busy && tanks.length > 0 && maps.some(value => value.mode === 4 && value.mapId === 7);
  const resetMap = (mode: number, mapId: number) => {
    const selected = maps.find(value => value.mode === mode && value.mapId === mapId);
    setDraft(value => ({...value, mode, mapId, minPlayers: selected?.sourceMinPlayers ?? 1,
      maxPlayers: selected?.maxPlayers ?? 1, friendlyFire: mode <= 3 && value.friendlyFire}));
  };
  useEffect(() => {
    let active = true;
    void battle.listMaps().then(next => {
      if (!active) return;
      setMaps(next);
      setDraft(value => {
        const selected = next.find(option => option.mode === value.mode);
        return {...value, mapId: selected?.mapId ?? 0, minPlayers: selected?.sourceMinPlayers ?? 1, maxPlayers: selected?.maxPlayers ?? 1};
      });
    }).catch(error => {if (active) setMapError(`地图目录载入失败：${String(error)}`);});
    void tankCatalog().then(next => {if (active) {setTanks(next); setTankId(next[0]?.id ?? 0);}})
      .catch(error => {if (active) hud.value = String(error);});
    return () => {active = false;};
  }, [battle, hud]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const rooms = await battle.listRooms();
      setDirectory(rooms);
      const next = roomDirectoryPage(orderRooms(rooms, sort), page.page, page.selectedId, true);
      setPageIndex(next.page); setSelectedId(next.selectedId);
      hud.value = '选择房间，加入对战'; setStatus('选择房间，双击加入对战');
    } catch (error) {hud.value = String(error); setStatus(String(error));}
    finally {setRefreshing(false);}
  }, [battle, hud, sort, page.page, page.selectedId]);
  useEffect(() => {void refresh();}, [battle]);
  useEffect(() => {
    if (validation || inBattle) return;
    let active = true, polling = false;
    const timer = window.setInterval(() => {
      if (polling || busy || refreshing || document.hidden || document.querySelector('dialog[open]')) return;
      polling = true;
      void battle.listRooms().then(rooms => {
        if (!active) return;
        setDirectory(rooms);
        const next = roomDirectoryPage(orderRooms(rooms, sort), page.page, page.selectedId, true);
        setPageIndex(next.page); setSelectedId(next.selectedId);
      }).catch(error => {if (active) {hud.value = String(error); setStatus(String(error));}})
        .finally(() => {polling = false;});
    }, 5000);
    return () => {active = false; window.clearInterval(timer);};
  }, [validation, inBattle, busy, refreshing, battle, hud, sort, page.page, page.selectedId]);
  useEffect(() => {
    battle.setRoomExitHandler(() => {
      document.body.classList.remove('in-battle');
      setInBattle(false);
      void refresh().finally(() => requestAnimationFrame(() => {
        if (validation) joinRef.current?.focus();
        else document.querySelector<HTMLButtonElement>('[data-room-card-create]')?.focus();
      }));
    });
    return () => battle.setRoomExitHandler(undefined);
  }, [battle, refresh, validation]);
  useEffect(() => battle.onRoomInvitation(message => {
    if (inBattle || message.expiresAt <= Date.now()) return;
    setInvitations(current => {
      if (current.some(value => value.invitationId === message.invitationId)) return current;
      const remaining = current.filter(value => value.expiresAt > Date.now() && value.room.id !== message.room.id);
      return [...remaining.slice(-4), message];
    });
  }), [battle, inBattle]);

  function startEntering() {
    if (entering.current || inBattle) throw new Error('请先完成当前房间操作');
    entering.current = true; setBusy(true); setMapOpen(false);
  }
  function finishEntering() {entering.current = false; setBusy(false);}
  function showBattle() {
    if (!battle.inRoom) return;
    setInvitations([]); setPasswordRoom(''); setCardsOpen(false); setMapOpen(false); setCreateOpen(false);
    setInBattle(true); document.body.classList.add('in-battle');
    requestAnimationFrame(() => {
      if (battle.matchPanel.getSnapshot()?.phase === 'PLAYING') canvas.focus();
      else document.querySelector<HTMLButtonElement>('[data-waiting-ready]')?.focus();
    });
  }
  async function join(roomId: string, password: string) {
    startEntering();
    try {await battle.join(roomId, playerName, tankId, password); setJoinPassword(''); showBattle();}
    finally {finishEntering();}
  }
  async function createRoom(next: RoomCreateDraft) {
    if (entering.current) throw new Error('请等待当前入房操作完成');
    validateRoomCreateDraft(next, maps.find(value => value.mode === next.mode && value.mapId === next.mapId));
    startEntering();
    try {
      await battle.createRoom(next.mode, next.mapId, next.roomName, playerName, tankId, next.password, next.minPlayers, next.maxPlayers, next.friendlyFire);
      setDraft({...next, password: ''}); showBattle();
    } finally {finishEntering();}
  }
  async function startCpu() {
    startEntering(); setCpuStatus('正在创建对局并载入地图与 CPU…');
    try {await battle.startCpuMatch(playerName, tankId); setCpuStatus(''); showBattle();}
    catch (error) {
      const message = `CPU 对局失败：${error instanceof Error ? error.message : String(error)}`;
      setCpuStatus(message); hud.value = message;
    } finally {finishEntering();}
  }
  function report(operation: Promise<void>) {void operation.catch(error => {hud.value = String(error); setStatus(String(error));});}
  function activateRoom(roomId: string) {
    const room = directory.find(value => value.id === roomId);
    if (!room || !canJoinRoom(room) || busy || refreshing) return;
    setSelectedId(roomId);
    if (room.hasPassword) setPasswordRoom(roomId);
    else report(join(roomId, ''));
  }
  function changeSort(value: RoomSort) {
    const nextPage = roomDirectoryPage(orderRooms(directory, value), 0, page.selectedId);
    setSort(value); setPageIndex(nextPage.page); setSelectedId(nextPage.selectedId);
  }
  function changePage(index: number) {
    const nextPage = roomDirectoryPage(orderRooms(directory, sort), index, page.selectedId);
    setPageIndex(nextPage.page); setSelectedId(nextPage.selectedId);
  }
  const previous = () => changePage(page.page - 1), next = () => changePage(page.page + 1);
  const roomCards = <RoomCards embedded={!validation} open={validation ? cardsOpen : !inBattle} close={() => setCardsOpen(false)} rooms={page.rooms} selectedId={page.selectedId} page={page.page} pages={page.pages}
      sort={sort} busy={busy || refreshing} openInventory={openInventory} openShop={openShop} createEnabled={createEnabled && !refreshing} createRoom={() => {
        if (!createEnabled || refreshing) return;
        createOrigin.current = 'cards';
        if (validation) setCreateOpen(true);
        else {createAfterMap.current = true; setMapOpen(true);}
      }} select={setSelectedId} activate={activateRoom} changeSort={changeSort} previous={previous} next={next} refresh={() => {void refresh();}} join={() => validation ? report(join(page.selectedId, joinPassword)) : activateRoom(page.selectedId)}/>;
  return <>
    {!validation && <LobbySourcePage visible={!inBattle || waiting} room={waiting}
      roomName={match?.waiting ? waitingRoomInfo(match.waiting).name : ''} status={waiting ? '' : status}
      chatContent={waiting ? undefined : chatContent} playerContent={playerContent}
      headerContent={!inBattle && !waiting ? headerContent : undefined}>
      {roomCards}
      <RoomInvitations formal messages={invitations} ignore={id => setInvitations(current => current.filter(value => value.invitationId !== id))}
        join={(message, password) => join(message.room.id, password)}/>
    </LobbySourcePage>}
    {validation && <div id="battle-controls" hidden={inBattle}>
      <LobbyIdentityView battle={battle} visible={!inBattle}/>
      <label htmlFor="validation-room-name">入房显示名</label>
      <input id="validation-room-name" value={playerName} maxLength={16} onChange={event => setPlayerName(event.target.value)}/>
      <label htmlFor="tank">战车</label>
      <select id="tank" value={tankId} onChange={event => setTankId(Number(event.target.value))}>
        {tanks.map(tank => <option key={tank.id} value={tank.id}>{tank.name}</option>)}
      </select>
      <button id="start-cpu" type="button" disabled={!cpuEnabled} aria-busy={busy || undefined} onClick={() => report(startCpu())}>一键 CPU 对局</button>
      <output id="cpu-status" aria-live="polite">{cpuStatus}</output>
      <button id="open-home" type="button" onClick={openInventory}>我的家：物品</button>
      <button id="open-equipment" type="button" onClick={openEquipment}>我的家：战车部件</button>
      <button id="open-roles" type="button" onClick={openRoles}>我的家：战车与宠物</button>
      <button id="open-shop" data-account-shop-open="" type="button" onClick={openShop}>道具商店</button>
      <button id="open-history" data-account-history-open="" type="button" onClick={openHistory}>我的对局记录</button>
      <button id="refresh-rooms" type="button" disabled={refreshing} onClick={() => {void refresh();}}>查看房间</button>
      <button id="open-room-cards" type="button" onClick={() => setCardsOpen(true)}>房间卡片</button>
      <label htmlFor="room">房间</label>
      <select id="room" value={page.selectedId} onChange={event => setSelectedId(event.target.value)}>
        {page.rooms.map(room => <option key={room.id} value={room.id} disabled={!canJoinRoom(room)}>
          {`${room.name} (${room.playerCount}/${room.maxPlayers})${room.minPlayers !== undefined ? ` · 至少 ${room.minPlayers} 人开局` : ''}${room.mode <= 3 ? room.friendlyFire ? ' · 友伤开启' : ' · 友伤关闭' : ''}${room.hasPassword ? ' · 密码房' : ''}${room.phase === 'PLAYING' ? ' · 对战中' : room.phase === 'FINISHED' ? ' · 等待再战' : ''}`}
        </option>)}
      </select>
      <label htmlFor="room-sort">房间排序</label>
      <select id="room-sort" value={sort} onChange={event => changeSort(event.target.value as RoomSort)}>
        <option value="ID">编号排序</option><option value="EMPTY">空房间优先</option>
      </select>
      <div aria-label="房间翻页">
        <button id="room-page-previous" type="button" disabled={busy || page.page === 0} onClick={previous}>上一页</button>
        <output id="room-page-status" aria-live="polite">{`${page.pages ? page.page + 1 : 0} / ${page.pages}`}</output>
        <button id="room-page-next" type="button" disabled={busy || page.page + 1 >= page.pages} onClick={next}>下一页</button>
      </div>
      <label htmlFor="join-password">房间密码（锁定房间需要）</label>
      <input ref={joinPasswordRef} id="join-password" type="password" autoComplete="off" value={joinPassword} {...joinPasswordInput}/>
      <button ref={joinRef} id="join" type="button" disabled={busy || !page.selectedId} onClick={() => report(join(page.selectedId, joinPassword))}>加入对战</button>
      <details id="create-room-controls">
        <summary>创建房间</summary>
        <label htmlFor="room-name">房间名称</label>
        <input ref={roomNameRef} id="room-name" value={draft.roomName} {...nameInput}/>
        <label htmlFor="create-password">房间密码（留空为公开）</label>
        <input ref={createPasswordRef} id="create-password" type="password" autoComplete="new-password" value={draft.password} {...createPasswordInput}/>
        <label htmlFor="room-mode">模式</label>
        <select id="room-mode" value={draft.mode} onChange={event => {
          const mode = Number(event.target.value); resetMap(mode, maps.find(value => value.mode === mode)?.mapId ?? 0);
        }}>{MODE_NAMES.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}</select>
        <label htmlFor="room-map">地图</label>
        <select id="room-map" aria-describedby="room-map-info" value={draft.mapId} onChange={event => resetMap(draft.mode, Number(event.target.value))}>
          {maps.filter(value => value.mode === draft.mode).map(value => <option key={value.mapId} value={value.mapId}>{value.name}</option>)}
        </select>
        <output id="room-map-info">{mapError || (map ? `时限 ${map.timeLimit} 秒 · 地图人数 ${map.sourceMinPlayers}–${map.maxPlayers}` : '没有可用地图')}</output>
        <button id="open-room-map-selector" type="button" disabled={busy || !maps.length} onClick={() => setMapOpen(true)}>选择模式与地图</button>
        <label htmlFor="room-min-players">开局人数下限</label>
        <input id="room-min-players" type="number" min={map?.sourceMinPlayers ?? 1} max={map?.maxPlayers ?? 1} step="1" value={Number.isNaN(draft.minPlayers) ? '' : draft.minPlayers}
          disabled={!map} onChange={event => setDraft({...draft, minPlayers: event.target.valueAsNumber})}/>
        <label htmlFor="room-max-players">房间人数上限</label>
        <input id="room-max-players" type="number" min={map?.sourceMinPlayers ?? 1} max={map?.maxPlayers ?? 1} step="1" value={Number.isNaN(draft.maxPlayers) ? '' : draft.maxPlayers}
          disabled={!map} onChange={event => setDraft({...draft, maxPlayers: event.target.valueAsNumber})}/>
        <label htmlFor="room-friendly-fire">允许伤害队友</label>
        <input id="room-friendly-fire" type="checkbox" checked={draft.friendlyFire} disabled={draft.mode > 3} onChange={event => setDraft({...draft, friendlyFire: event.target.checked})}/>
        <button id="open-room-create-dialog" type="button" disabled={!createEnabled} onClick={() => {createOrigin.current = 'controls'; setCreateOpen(true);}}>原建房窗口</button>
        <button id="create-room" type="button" disabled={!createEnabled} onClick={() => report(createRoom(draft))}>创建并加入</button>
      </details>
      <RoomInvitations messages={invitations} ignore={id => setInvitations(current => current.filter(value => value.invitationId !== id))}
        join={(message, password) => join(message.room.id, password)}/>
    </div>}
    {validation && roomCards}
    <button id="leave" type="button" hidden={!inBattle || !validation} disabled={leaving} onClick={() => {
      setLeaving(true); void battle.exitRoom().catch(error => {hud.value = String(error);}).finally(() => setLeaving(false));
    }}>返回</button>
    {passwordRoom && <RoomPasswordDialog key={passwordRoom} roomId={passwordRoom} close={() => {
      setPasswordRoom(''); requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(`[data-room-card-id="${passwordRoom}"]`)?.focus());
    }} submit={password => join(passwordRoom, password)}/>}
    {mapOpen && <RoomMapSelector open close={() => {
      document.querySelector<HTMLDialogElement>('[data-room-map-selector]')?.close();
      document.querySelector<HTMLButtonElement>(validation ? '#open-room-map-selector' : '[data-room-card-create]')?.focus();
      setMapOpen(false);
      createAfterMap.current = false;
    }} maps={maps} busy={busy} initialMode={draft.mode} initialMapId={draft.mapId}
      confirm={(mode, mapId) => {
        if (busy || !maps.some(value => value.mode === mode && value.mapId === mapId)) return false;
        resetMap(mode, mapId);
        if (createAfterMap.current) setCreateOpen(true);
        return true;
      }}/>} 
    {createOpen && <RoomCreateDialog open close={() => {
      document.querySelector<HTMLDialogElement>('[data-room-create-dialog]')?.close();
      document.querySelector<HTMLButtonElement>(createOrigin.current === 'cards' ? '[data-room-card-create]' : '#open-room-create-dialog')?.focus();
      setCreateOpen(false);
    }} initialDraft={draft} map={map} submit={createRoom}/>}
  </>;
}
