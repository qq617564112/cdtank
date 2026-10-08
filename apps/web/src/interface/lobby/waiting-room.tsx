import {imageResourceBackground} from '../../assets/image-cache';
import './waiting-room.css';
import {Fragment, useEffect, useLayoutEffect, useRef, useState} from 'react';
import type {ComponentPropsWithoutRef, KeyboardEvent, SyntheticEvent} from 'react';
import type {MsgRoomSnapshot} from '../../../../shared/protocols';
import {SourceButton} from '../resources/source-button';
import {SourceImageScale, SourceStaticImage} from '../resources/source-static-image';
import {SourceStaticText} from '../resources/source-static-text';
import {SourceMultilineReading} from '../resources/source-multiline-reading';
import {SourceFeedbackText} from '../resources/source-feedback-text';
import {sourceProps} from '../resources/source-ui-props';
import {sourceUiImage} from '../resources/source-ui-image';
import {loadUiFont} from '../resources/source-ui-fonts';
import {loadSourceUi} from '../resources/source-ui-resources';
import {HomeSourceLayout} from '../resources/source-ui-layout';
import type {HomeSourceUi} from '../resources/source-ui-layout';
import {roomModeIconReference} from './room-mode-icons';
import {SourceNotice} from '../dialogs/source-notice';
import {SourceNoticeView} from '../dialogs/source-notice-view';
import {waitingRoomSlots, waitingTankReference, waitingRoomInfo} from './waiting-room-state';
import {WaitingRoomResourceFeedback} from './waiting-room-resource-feedback';
import {roomMapPreviewReference} from './room-map-options';
import {RoomEditDialog} from './room-edit-dialog';
import type {RoomEditor} from './room-edit-dialog';
import type {MapOption} from '../../../../shared/protocols/PtlListMaps';
import {WaitingRoomSlotActions} from './waiting-room-slot-actions';
import {PlayerInfoView} from './player-info';

export interface WaitingRoomActions {
  ready(isReady: boolean): Promise<void>;
  team(team: number): Promise<void>;
  leave(): Promise<void>;
  invite(): Promise<number>;
}

export interface WaitingRoomViewProps {
  formal?: boolean;
  addRobot?: (team?: number) => Promise<void>;
  roomEditor?: RoomEditor;
  kickPlayer?: (playerId: string) => Promise<void>;
  snapshot: MsgRoomSnapshot;
  playerId: string;
  externalBusy: boolean;
  readyAvailable?: boolean;
  actions: WaitingRoomActions;
}

function sourceAsset(ui: HomeSourceUi, reference: string | undefined): string | undefined {
  return sourceUiImage(ui, reference).asset;
}


type SourceImageProps = ComponentPropsWithoutRef<'span'> & {
  ui: HomeSourceUi;
  name: string;
  reference?: string;
  text?: string;
};

function SourceImage({ui, name, reference, text, ...props}: SourceImageProps) {
  const layout = new HomeSourceLayout(ui, 'room_main.xml');
  const control = layout.control(name);
  if (control.type === 'WindowsLook/StaticText') {
    return <SourceStaticText ui={ui} layout={layout} suffix="room_main.xml" name={name} text={text ?? ''} {...props}/>;
  }
  if (control.type === 'WindowsLook/StaticImage') {
    return <SourceStaticImage ui={ui} layout={layout} suffix="room_main.xml" name={name} reference={reference} {...props}>{text}</SourceStaticImage>;
  }
  return <span {...sourceProps(ui, layout, 'room_main.xml', name, reference)} {...props}>{text}</span>;
}

function waitingScale(formal = false): number {
  if (formal) return Math.max(.25, Math.min(innerWidth / 800, innerHeight / 600));
  return Math.max(.25, Math.min((innerWidth - 64) / 615, (innerHeight - 180) / 391, 2));
}

function waitingTeamName(mode: number, team: number): string {
  if (mode > 3) return '个人战';
  return team === 0 ? '猫队' : team === 1 ? '狗队' : `队伍 ${team}`;
}

/** The room and round own the waiting dialog's requests and presentation state. */
export function WaitingRoomView(props: WaitingRoomViewProps) {
  return <WaitingRoomSession key={`${props.snapshot.roomId}:${props.snapshot.match?.round}:${props.snapshot.phase}`}
    {...props} />;
}

function WaitingRoomSession({formal = false, addRobot, roomEditor, kickPlayer, snapshot, playerId, externalBusy, readyAvailable = true, actions}: WaitingRoomViewProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(formal);
  const [ui, setUi] = useState<HomeSourceUi | null>(null);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [operation, setOperation] = useState('');
  const [inviteUntil, setInviteUntil] = useState(0);
  const [editMaps, setEditMaps] = useState<MapOption[] | undefined>(undefined);
  const [detailsId, setDetailsId] = useState<string | undefined>(undefined);
  const [scale, setScale] = useState(() => waitingScale(formal));
  const generation = useRef(0);
  const pending = useRef(false);
  const focusedControl = useRef<string | undefined>(undefined);
  const [notice] = useState(() => new SourceNotice());
  const match = snapshot.match;
  const available = snapshot.phase === 'WAITING' && !!match;
  const requesting = busy || externalBusy;
  const detailsPlayer = snapshot.players.find(player => player.id === detailsId);
  const disabled = requesting || !!editMaps || !!detailsPlayer;
  const invited = Date.now() < inviteUntil;

  useEffect(() => {
    const resize = () => setScale(waitingScale(formal));
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      generation.current++;
      notice.clear();
    };
  }, []);

  useEffect(() => {
    if (!open || ui) return;
    let active = true;
    setLoadError('');
    void loadUiFont().catch(() => {});
    void (async () => {
      try {
        const loaded = await loadSourceUi();
        if (!loaded.layouts.some(layout => layout.path.endsWith('room_main.xml'))) {
          throw new Error('原等待房间布局缺失');
        }
        if (active) setUi(loaded);
      } catch {
        if (active) setLoadError('等待房间界面资源未能载入，请返回大厅后重新进入。');
      }
    })();
    return () => {active = false;};
  }, [open, ui]);

  useLayoutEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && available) {
      if (!element.open) {if (formal) element.show(); else element.showModal();}
    } else if (element.open) element.close();
  }, [open, available, formal]);

  useEffect(() => {
    if (!invited) return;
    const timer = window.setTimeout(() => setInviteUntil(0), Math.max(0, inviteUntil - Date.now()));
    return () => window.clearTimeout(timer);
  }, [inviteUntil, invited]);

  useLayoutEffect(() => {
    if (!open || disabled || !ui || !focusedControl.current) return;
    const active = document.activeElement;
    if (active && active !== document.body && !dialog.current?.contains(active)) return;
    const previous = dialog.current?.querySelector<HTMLButtonElement>(
      `[data-waiting-control="${focusedControl.current}"]`);
    const ready = dialog.current?.querySelector<HTMLButtonElement>('[data-waiting-ready]');
    (previous && !previous.disabled ? previous : ready)?.focus();
  }, [open, disabled, ui]);

  async function request(action: () => Promise<void>, nextOperation: string): Promise<void> {
    if (pending.current || externalBusy || !available) return;
    const current = generation.current;
    pending.current = true; setBusy(true); setError(''); setOperation(nextOperation);
    try {await action();} catch (cause) {
      if (current === generation.current) {
        const message = cause instanceof Error ? cause.message : String(cause);
        setError(message);
        await notice.show(message);
      }
    } finally {
      if (current === generation.current) {pending.current = false; setBusy(false); setOperation('');}
    }
  }

  function close(): void {
    if (formal) return;
    focusedControl.current = undefined;
    setOpen(false);
    opener.current?.focus();
  }

  function isolateKeyboard(event: KeyboardEvent<HTMLDialogElement>): void {
    event.stopPropagation();
    if (event.nativeEvent.isComposing || event.keyCode === 229) event.preventDefault();
  }

  const local = snapshot.players.find(player => player.id === playerId);
  const ready = !!match?.readyPlayerIds.includes(playerId);
  const info = waitingRoomInfo(snapshot);
  const {slots, overflow} = waitingRoomSlots(snapshot);
  const robotSlots = snapshot.mode <= 3 ? [0, 6].map(start => {
    const empty = slots.slice(start, start + 6).findIndex(player => !player);
    return empty >= 0 && empty < Math.ceil((match?.maxPlayers ?? 12) / 2) ? start + empty : -1;
  }) : [slots.findIndex(player => !player)];
  const canAddRobot = !!addRobot && snapshot.players.length < (match?.maxPlayers ?? 12);
  const operationLabel = operation === 'leave' ? '正在退出房间…' : operation === 'ready' ? '正在提交准备状态…'
    : operation === 'team' ? '正在换队…' : operation === 'invite' ? '正在发送邀请…'
    : operation === 'addRobot' ? '正在新增机器人…' : operation === 'editRoom' ? '正在载入房间编辑…'
    : operation === 'kickPlayer' ? '正在踢出成员…' : '';
  const image = (name: string, shown = true, text?: string) => ui &&
    <SourceImage key={name} ui={ui} name={name} hidden={!shown} text={text} />;
  const layout = ui ? new HomeSourceLayout(ui, 'room_main.xml') : undefined;
  const previewAsset = ui && snapshot.roomInfo ? sourceAsset(ui, roomMapPreviewReference(snapshot.roomInfo.mapId)) : undefined;
  const editButtonAsset = ui ? sourceAsset(ui, new HomeSourceLayout(ui, 'playerlist.xml')
    .control('datingmingchengditu').properties.Image) : undefined;
  const modeProps = ui && layout ? sourceProps(ui, layout, 'room_main.xml', 'picGameMode', roomModeIconReference(snapshot.mode)) : undefined;
  const controlProps = {disabled, onFocus: (event: SyntheticEvent<HTMLButtonElement>) => {
    focusedControl.current = event.currentTarget.dataset.waitingControl;
  }};
  const statusState = loadError ? 'error' : !ui ? 'loading' : error ? 'error' : requesting ? 'pending'
    : invited ? 'confirmation' : 'normal';
  const statusText = loadError || (!ui ? '正在载入原等待房间…' : error || (requesting
    ? operationLabel || '正在提交，请等待服务器确认…' : invited ? '邀请已发送给大厅玩家，30秒后可再次邀请'
    : `${snapshot.roomId} · 已准备 ${match?.readyPlayerIds.length ?? 0}/${snapshot.players.length}`));
  const status = <output role="status" data-waiting-room-status="" data-waiting-room-operation={operation || undefined}
    data-waiting-room-status-state={statusState} aria-busy={requesting}>{statusText}</output>;
  const overflowList = <ul data-waiting-room-overflow="" className="waiting-room-overflow-list" hidden={overflow.length === 0}>
    {overflow.map(player => <li key={player.id}>
      <span>{player.name}</span>
      <span>{waitingTeamName(snapshot.mode, player.team)} · 战车 {player.tankId} · {match?.readyPlayerIds.includes(player.id) ? '已准备' : '未准备'}{player.isCpu ? ' · CPU' : ''}</span>
    </li>)}
  </ul>;

  return <>
    {!formal && <button ref={opener} type="button" data-open-waiting-room="" hidden={!available}
      disabled={externalBusy} onClick={() => setOpen(true)}>查看原等待房间</button>}
    <dialog ref={dialog} data-waiting-room="" aria-label="等待房间"
      data-waiting-room-formal={formal || undefined}
      data-waiting-room-operation={operation || undefined}
      aria-busy={requesting}
      onCancel={event => {event.preventDefault(); close();}}
      onKeyDown={isolateKeyboard} onKeyUp={isolateKeyboard}
      onMouseDown={event => event.stopPropagation()} onMouseUp={event => event.stopPropagation()}
      onClick={event => event.stopPropagation()} onWheel={event => event.stopPropagation()}>
      <div className="waiting-room-viewport" style={{width: (formal ? 800 : 615) * scale, height: (formal ? 600 : 400) * scale}}>
        <div data-waiting-room-stage="" className="waiting-room-stage" style={{transform: `scale(${scale})`}}>
          {!ui && loadError && <WaitingRoomResourceFeedback error={loadError} pending={disabled}
            leave={() => {void request(() => actions.leave(), 'leave');}} />}
          {open && ui && match && available && <SourceImageScale value={scale}>
            {['ditu', 'maogouditu', 'maogouditu2', 'zhongjianditu', 'fenhongdi1', 'fenhongdi2', 'tiao', 'kuang', 'dituguize', 'renshu', 'daos', 'meijushijian', 'sec'].map(name => image(name))}
            {snapshot.roomInfo && <span className="waiting-room-map-preview" role="img" aria-label={`${info.mapName}地图预览`}
              data-waiting-map-preview={snapshot.roomInfo.mapId} style={{backgroundImage: previewAsset ? imageResourceBackground(`/${previewAsset}`) : undefined}}/>}
            <button type="button" className="waiting-room-edit" data-waiting-control="editRoom" data-room-edit=""
              aria-label="房间编辑" title={roomEditor ? '编辑房间地图、模式、人数和密码' : '只有房主可以编辑房间'}
              {...controlProps} disabled={disabled || !readyAvailable || !roomEditor || !snapshot.roomInfo || match.maxPlayers === undefined}
              style={{backgroundImage: editButtonAsset ? imageResourceBackground(`/${editButtonAsset}`) : undefined}}
              onClick={() => {
                const current = generation.current;
                void request(async () => {
                  const maps = await roomEditor!.listMaps();
                  if (!maps.length) throw new Error('暂无可用地图，请稍后重试');
                  if (current === generation.current) setEditMaps(maps);
                }, 'editRoom');
              }}><SourceFeedbackText text="房间编辑"/></button>
            {image('txtMinPlayer', true, String(match.minPlayers))}
            {image('txtMaxPlayer', true, match.maxPlayers === undefined ? '—' : String(match.maxPlayers))}
            <span className="waiting-room-map-name" title={info.mapName}><SourceFeedbackText text={info.mapName}/></span>
            {image('txtGameTime', true, info.time)}
            <SourceStaticImage ui={ui} layout={layout!} suffix="room_main.xml" name="picLocked" hidden={!info.locked}
              offsetX={182} offsetY={29}/>
            <SourceMultilineReading ui={ui} layout={layout!} suffix="room_main.xml" name="edtMapDesc" text={info.description}/>
            <span {...modeProps} style={{...modeProps!.style, left: 264, top: 179, width: 79, height: 17}}
              aria-label={['团队模式', '占领模式', '擒王模式', '混战模式', '破坏模式'][snapshot.mode - 1]}/>
            {image('picCatVsDog', snapshot.mode <= 3)}
            {image('picNonCatVsDog', snapshot.mode > 3)}
            {image('picFriendlyFireOn', snapshot.mode <= 3 && !!match.friendlyFire)}
            {image('picFriendlyFireOff', snapshot.mode <= 3 && !match.friendlyFire)}
            {snapshot.mode <= 3 && ['Cat', 'Dog'].map((name, team) => <Fragment key={name}>
              {image(`pic${name}Team${local?.team === team ? 'Selected' : 'Normal'}`)}
              <SourceButton ui={ui} layout={layout!} suffix="room_main.xml" source={`btn${name}Team`} data-waiting-control={`team${team}`} selected={local?.team === team} aria-label={`加入${team === 0 ? '猫' : '狗'}队`} title={`加入${team === 0 ? '猫' : '狗'}队`}
                {...controlProps} disabled={disabled || ready || local?.team === team || !local}
                data-waiting-team={String(team)} aria-pressed={local?.team === team}
                onClick={() => {void request(() => actions.team(team), 'team');}} />
            </Fragment>)}
            {slots.map((player, index) => <Fragment key={index}>
              <SourceImage ui={ui} name={`PlayerPanel${index}`} data-waiting-source-player={player?.id}
                data-team={player ? String(player.team) : undefined}
                data-waiting-player-ready={player ? String(match.readyPlayerIds.includes(player.id)) : undefined}
                aria-label={player ? `${player.name} · ${waitingTeamName(snapshot.mode, player.team)} · ${match.readyPlayerIds.includes(player.id) ? '已准备' : '未准备'}${player.isCpu ? ' · CPU' : player.isAutopilot ? ' · AI托管' : ''}` : undefined} />
              {player ? <>
                {image(`txtPlayerName${index}`, true, player.name)}
                <SourceImage ui={ui} name={`picPlayerTank${index}`} reference={waitingTankReference(player.tankId)}
                  aria-label={`战车 ${player.tankId}`} text={sourceAsset(ui, waitingTankReference(player.tankId)) ? undefined : String(player.tankId)} />
                {image(`txtPlayerTitle${index}`, true, player.title?.name ?? '')}
                <SourceStaticImage ui={ui} layout={layout!} suffix="room_main.xml" name={`picReady${index}`}
                  className="waiting-room-ready-mark" hidden={!match.readyPlayerIds.includes(player.id)} offsetX={index < 6 ? 17 : -18} />
                <WaitingRoomSlotActions ui={ui} layout={layout!} index={index} player={player} disabled={disabled}
                  canKick={!!kickPlayer && player.id !== playerId && readyAvailable} onFocus={controlProps.onFocus}
                  details={() => setDetailsId(player.id)} kick={() => {void request(() => kickPlayer!(player.id), 'kickPlayer');}}/>
              </> : canAddRobot && robotSlots.includes(index) ?
                <button type="button" className="waiting-room-add-robot"
                  {...sourceProps(ui, layout!, 'room_main.xml', `picNA${index}`,
                    layout!.control(`picNA${index}`).properties.Image)}
                  {...controlProps} data-add-cpu="" data-waiting-control={`robot${index < 6 ? 0 : 1}`}
                  aria-label={snapshot.mode <= 3 ? `在${index < 6 ? '猫' : '狗'}队新增机器人` : '新增机器人'}
                  onClick={() => {void request(() => addRobot!(snapshot.mode <= 3 ? (index < 6 ? 0 : 1) : undefined), 'addRobot');}}>
                  <SourceFeedbackText text="新增机器人" />
                </button> : image(`picNA${index}`)}
            </Fragment>)}
            <SourceButton ui={ui} layout={layout!} suffix="room_main.xml" source={ready ? 'btnCancel' : 'btnReady'} data-waiting-control="ready" aria-label={ready ? '取消准备' : '准备'} title={ready ? '取消准备' : '准备'}
              {...controlProps} disabled={disabled || !local || !readyAvailable} data-waiting-ready="" aria-pressed={ready}
              onClick={() => {void request(() => actions.ready(!ready), 'ready');}} />
            <SourceButton ui={ui} layout={layout!} suffix="room_main.xml" source="btnInvite" data-waiting-control="invite" aria-label="邀请大厅玩家加入房间" title="邀请大厅玩家加入房间"
              {...controlProps} disabled={disabled || invited || snapshot.players.length >= (match.maxPlayers ?? 12)}
              data-waiting-invite="" onClick={() => {
                const current = generation.current;
                void request(async () => {
                  const expiresAt = await actions.invite();
                  if (current === generation.current) setInviteUntil(expiresAt);
                }, 'invite');
              }} />
            <SourceButton ui={ui} layout={layout!} suffix="room_main.xml" source="btnClose" data-waiting-control="close" aria-label="退出房间" title="退出房间" {...controlProps}
              data-waiting-close="" onClick={() => {void request(() => actions.leave(), 'leave');}} />
          </SourceImageScale>}
        </div>
      </div>
      {formal && <aside className="waiting-room-console" data-waiting-room-console=""
        style={{left: 615 * scale, top: 0, transform: `scale(${scale})`}}>
        {status}
        {overflow.length > 0 && overflowList}
      </aside>}
      {!formal && status}
      {!formal && overflowList}
    </dialog>
    {editMaps && roomEditor && snapshot.roomInfo && <RoomEditDialog snapshot={snapshot} maps={editMaps} editor={roomEditor}
      close={() => setEditMaps(undefined)}/>}
    {detailsPlayer && <PlayerInfoView open player={{name: detailsPlayer.name, title: detailsPlayer.title?.name, online: true, inRoom: true}}
      pending={false} status="" onClose={() => setDetailsId(undefined)}
      roomDetails={{roomId: snapshot.roomId, tankId: detailsPlayer.tankId, petId: detailsPlayer.petId,
        team: waitingTeamName(snapshot.mode, detailsPlayer.team), ready: !!match?.readyPlayerIds.includes(detailsPlayer.id)}}/>}
    <SourceNoticeView notice={notice} />
  </>;
}
