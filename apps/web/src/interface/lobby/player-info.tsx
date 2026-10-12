import {GameMessage} from '../resources/game-message';
import './player-info.css';
import {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {SourceImageScale} from '../resources/source-static-image';
import {GameDialog} from '../resources/game-dialog';
import {DialogButton} from '../resources/dialog-button';
import {HomeSurfacePanel} from '../home/home-surface';
import {HomeSourceButton} from '../home/home-source-button';
import {HomeSourceLayout} from '../resources/source-ui-layout';
import {sourceProps, useSourceUi} from './source-react';
import {PlayerInfoResourceFeedback} from './player-info-resource-feedback';
import {PlayerInfoDetails} from './player-info-details';
import {PlayerInfoSummary} from './player-info-summary';
import type {ResPlayerProfile} from '../../../../shared/protocols/PtlPlayerProfile';

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
  preview?: {tankId: number; petId?: number};
}

const suffix = 'playerlist_playerinfo.xml';

/** The player sheet shares the account page's artwork and public profile values. */
export function PlayerInfoView(props: PlayerInfoViewProps) {
  return props.open && props.player ? <PlayerInfoSession {...props} player={props.player}/> : null;
}

function PlayerInfoSession({player, pending, status, onAddFriend, onRemoveFriend, onAddBlacklist, onRemoveBlacklist, onClose, onExchange, query, preview}: PlayerInfoViewProps & {player: PlayerInfoPlayer}) {
  const {ui, error} = useSourceUi(true, [suffix, 'myhome_playerpage_awardsummary.xml']);
  const dialog = useRef<HTMLDialogElement>(null);
  const escapePending = useRef(false);
  const requestedFocus = useRef<'friend' | 'blacklist' | null>(null);
  const [scale, setScale] = useState(() => Math.min(innerWidth / 800, innerHeight / 600));
  const [profile, setProfile] = useState<ResPlayerProfile>();
  const [profilePending, setProfilePending] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileAttempt, setProfileAttempt] = useState(0);
  const [summaryTab, setSummaryTab] = useState<'battle' | 'award'>('battle');
  const layout = ui ? new HomeSourceLayout(ui, suffix) : undefined;
  useEffect(() => {
    const element = dialog.current!;
    const origin = document.activeElement;
    element.showModal();
    const resize = () => setScale(Math.min(innerWidth / 800, innerHeight / 600));
    window.addEventListener('resize', resize);
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
    setSummaryTab('battle');
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
  const writePending = pending || profilePending;
  return <GameDialog ref={dialog} width={405} height={416} uiScale={scale} stageClassName="player-info-shell"
    data-player-info="" data-player-info-account={player.accountId}
    aria-label={`玩家资料：${player.name}`} aria-busy={writePending || !ui && !error}
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
        <HomeSurfacePanel material="canvas" style={{left: 0, top: 35, width: 405, height: 381}}/>
        <HomeSurfacePanel material="header" style={{left: 0, top: 0, width: 405, height: 37}}/>
        {ui && layout && <>
          <PlayerInfoDetails ui={ui} layout={layout} player={player} profile={profile} preview={preview}
            loading={profilePending} error={profileError} scale={scale}/>
          <HomeSurfacePanel {...sourceProps(ui, layout, suffix, 'tiao')} material="peach"/>
          <DialogButton {...sourceProps(ui, layout, suffix, friendSource)} className="player-info-action"
            data-player-info-friend-action="" aria-label={player.isFriend ? '删除好友' : '加好友'} disabled={writePending || !(player.isFriend ? onRemoveFriend : onAddFriend)}
            onClick={() => {requestedFocus.current = 'friend'; if (player.isFriend) onRemoveFriend?.(); else onAddFriend?.();}}>
            {player.isFriend ? '删好友' : '加好友'}
          </DialogButton>
          <DialogButton {...sourceProps(ui, layout, suffix, player.isBlocked ? 'btnRemoveBlacklist' : 'btnAddBlacklist')}
            className="player-info-action"
            data-player-info-blacklist-action="" aria-label={player.isBlocked ? '解除屏蔽' : '屏蔽'} disabled={writePending || !(player.isBlocked ? onRemoveBlacklist : onAddBlacklist)}
            onClick={() => {requestedFocus.current = 'blacklist'; if (player.isBlocked) onRemoveBlacklist?.(); else onAddBlacklist?.();}}>
            {player.isBlocked ? '解除屏蔽' : '屏蔽'}
          </DialogButton>
          <DialogButton {...sourceProps(ui, layout, suffix, 'btnInvite')} className="player-info-action"
            disabled aria-label="邀请">邀请</DialogButton>
          <DialogButton {...sourceProps(ui, layout, suffix, 'btnExchange')} className="player-info-action"
            data-player-info-exchange="" aria-label="交易" disabled={writePending || !onExchange || !player.online || player.inRoom}
            onClick={onExchange}>交易</DialogButton>
          <div className="player-info-statistics-panel">
            {profile && <PlayerInfoSummary mode={summaryTab} profile={profile} ui={ui}/>}
            {!profile && !profilePending && !profileError && <p className="player-info-summary-empty" role="status">
              暂无统计资料
            </p>}
            <HomeSourceButton ui={ui} layout={layout} suffix={suffix} source="rdoBattleSummary"
              style={{left: 0, top: 134}}
              selected={summaryTab === 'battle'} aria-pressed={summaryTab === 'battle'} aria-label="战斗统计"
              data-player-info-battle-summary="" disabled={profilePending || !profile}
              onClick={() => setSummaryTab('battle')}/>
            <HomeSourceButton ui={ui} layout={layout} suffix={suffix} source="rdoAwardSummary"
              style={{left: 92, top: 134}}
              selected={summaryTab === 'award'} aria-pressed={summaryTab === 'award'} aria-label="获奖统计"
              data-player-info-award-summary="" disabled={profilePending || !profile}
              onClick={() => setSummaryTab('award')}/>
          </div>
        </>}
        <DialogButton kind="close" style={{left: 361, top: -1}}
          data-player-info-close="" aria-label="关闭玩家资料" onClick={onClose}/>
        <GameMessage data-player-info-status="" text={!ui && error ? '' : error || status}
          tone={error ? 'error' : 'info'}/>
        {profileError && <div className="player-info-query-actions" data-player-info-query-status="">
          <GameMessage text={profileError} tone="error"/>
          <DialogButton data-player-info-profile-retry="" disabled={profilePending}
            onClick={() => setProfileAttempt(value => value + 1)}>
            重试资料
          </DialogButton>
        </div>}
        {!ui && error && <PlayerInfoResourceFeedback close={onClose} />}
      </div>
    </SourceImageScale>
  </GameDialog>;
}
