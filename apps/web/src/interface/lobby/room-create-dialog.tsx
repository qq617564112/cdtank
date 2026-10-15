import {GameMessage} from '../resources/game-message';
import {useId, useLayoutEffect, useRef, useState} from 'react';
import type {MapOption} from '../../../../shared/protocols/PtlListMaps';
import {ROOM_NAME_MAX_CODEPOINTS, ROOM_PASSWORD_MAX_CODEPOINTS} from '../../../../shared/room-input';
import {ROOM_TIME_LIMIT_MIN_SECONDS, ROOM_TIME_LIMIT_MAX_SECONDS,
  ROOM_TIME_LIMIT_STEP_SECONDS} from '../../../../shared/room-time-limit';
import {CartoonButton, CartoonInput} from '../resources/cartoon-controls';
import {DialogButton} from '../resources/dialog-button';
import {GameDialog, GameDialogTopbar, GameDialogTitle,
  GameDialogPanel, GameDialogFootbar} from '../resources/game-dialog';
import {useSourceDialog, useSourceScale} from './source-react';
import {isMobileDevice} from '../../platform/device';
import {gamePageScale} from '../../platform/page-viewport';
import type {RoomCreateDraft} from './room-create-draft';
import {validateRoomCreateDraft, changeRoomCreateBound} from './room-create-draft';
import {RoomCreateCard} from './room-create-card';
import {RoomRuleButton} from './room-rule-button';
import {RoomAdjustmentButton} from './room-adjustment';
import {useRoomInputLimit} from './room-input-limit';
import {useRoomDraft} from './use-room-draft';
import './room-create-dialog.css';

export type RoomPasswordAction = 'KEEP' | 'REPLACE' | 'CLEAR';

interface RoomCreateDialogProps {
  open: boolean; close(): void; initialDraft: RoomCreateDraft; map?: MapOption;
  editing?: boolean;
  initialPasswordAction?: RoomPasswordAction;
  changeMap?(draft: RoomCreateDraft, passwordAction: RoomPasswordAction): void;
  submit(draft: RoomCreateDraft, passwordAction?: RoomPasswordAction): Promise<void>;
}

const MODE_NAMES = ['团队模式', '占领模式', '擒王模式', '混战模式', '破坏模式', '训练模式'];

export function RoomCreateDialog({open, close, initialDraft, map, submit, editing = false,
  initialPasswordAction = 'KEEP', changeMap}: RoomCreateDialogProps) {
  const [draft, setDraft] = useRoomDraft(initialDraft, editing ? 'edit' : 'create');
  const [pending, setPending] = useState(false), [status, setStatus] = useState('');
  const [passwordAction, setPasswordAction] = useState<RoomPasswordAction>(initialPasswordAction);
  const id = useId();
  const lastInput = useRef<'name' | 'password'>('name');
  const restoreInputFocus = useRef(false);
  const composing = useRef(false), escapePending = useRef(false);
  const nameRef = useRef<HTMLInputElement>(null), passwordRef = useRef<HTMLInputElement>(null);
  const dialog = useSourceDialog(open);
  const desktopScale = useSourceScale(800, 600, 0, 0, .25, Infinity).viewport.width / 800;
  const mobile = isMobileDevice();
  const scale = mobile ? gamePageScale(720, 405) : desktopScale;
  const nameLimit = useRoomInputLimit(nameRef, ROOM_NAME_MAX_CODEPOINTS,
    value => setDraft(previous => ({...previous, roomName: value})));
  const passwordLimit = useRoomInputLimit(passwordRef, ROOM_PASSWORD_MAX_CODEPOINTS,
    value => setDraft(previous => ({...previous, password: value})));
  const timeLimit = draft.timeLimitSeconds ?? map?.timeLimit;
  const timeLabel = timeLimit === undefined ? '—' : timeLimit % 60 === 0
    ? `${timeLimit / 60} 分钟` : `${Math.floor(timeLimit / 60)}分${timeLimit % 60}秒`;
  useLayoutEffect(() => {
    if (pending || !restoreInputFocus.current) return;
    restoreInputFocus.current = false;
    (lastInput.current === 'password' ? passwordRef.current : nameRef.current)?.focus();
  }, [pending]);

  async function confirm() {
    if (pending) return;
    const settings = {...draft, timeLimitSeconds: timeLimit};
    try {validateRoomCreateDraft(settings, map);} catch (reason) {setStatus(String(reason)); return;}
    if (editing && passwordAction === 'REPLACE' && !draft.password) {
      setStatus('请输入新密码，或选择取消密码');
      return;
    }
    setPending(true); setStatus('');
    try {await submit(settings, editing ? passwordAction : undefined); close();}
    catch (reason) {setStatus(String(reason));}
    finally {restoreInputFocus.current = true; setPending(false);}
  }

  const playerBound = (bound: 'minPlayers' | 'maxPlayers') => <div className="room-player-bound">
    {([-1, 1] as const).map(direction => {
      let allowed = !!map;
      if (map) try {changeRoomCreateBound(draft, map, bound, direction);} catch {allowed = false;}
      const low = bound === 'minPlayers';
      return <RoomAdjustmentButton key={direction} direction={direction} disabled={pending || !allowed}
        data-room-create-low={low ? direction : undefined} data-room-create-high={low ? undefined : direction}
        data-create-control={`${low ? 'low' : 'high'}${direction}`}
        aria-label={`${direction < 0 ? '减少' : '增加'}${low ? '开局人数' : '房间容量'}`}
        onClick={() => {
          if (map) {setDraft(changeRoomCreateBound(draft, map, bound, direction)); setStatus('');}
        }}/>;
    })}
    <output className="room-player-value" aria-label={bound === 'minPlayers' ? '开局人数' : '房间容量'}>{draft[bound]}</output>
  </div>;

  return <GameDialog ref={dialog} width={mobile ? 720 : 310} height={mobile ? 405 : 392} uiScale={scale}
    stageClassName="room-create-stage" data-room-create-stage="" data-room-create-dialog="" data-room-edit-dialog={editing || undefined}
    aria-label={editing ? '编辑房间' : '创建房间'} aria-busy={pending}
    onCancel={event => {event.preventDefault(); if (!pending && !composing.current) close();}}
    onCompositionStart={() => {composing.current = true;}} onCompositionEnd={() => {composing.current = false;}}
    onKeyDown={event => {
      event.stopPropagation();
      if (event.key === 'Escape') {
        event.preventDefault();
        if (!pending && !composing.current && !event.nativeEvent.isComposing && event.keyCode !== 229) escapePending.current = true;
      }
    }} onKeyUp={event => {
      event.stopPropagation();
      if (event.key === 'Escape' && escapePending.current) {
        escapePending.current = false;
        if (!pending && !composing.current && !event.nativeEvent.isComposing) close();
      }
    }}>
    <GameDialogTopbar className="room-create-topbar">
      {editing && <GameDialogTitle>编辑房间</GameDialogTitle>}
      <DialogButton kind="close" data-room-create-close="" data-create-control="close" disabled={pending}
        aria-label={editing ? '关闭编辑房间' : '关闭创建房间'} onClick={close}/>
    </GameDialogTopbar>
    <GameDialogPanel className="room-create-body" tone="room-canvas">
      <RoomCreateCard shape="metadata">
        <div className="room-create-map-heading">
          <span className="room-create-mode">{MODE_NAMES[draft.mode - 1] ?? '战斗'}</span>
          <span className="room-create-map-name" title={map?.name}>{map?.name ?? '地图不可用'}</span>
          {changeMap && <CartoonButton width={84} height={28} shape="slab" tone="orange" gradient
            className="room-create-map-change" data-room-create-change-map="" disabled={pending}
            aria-label="修改地图和模式" onClick={() => changeMap(draft, passwordAction)}>修改地图</CartoonButton>}
        </div>
        <RoomCreateCard shape="strip" className="room-create-field">
          <label htmlFor={`${id}-name`}>房名</label>
          <CartoonInput ref={nameRef} id={`${id}-name`} width={180} height={31}
            className="room-create-input" type="text" data-room-create-name="" data-create-control="name"
            aria-label="房间名称" value={draft.roomName} disabled={pending}
            onFocus={() => {lastInput.current = 'name';}} {...nameLimit}/>
        </RoomCreateCard>
        {draft.mode !== 6 && <RoomCreateCard shape="strip" className="room-create-field">
          {editing ? <select className="room-edit-password-action" aria-label="密码操作" value={passwordAction}
            disabled={pending} onChange={event => setPasswordAction(event.target.value as RoomPasswordAction)}>
            <option value="KEEP">保持密码</option><option value="REPLACE">修改密码</option><option value="CLEAR">取消密码</option>
          </select> : <label htmlFor={`${id}-password`}>密码</label>}
          <CartoonInput ref={passwordRef} id={`${id}-password`} width={180} height={31} shape="password"
            className="room-create-input" type="password" autoComplete="new-password"
            data-room-create-password="" data-create-control="password" aria-label="房间密码"
            value={editing && passwordAction !== 'REPLACE' ? '' : draft.password}
            disabled={pending || (editing && passwordAction !== 'REPLACE')}
            placeholder={editing ? passwordAction === 'KEEP' ? '保持当前密码'
              : passwordAction === 'CLEAR' ? '不设密码' : '请输入新密码' : undefined}
            onFocus={() => {lastInput.current = 'password';}} {...passwordLimit}/>
        </RoomCreateCard>}
      </RoomCreateCard>
      <RoomCreateCard shape="rules">
        <h3 className="room-create-rules-title">地图规则</h3>
        <RoomCreateCard shape="strip" className="room-create-step-row">
          <span className="room-create-field-label">人数</span>
          <div className="room-player-bounds">{playerBound('minPlayers')}<span className="room-player-range">～</span>{playerBound('maxPlayers')}</div>
        </RoomCreateCard>
        <RoomCreateCard shape="strip" className="room-create-step-row">
          <span className="room-create-field-label room-time-label">对局时间</span>
          <div className="room-time-adjustment">
            {([-1, 1] as const).map(direction => <RoomAdjustmentButton key={direction} direction={direction}
              data-room-create-time={direction} data-create-control={`time${direction}`}
              disabled={pending || timeLimit === undefined || (direction < 0
                ? timeLimit <= ROOM_TIME_LIMIT_MIN_SECONDS : timeLimit >= ROOM_TIME_LIMIT_MAX_SECONDS)}
              aria-label={`${direction < 0 ? '减少' : '增加'}对局时间一分钟`}
              onClick={() => {
                if (timeLimit === undefined) return;
                setDraft({...draft, timeLimitSeconds: Math.max(ROOM_TIME_LIMIT_MIN_SECONDS,
                  Math.min(ROOM_TIME_LIMIT_MAX_SECONDS, timeLimit + direction * ROOM_TIME_LIMIT_STEP_SECONDS))});
                setStatus('');
              }}/>)}
            <output className="room-time-value" data-room-create-time-value="" aria-label="对局时间">{timeLabel}</output>
          </div>
        </RoomCreateCard>
        <div className="room-create-rule-grid">
          <RoomRuleButton rule="cat-vs-dog" selected={draft.mode <= 3} readOnly title="由所选地图模式决定"/>
          <RoomRuleButton rule="cat-dog-mixed" selected={draft.mode > 3} readOnly title="由所选地图模式决定"/>
          {[false, true].map(enabled => <RoomRuleButton key={String(enabled)}
            rule={enabled ? 'friendly-fire' : 'no-friendly-fire'} selected={draft.friendlyFire === enabled}
            disabled={pending || draft.mode > 3} data-room-create-friendly={String(enabled)}
            data-create-control={`friendly${enabled}`} onClick={() => setDraft({...draft, friendlyFire: enabled})}/>)}
        </div>
      </RoomCreateCard>
    </GameDialogPanel>
    <GameDialogFootbar className="room-create-footer">
      <DialogButton data-room-create-confirm="" data-create-control="confirm" disabled={pending || !map}
        aria-label={editing ? '保存房间' : '确认创建房间'} onClick={() => {void confirm();}}>确定</DialogButton>
      <DialogButton data-room-create-cancel="" data-create-control="cancel" disabled={pending}
        aria-label={editing ? '取消编辑房间' : '取消创建房间'} onClick={close}>取消</DialogButton>
    </GameDialogFootbar>
    <GameMessage data-room-create-status="" text={open ? status : ''} tone={pending ? 'pending' : 'error'}/>
  </GameDialog>;
}
