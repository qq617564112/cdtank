import './player-info.css';
import {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {SourceButton} from '../resources/source-button';
import {SourceImageScale, SourceStaticImage} from '../resources/source-static-image';
import {SourceStaticText} from '../resources/source-static-text';
import {HomeSourceLayout} from '../resources/source-ui-layout';
import {sourceProps, useSourceUi} from './source-react';
import {loadUiFont} from '../resources/source-ui-fonts';
import {PlayerInfoResourceFeedback} from './player-info-resource-feedback';
import {waitingTankReference} from './waiting-room-state';
import {SourceFeedbackText} from '../resources/source-feedback-text';
import {PlayerInfoSummary} from './player-info-summary';
import type {ResPlayerProfile} from '../../../../shared/protocols/PtlPlayerProfile';
import {HistoryIntroScrollbar} from '../account/history-intro-scrollbar';

export interface PlayerInfoPlayer {
  accountId?: string;
  name: string;
  title?: string;
  isFriend?: boolean;
  isBlocked?: boolean;
  online: boolean;
  inRoom: boolean;
}
export interface PlayerInfoViewProps {
  open: boolean;
  player: PlayerInfoPlayer | null;
  pending: boolean;
  status: string;
  onAddFriend?: () => void;
  onRemoveFriend?: () => void;
  onAddBlacklist?: () => void;
  onRemoveBlacklist?: () => void;
  onClose: () => void;
  onExchange?: () => void;
  query?: (targetAccountId: string) => Promise<ResPlayerProfile>;
  roomDetails?: {roomId: string; tankId: number; petId?: number; team: string; ready: boolean};
}

const suffix = 'playerlist_playerinfo.xml';

/** The source player sheet consumes account relationships or current room details. */
export function PlayerInfoView(props: PlayerInfoViewProps) {
  return props.open && props.player ? <PlayerInfoSession {...props} player={props.player}/> : null;
}

function PlayerInfoSession({player, pending, status, onAddFriend, onRemoveFriend, onAddBlacklist, onRemoveBlacklist, onClose, onExchange, query, roomDetails}: PlayerInfoViewProps & {player: PlayerInfoPlayer}) {
  const {ui, error} = useSourceUi(true, [suffix]);
  const dialog = useRef<HTMLDialogElement>(null);
  const descriptionArea = useRef<HTMLTextAreaElement>(null);
  const escapePending = useRef(false);
  const requestedFocus = useRef<'friend' | 'blacklist' | null>(null);
  const [scale, setScale] = useState(() => Math.min(innerWidth / 800, innerHeight / 600));
  const [profile, setProfile] = useState<ResPlayerProfile>();
  const [profilePending, setProfilePending] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileAttempt, setProfileAttempt] = useState(0);
  const [summaryTab, setSummaryTab] = useState<'battle' | 'award'>();
  const layout = ui ? new HomeSourceLayout(ui, suffix) : undefined;
  useEffect(() => {
    const element = dialog.current!;
    const origin = document.activeElement;
    element.showModal();
    const resize = () => setScale(Math.min(innerWidth / 800, innerHeight / 600));
    window.addEventListener('resize', resize);
    void loadUiFont().catch(() => {});
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
  useEffect(() => {
    const accountId = player.accountId;
    setProfile(undefined);
    setProfileError('');
    setSummaryTab(undefined);
    if (!accountId || !query) {
      setProfilePending(false);
      return;
    }
    let current = true;
    setProfilePending(true);
    void query(accountId).then(value => {
      if (!current || value.accountId !== accountId) return;
      setProfile(value);
    }).catch(reason => {
      if (current) setProfileError(`资料查询失败：${reason instanceof Error ? reason.message : String(reason)}`);
    }).finally(() => {
      if (current) setProfilePending(false);
    });
    return () => {current = false;};
  }, [player.accountId, query, profileAttempt]);
  const friendSource = player.isFriend ? 'btnRemoveFriend' : 'btnAddFriend';
  const knownText = (name: string) => name === 'txtPlayerName' ? profile?.name ?? player.name : name === 'txtPlayerStatus'
    ? player.online ? player.inRoom ? '房间中' : '在线' : '离线'
    : name === 'txtPlayerTitle' ? profile ? profile.title?.name ?? '' : player.title ?? ''
    : name === 'txtPlayerOriginality' ? profile?.originality === undefined ? '' : String(profile.originality)
    : name === 'txtPlayerTech' ? profile?.tech === undefined ? '' : String(profile.tech)
    : name === 'txtPlayerScore' ? profile?.score === undefined ? '' : String(profile.score)
    : name === 'txtPlayerFamily' ? profile && 'family' in profile ? profile.family?.name ?? '' : ''
    : name === 'txtRoomNumber' ? roomDetails?.roomId ?? '' : '';
  const description = roomDetails ? `${roomDetails.team}\n战车：${roomDetails.tankId}${roomDetails.petId ? `\n宠物：${roomDetails.petId}` : ''}\n${roomDetails.ready ? '已准备' : '未准备'}` : '';
  const writePending = pending || profilePending;
  return <dialog ref={dialog} data-player-info="" data-player-info-account={player.accountId}
    aria-label={`玩家资料：${player.name}`} aria-busy={writePending} style={{zoom: scale}}
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
          {ui.layouts.find(value => value.path.endsWith(suffix))!.windows
            .filter(control => control.type === 'WindowsLook/StaticImage' && control.name !== 'picBackgroundMask')
            .map(control => <SourceStaticImage key={control.name} ui={ui} layout={layout} suffix={suffix}
              name={control.name} aria-hidden="true" className="player-info-picture"
              reference={roomDetails && control.name === 'picTankIcon' ? waitingTankReference(roomDetails.tankId) : undefined}/>)}
          {ui.layouts.find(value => value.path.endsWith(suffix))!.windows.filter(control => control.type === 'WindowsLook/StaticText')
            .map(control => <SourceStaticText key={control.name} ui={ui} layout={layout} suffix={suffix}
              name={control.name} text={knownText(control.name)} hidden={control.properties.Visible === 'False'}/>)}
          <textarea ref={descriptionArea} {...sourceProps(ui, layout, suffix, 'edtPlayerDescription')}
            className="player-info-description" aria-label={roomDetails ? '房间玩家详情' : '玩家介绍'} readOnly value={description} tabIndex={-1}/>
          <HistoryIntroScrollbar list={descriptionArea} ui={ui} properties={layout.control('edtPlayerDescription').properties}
            scale={scale} version={description} label={roomDetails ? '房间玩家详情滚动位置' : '玩家介绍滚动位置'}/>
          <SourceButton ui={ui} layout={layout} suffix={suffix} source={friendSource}
            data-player-info-friend-action="" aria-label={player.isFriend ? '删除好友' : '加好友'} disabled={writePending || !(player.isFriend ? onRemoveFriend : onAddFriend)}
            onClick={() => {requestedFocus.current = 'friend'; if (player.isFriend) onRemoveFriend?.(); else onAddFriend?.();}}/>
          <SourceButton ui={ui} layout={layout} suffix={suffix} source={player.isBlocked ? 'btnRemoveBlacklist' : 'btnAddBlacklist'}
            data-player-info-blacklist-action="" aria-label={player.isBlocked ? '解除屏蔽' : '屏蔽'} disabled={writePending || !(player.isBlocked ? onRemoveBlacklist : onAddBlacklist)}
            onClick={() => {requestedFocus.current = 'blacklist'; if (player.isBlocked) onRemoveBlacklist?.(); else onAddBlacklist?.();}}/>
          <SourceButton ui={ui} layout={layout} suffix={suffix} source="btnExchange"
            data-player-info-exchange="" aria-label="交易" disabled={writePending || !onExchange || !player.online || player.inRoom}
            onClick={onExchange}/>
          {['btnEnlarge', 'btnInvite'].map(name =>
            <SourceButton key={name} ui={ui} layout={layout} suffix={suffix} source={name} disabled
              aria-label={({btnEnlarge: '展开', btnInvite: '邀请'} as Record<string, string>)[name]}/>)}
          <SourceButton ui={ui} layout={layout} suffix={suffix} source="rdoBattleSummary"
            selected={summaryTab === 'battle'} aria-pressed={summaryTab === 'battle'} aria-label="战斗统计"
            data-player-info-battle-summary="" disabled={profilePending || !profile}
            onClick={() => setSummaryTab('battle')}/>
          <SourceButton ui={ui} layout={layout} suffix={suffix} source="rdoAwardSummary"
            selected={summaryTab === 'award'} aria-pressed={summaryTab === 'award'} aria-label="获奖统计"
            data-player-info-award-summary="" disabled={profilePending || !profile}
            onClick={() => setSummaryTab('award')}/>
          <SourceButton ui={ui} layout={layout} suffix={suffix} source="btnClose" data-player-info-close="" aria-label="关闭玩家资料" onClick={onClose}/>
          {summaryTab && profile && <PlayerInfoSummary key={summaryTab} mode={summaryTab} profile={profile}/>}
        </>}
        <output className="player-info-status" data-player-info-status="" aria-live="polite">{!ui && error ? '' : error || status}</output>
        {profileError && <div className="player-info-query-status" data-player-info-query-status="" role="status" aria-live="polite">
          <SourceFeedbackText text={profileError} />
          <button type="button" data-player-info-profile-retry="" disabled={profilePending}
            onClick={() => setProfileAttempt(value => value + 1)}>
            <SourceFeedbackText text="重试资料" />
          </button>
        </div>}
        {!ui && error && <PlayerInfoResourceFeedback close={onClose} />}
        {!ui && !error && <button type="button" data-player-info-close="" onClick={onClose}>关闭</button>}
      </div>
    </SourceImageScale>
  </dialog>;
}
