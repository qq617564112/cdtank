import './waiting-room.css';
import {Fragment, useEffect, useLayoutEffect, useRef, useState} from 'react';
import type {ComponentPropsWithoutRef, KeyboardEvent, ReactNode, SyntheticEvent} from 'react';
import type {MsgRoomSnapshot} from '../../../../shared/protocols';
import {SourceButton} from '../resources/source-button';
import {SourceImageScale, SourceStaticImage} from '../resources/source-static-image';
import {SourceStaticText} from '../resources/source-static-text';
import {SourceMultilineReading} from '../resources/source-multiline-reading';
import {sourceProps} from '../resources/source-ui-props';
import {loadSourceUiFonts} from '../resources/source-ui-fonts';
import {HomeSourceLayout} from '../resources/source-ui-layout';
import type {HomeSourceUi} from '../resources/source-ui-layout';
import {roomModeIconReference} from './room-mode-icons';
import {SourceNotice} from '../dialogs/source-notice';
import {SourceNoticeView} from '../dialogs/source-notice-view';
import {waitingRoomSlots, waitingTankReference, waitingRoomInfo} from './waiting-room-state';
import {WaitingRoomResourceFeedback} from './waiting-room-resource-feedback';

export interface WaitingRoomActions {
  ready(isReady: boolean): Promise<void>;
  team(team: number): Promise<void>;
  leave(): Promise<void>;
  invite(): Promise<number>;
}

export interface WaitingRoomViewProps {
  formal?: boolean;
  management?: ReactNode;
  snapshot: MsgRoomSnapshot;
  playerId: string;
  externalBusy: boolean;
  readyAvailable?: boolean;
  actions: WaitingRoomActions;
}

function sourceAsset(ui: HomeSourceUi, reference: string | undefined): string | undefined {
  const match = /^set:(\S+) image:(.+)$/.exec(reference ?? '');
  const sets = ui.imagesets.filter(set => set.attributes.Name === match?.[1]);
  const set = sets.find(set => set.path.includes('imagesets_dds/')) ?? sets[0];
  return set?.images.find(image => image.Name === match?.[2])?.asset;
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

/** The room and round own the waiting dialog's requests and presentation state. */
export function WaitingRoomView(props: WaitingRoomViewProps) {
  return <WaitingRoomSession key={`${props.snapshot.roomId}:${props.snapshot.match?.round}:${props.snapshot.phase}`}
    {...props} />;
}

function WaitingRoomSession({formal = false, management, snapshot, playerId, externalBusy, readyAvailable = true, actions}: WaitingRoomViewProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(formal);
  const [ui, setUi] = useState<HomeSourceUi | null>(null);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [inviteUntil, setInviteUntil] = useState(0);
  const [scale, setScale] = useState(() => waitingScale(formal));
  const generation = useRef(0);
  const pending = useRef(false);
  const focusedControl = useRef<string | undefined>(undefined);
  const [notice] = useState(() => new SourceNotice());
  const match = snapshot.match;
  const available = snapshot.phase === 'WAITING' && !!match;
  const disabled = busy || externalBusy;
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
    const controller = new AbortController();
    setLoadError('');
    void (async () => {
      try {
        const response = await fetch('/ui.json', {signal: controller.signal});
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const loaded = await response.json() as HomeSourceUi;
        if (!loaded.layouts.some(layout => layout.path.endsWith('room_main.xml'))) {
          throw new Error('原等待房间布局缺失');
        }
        await loadSourceUiFonts();
        if (!controller.signal.aborted) setUi(loaded);
      } catch {
        if (!controller.signal.aborted) setLoadError('等待房间界面资源未能载入，请返回大厅后重新进入。');
      }
    })();
    return () => controller.abort();
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

  async function request(action: () => Promise<void>): Promise<void> {
    if (pending.current || externalBusy || !available) return;
    const current = generation.current;
    pending.current = true; setBusy(true); setError('');
    try {await action();} catch (cause) {
      if (current === generation.current) {
        const message = cause instanceof Error ? cause.message : String(cause);
        setError(message);
        await notice.show(message);
      }
    } finally {
      if (current === generation.current) {pending.current = false; setBusy(false);}
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
  const image = (name: string, shown = true, text?: string) => ui &&
    <SourceImage key={name} ui={ui} name={name} hidden={!shown} text={text} />;
  const layout = ui ? new HomeSourceLayout(ui, 'room_main.xml') : undefined;
  const controlProps = {disabled, onFocus: (event: SyntheticEvent<HTMLButtonElement>) => {
    focusedControl.current = event.currentTarget.dataset.waitingControl;
  }};

  return <>
    {!formal && <button ref={opener} type="button" data-open-waiting-room="" hidden={!available}
      disabled={externalBusy} onClick={() => setOpen(true)}>查看原等待房间</button>}
    <dialog ref={dialog} data-waiting-room="" aria-label="等待房间"
      data-waiting-room-formal={formal || undefined}
      onCancel={event => {event.preventDefault(); close();}}
      onKeyDown={isolateKeyboard} onKeyUp={isolateKeyboard}
      onMouseDown={event => event.stopPropagation()} onMouseUp={event => event.stopPropagation()}
      onClick={event => event.stopPropagation()} onWheel={event => event.stopPropagation()}>
      <div className="waiting-room-viewport" style={{width: (formal ? 800 : 615) * scale, height: (formal ? 600 : 400) * scale}}>
        <div data-waiting-room-stage="" className="waiting-room-stage" style={{transform: `scale(${scale})`}}>
          {!ui && loadError && <WaitingRoomResourceFeedback error={loadError} pending={disabled}
            leave={() => {void request(() => actions.leave());}} />}
          {open && ui && match && available && <SourceImageScale value={scale}>
            {['ditu', 'maogouditu', 'maogouditu2', 'zhongjianditu', 'fenhongdi1', 'fenhongdi2', 'tiao2', 'tiao', 'kuang', 'dituguize', 'renshu', 'daos', 'meijushijian', 'sec'].map(name => image(name))}
            {image('txtRoomNumber', true, snapshot.roomId)}
            {image('txtMinPlayer', true, String(match.minPlayers))}
            {image('txtMaxPlayer', true, match.maxPlayers === undefined ? '—' : String(match.maxPlayers))}
            <SourceImage ui={ui} name="txtRoomName" text={info.name} title={info.name} className="waiting-room-label" tabIndex={0} />
            <SourceImage ui={ui} name="txtMapName" text={info.mapName} title={info.mapName} className="waiting-room-label" tabIndex={0} />
            {image('txtGameTime', true, info.time)}
            {image('picLocked', info.locked)}
            <SourceMultilineReading ui={ui} layout={layout!} suffix="room_main.xml" name="edtMapDesc" text={info.description}/>
            <SourceImage ui={ui} name="picGameMode" reference={roomModeIconReference(snapshot.mode)} />
            {image('picCatVsDog', snapshot.mode <= 3)}
            {image('picNonCatVsDog', snapshot.mode > 3)}
            {image('picFriendlyFireOn', snapshot.mode <= 3 && !!match.friendlyFire)}
            {image('picFriendlyFireOff', snapshot.mode <= 3 && !match.friendlyFire)}
            {snapshot.mode <= 3 && ['Cat', 'Dog'].map((name, team) => <Fragment key={name}>
              {image(`pic${name}Team${local?.team === team ? 'Selected' : 'Normal'}`)}
              <SourceButton ui={ui} layout={layout!} suffix="room_main.xml" source={`btn${name}Team`} data-waiting-control={`team${team}`} selected={local?.team === team} aria-label={`加入${team === 0 ? '猫' : '狗'}队`} title={`加入${team === 0 ? '猫' : '狗'}队`}
                {...controlProps} disabled={disabled || ready || local?.team === team || !local}
                data-waiting-team={String(team)} aria-pressed={local?.team === team}
                onClick={() => {void request(() => actions.team(team));}} />
            </Fragment>)}
            {slots.map((player, index) => <Fragment key={index}>
              <SourceImage ui={ui} name={`PlayerPanel${index}`} data-waiting-source-player={player?.id}
                data-team={player ? String(player.team) : undefined}
                data-waiting-player-ready={player ? String(match.readyPlayerIds.includes(player.id)) : undefined}
                aria-label={player ? `${player.name} · ${match.readyPlayerIds.includes(player.id) ? '已准备' : '未准备'}` : undefined} />
              {player ? <>
                {image(`txtPlayerName${index}`, true, player.name)}
                {image(`picReady${index}`, match.readyPlayerIds.includes(player.id))}
                <SourceImage ui={ui} name={`picPlayerTank${index}`} reference={waitingTankReference(player.tankId)}
                  aria-label={`战车 ${player.tankId}`} text={sourceAsset(ui, waitingTankReference(player.tankId)) ? undefined : String(player.tankId)} />
                {image(`txtPlayerTitle${index}`, true, player.id === playerId ? '你' : '')}
              </> : image(`picNA${index}`)}
            </Fragment>)}
            <SourceButton ui={ui} layout={layout!} suffix="room_main.xml" source={ready ? 'btnCancel' : 'btnReady'} data-waiting-control="ready" aria-label={ready ? '取消准备' : '准备'} title={ready ? '取消准备' : '准备'}
              {...controlProps} disabled={disabled || !local || !readyAvailable} data-waiting-ready="" aria-pressed={ready}
              onClick={() => {void request(() => actions.ready(!ready));}} />
            <SourceButton ui={ui} layout={layout!} suffix="room_main.xml" source="btnInvite" data-waiting-control="invite" aria-label="邀请大厅玩家加入房间" title="邀请大厅玩家加入房间"
              {...controlProps} disabled={disabled || invited || snapshot.players.length >= (match.maxPlayers ?? 12)}
              data-waiting-invite="" onClick={() => {
                const current = generation.current;
                void request(async () => {
                  const expiresAt = await actions.invite();
                  if (current === generation.current) setInviteUntil(expiresAt);
                });
              }} />
            <SourceButton ui={ui} layout={layout!} suffix="room_main.xml" source="btnClose" data-waiting-control="close" aria-label="退出房间" title="退出房间" {...controlProps}
              data-waiting-close="" onClick={() => {void request(() => actions.leave());}} />
          </SourceImageScale>}
        </div>
      </div>
      <output role="status" data-waiting-room-status=""
        style={formal ? {position: 'absolute', left: 615 * scale, top: 400 * scale, width: 185 * scale, maxHeight: 200 * scale,
          fontSize: 12 * scale, boxSizing: 'border-box', overflow: 'auto', pointerEvents: 'auto'} : undefined}
        data-waiting-room-status-state={loadError ? 'error' : !ui ? 'loading' : error ? 'error' : disabled ? 'pending' : invited ? 'confirmation' : 'normal'}>{loadError || (!ui ? '正在载入原等待房间…' : error ||
        (disabled ? '正在提交，请等待服务器确认…' : invited ? '邀请已发送给大厅玩家，30秒后可再次邀请' :
          `${snapshot.roomId} · 已准备 ${match?.readyPlayerIds.length ?? 0}/${snapshot.players.length}`))}</output>
      <ul data-waiting-room-overflow="" style={formal ? {position: 'absolute', left: 615 * scale, top: 400 * scale,
        width: 185, maxHeight: 200, transform: `scale(${scale})`, transformOrigin: 'top left', overflow: 'auto', pointerEvents: 'auto'} : undefined} hidden={overflow.length === 0}>{overflow.map(player =>
        <li key={player.id}>{player.name} · 战车 {player.tankId} · {match?.readyPlayerIds.includes(player.id) ? '已准备' : '未准备'}</li>)}</ul>
      {formal && management && <div data-waiting-management="" className="waiting-room-management" style={{left: 615 * scale, top: 0, transform: `scale(${scale})`}}>{management}</div>}
    </dialog>
    <SourceNoticeView notice={notice} />
  </>;
}
