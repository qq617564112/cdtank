import './player-info.css';
import {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {SourceButton} from '../resources/source-button';
import {SourceImageScale, SourceStaticImage} from '../resources/source-static-image';
import {SourceStaticText} from '../resources/source-static-text';
import {HomeSourceLayout} from '../resources/source-ui-layout';
import {sourceProps, useSourceUi} from './source-react';
import {loadSourceUiFonts} from '../resources/source-ui-fonts';
import {PlayerInfoResourceFeedback} from './player-info-resource-feedback';

export interface PlayerInfoPlayer {
  accountId: string;
  name: string;
  title?: string;
  isFriend: boolean;
  isBlocked: boolean;
  online: boolean;
  inRoom: boolean;
}
export interface PlayerInfoViewProps {
  open: boolean;
  player: PlayerInfoPlayer | null;
  pending: boolean;
  status: string;
  onAddFriend: () => void;
  onRemoveFriend: () => void;
  onAddBlacklist: () => void;
  onRemoveBlacklist: () => void;
  onClose: () => void;
  onExchange?: () => void;
}

const suffix = 'playerlist_playerinfo.xml';

/** The source player sheet consumes confirmed account identity and friend state. */
export function PlayerInfoView(props: PlayerInfoViewProps) {
  return props.open && props.player ? <PlayerInfoSession {...props} player={props.player}/> : null;
}

function PlayerInfoSession({player, pending, status, onAddFriend, onRemoveFriend, onAddBlacklist, onRemoveBlacklist, onClose, onExchange}: PlayerInfoViewProps & {player: PlayerInfoPlayer}) {
  const {ui, error} = useSourceUi(true, [suffix]);
  const dialog = useRef<HTMLDialogElement>(null);
  const escapePending = useRef(false);
  const requestedFocus = useRef<'friend' | 'blacklist' | null>(null);
  const [scale, setScale] = useState(() => Math.min(innerWidth / 800, innerHeight / 600));
  const layout = ui ? new HomeSourceLayout(ui, suffix) : undefined;
  useEffect(() => {
    const element = dialog.current!;
    const origin = document.activeElement;
    element.showModal();
    const resize = () => setScale(Math.min(innerWidth / 800, innerHeight / 600));
    window.addEventListener('resize', resize);
    void loadSourceUiFonts();
    return () => {
      window.removeEventListener('resize', resize);
      if (element.open) element.close();
      if (origin instanceof HTMLElement && origin.isConnected) origin.focus();
    };
  }, []);
  useLayoutEffect(() => {
    if (!ui) return;
    if (document.activeElement === document.body || document.activeElement === dialog.current) {
      dialog.current?.querySelector<HTMLButtonElement>('[data-player-info-close]')?.focus();
    }
  }, [ui]);
  useLayoutEffect(() => {
    if (pending || !requestedFocus.current) return;
    const action = requestedFocus.current;
    requestedFocus.current = null;
    if (document.activeElement === document.body || document.activeElement === dialog.current) {
      dialog.current?.querySelector<HTMLButtonElement>(`[data-player-info-${action}-action]`)?.focus();
    }
  }, [pending, player.isFriend, player.isBlocked]);
  const friendSource = player.isFriend ? 'btnRemoveFriend' : 'btnAddFriend';
  const knownText = (name: string) => name === 'txtPlayerName' ? player.name : name === 'txtPlayerStatus'
    ? player.online ? player.inRoom ? '房间中' : '在线' : '离线'
    : name === 'txtPlayerTitle' ? player.title ?? '' : '';
  return <dialog ref={dialog} data-player-info="" data-player-info-account={player.accountId}
    aria-label={`玩家资料：${player.name}`} aria-busy={pending} style={{zoom: scale}}
    onCancel={event => {event.preventDefault(); onClose();}}
    onKeyDown={event => {
      event.stopPropagation();
      if (event.key === 'Escape') {event.preventDefault(); escapePending.current = true;}
    }} onKeyUp={event => {
      event.stopPropagation();
      if (event.key === 'Escape' && escapePending.current) {
        escapePending.current = false;
        onClose();
      }
    }}>
    <SourceImageScale value={scale}>
      <div className="player-info-stage" data-player-info-stage="">
        {ui && layout && <>
          {ui.layouts.find(value => value.path.endsWith(suffix))!.windows.filter(control => control.type === 'WindowsLook/StaticImage')
            .map(control => <SourceStaticImage key={control.name} ui={ui} layout={layout} suffix={suffix}
              name={control.name} aria-hidden="true" className="player-info-picture"/>)}
          {ui.layouts.find(value => value.path.endsWith(suffix))!.windows.filter(control => control.type === 'WindowsLook/StaticText')
            .map(control => <SourceStaticText key={control.name} ui={ui} layout={layout} suffix={suffix}
              name={control.name} text={knownText(control.name)} hidden={control.properties.Visible === 'False'}/>)}
          <textarea {...sourceProps(ui, layout, suffix, 'edtPlayerDescription')} aria-label="玩家介绍" readOnly value="" tabIndex={-1}/>
          <SourceButton ui={ui} layout={layout} suffix={suffix} source={friendSource}
            data-player-info-friend-action="" aria-label={player.isFriend ? '删除好友' : '加好友'} disabled={pending}
            onClick={() => {requestedFocus.current = 'friend'; if (player.isFriend) onRemoveFriend(); else onAddFriend();}}/>
          <SourceButton ui={ui} layout={layout} suffix={suffix} source={player.isBlocked ? 'btnRemoveBlacklist' : 'btnAddBlacklist'}
            data-player-info-blacklist-action="" aria-label={player.isBlocked ? '解除屏蔽' : '屏蔽'} disabled={pending}
            onClick={() => {requestedFocus.current = 'blacklist'; if (player.isBlocked) onRemoveBlacklist(); else onAddBlacklist();}}/>
          <SourceButton ui={ui} layout={layout} suffix={suffix} source="btnExchange"
            data-player-info-exchange="" aria-label="交易" disabled={pending || !onExchange || !player.online || player.inRoom}
            onClick={onExchange}/>
          {['btnEnlarge', 'btnInvite', 'rdoBattleSummary', 'rdoAwardSummary'].map(name =>
            <SourceButton key={name} ui={ui} layout={layout} suffix={suffix} source={name} disabled
              aria-label={({btnEnlarge: '展开', btnInvite: '邀请', btnExchange: '交易',
                rdoBattleSummary: '战斗统计', rdoAwardSummary: '获奖统计'} as Record<string, string>)[name]}/>)}
          <SourceButton ui={ui} layout={layout} suffix={suffix} source="btnClose" data-player-info-close="" aria-label="关闭玩家资料" onClick={onClose}/>
        </>}
        <output className="player-info-status" data-player-info-status="" aria-live="polite">{!ui && error ? '' : error || status}</output>
        {!ui && error && <PlayerInfoResourceFeedback close={onClose} />}
        {!ui && !error && <button type="button" data-player-info-close="" onClick={onClose}>关闭</button>}
      </div>
    </SourceImageScale>
  </dialog>;
}
