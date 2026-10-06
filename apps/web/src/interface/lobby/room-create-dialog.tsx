import {useLayoutEffect, useRef, useState} from 'react';
import './room-create-dialog.css';
import type {MapOption} from '../../../../shared/protocols/PtlListMaps';
import type {RoomCreateDraft} from './room-create-draft';
import {validateRoomCreateDraft, changeRoomCreateBound} from './room-create-draft';
import {HomeSourceLayout} from '../resources/source-ui-layout';
import {roomModeIconReference} from './room-mode-icons';
import {sourceProps, useSourceDialog, useSourceUi} from './source-react';

import {RoomCreateImageScale, RoomCreatePasswordSelection, RoomCreateSourceImage, RoomCreateSourceMask, roomCreateInputVisual, useRoomCreateVisual} from './room-create-source-visual';
import {RoomCreateCaret} from './room-create-caret';
import {RoomCreateNameSelection} from './room-create-name-selection';
import {SourceButton} from '../resources/source-button';
import {ROOM_NAME_MAX_CODEPOINTS, ROOM_PASSWORD_MAX_CODEPOINTS} from '../../../../shared/room-input';
import {useRoomInputLimit} from './room-input-limit';
import {SourceFeedbackText} from '../resources/source-feedback-text';

export type RoomPasswordAction = 'KEEP' | 'REPLACE' | 'CLEAR';

interface RoomCreateDialogProps {
  open: boolean; close(): void; initialDraft: RoomCreateDraft; map?: MapOption;
  editing?: boolean;
  initialPasswordAction?: RoomPasswordAction;
  changeMap?(draft: RoomCreateDraft, passwordAction: RoomPasswordAction): void;
  submit(draft: RoomCreateDraft, passwordAction?: RoomPasswordAction): Promise<void>;
}

export function RoomCreateDialog({open, close, initialDraft, map, submit, editing = false, initialPasswordAction = 'KEEP', changeMap}: RoomCreateDialogProps) {
  const [draft, setDraft] = useState<RoomCreateDraft>(() => ({...initialDraft}));
  const [pending, setPending] = useState(false), [status, setStatus] = useState('');
  const [passwordAction, setPasswordAction] = useState<RoomPasswordAction>(initialPasswordAction);
  const lastInput = useRef<'name' | 'password'>('name');
  const restoreInputFocus = useRef(false);
  const composing = useRef(false), escapePending = useRef(false);
  const nameRef = useRef<HTMLInputElement>(null), passwordRef = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => {
    if (pending || !restoreInputFocus.current) return;
    restoreInputFocus.current = false;
    (lastInput.current === 'password' ? passwordRef.current : nameRef.current)?.focus();
  }, [pending]);
  const {ui, error} = useSourceUi(open, ['createroom.xml']);
  const dialog = useSourceDialog(open), scale = useRoomCreateVisual(open);
  const nameLimit = useRoomInputLimit(nameRef, ROOM_NAME_MAX_CODEPOINTS, value => setDraft(previous => ({...previous, roomName: value})), !!ui);
  const passwordLimit = useRoomInputLimit(passwordRef, ROOM_PASSWORD_MAX_CODEPOINTS, value => setDraft(previous => ({...previous, password: value})), !!ui);
  const layout = ui ? new HomeSourceLayout(ui, 'createroom.xml') : undefined;
  const place = (name: string, image?: string) => sourceProps(ui!, layout!, 'createroom.xml', name, image, -246, -130);
  const image = (name: string, text?: string, reference?: string) => text === undefined
    ? <RoomCreateSourceImage key={name} ui={ui!} layout={layout!} name={name} reference={reference}/>
    : <span key={name} className="room-create-source-text" {...place(name)}>{text}</span>;
  const button = (name: string, control: string, label: string, action: () => void, disabled = false, selected = false, data: Record<string, string> = {}) =>
    <SourceButton key={name} ui={ui!} layout={layout!} source={name} suffix="createroom.xml" offsetX={-246} offsetY={-130}
      data-create-control={control} disabled={pending || disabled} aria-label={label} title={label} selected={selected} onClick={action} {...data}/>;
  async function confirm() {
    if (pending) return;
    try {validateRoomCreateDraft(draft, map);} catch (reason) {setStatus(String(reason)); return;}
    if (editing && passwordAction === 'REPLACE' && !draft.password) {
      setStatus('请输入新密码，或选择取消密码');
      return;
    }
    setPending(true); setStatus(editing ? '正在保存房间…' : '正在创建房间…');
    try {await submit(draft, editing ? passwordAction : undefined); close();}
    catch (reason) {setStatus(String(reason));}
    finally {
      restoreInputFocus.current = true;
      setPending(false);
    }
  }
  return <dialog ref={dialog} data-room-create-dialog="" data-room-edit-dialog={editing || undefined} aria-label={editing ? '编辑房间' : '创建房间'} onCancel={event => {
    event.preventDefault();
    if (!pending && !composing.current) close();
  }} onCompositionStart={() => {composing.current = true;}}
    onCompositionEnd={() => {composing.current = false;}}
    onKeyDown={event => {
      event.stopPropagation();
      if (event.key === 'Escape') {
        event.preventDefault();
        if (!pending && !composing.current && !event.nativeEvent.isComposing && event.keyCode !== 229) {
          escapePending.current = true;
        }
      }
    }} onKeyUp={event => {
      event.stopPropagation();
      if (event.key === 'Escape' && escapePending.current) {
        escapePending.current = false;
        if (!pending && !composing.current && !event.nativeEvent.isComposing) close();
      }
    }}>
    {ui && layout && <RoomCreateSourceMask ui={ui} layout={layout} scale={scale.scale} viewportWidth={scale.viewportWidth} viewportHeight={scale.viewportHeight}/>}
    <div className="room-create-viewport" style={scale.viewport}><div className="room-create-stage" data-room-create-stage="" style={scale.stage}>
      {ui && layout && <RoomCreateImageScale value={scale.scale}>
        {['daditu','heseditu','xiaoditu','ditu2','tiao1','ditu1','tiao2','ditu4','ditu3','tiao7','daos','fangming','renshu','dituguize','hongtiaotiao', ...(!editing ? ['mima'] : [])].map(name => image(name))}
        {image('picGameMode', undefined, roomModeIconReference(draft.mode))}
        {editing && changeMap ? <button type="button" className="room-edit-map-button" {...place('txtMapName')}
          aria-label="重新选择地图和模式" title="重新选择地图和模式" disabled={pending}
          onClick={() => changeMap(draft, passwordAction)}><SourceFeedbackText text={map?.name ?? '选择地图'}/></button>
          : <span className="room-create-source-text" {...place('txtMapName')} title={map?.name ?? ''}>{map?.name ?? '地图不可用'}</span>}
        {image('txtLowBound', String(draft.minPlayers))}{image('txtHighBound', String(draft.maxPlayers))}
        <input ref={nameRef} {...place('edtRoomName')} style={{...place('edtRoomName').style, ...roomCreateInputVisual(layout, 'edtRoomName')}} type="text" data-room-create-name="" data-create-control="name" aria-label="房间名称"
          value={draft.roomName} disabled={pending} onFocus={() => {lastInput.current = 'name';}} {...nameLimit}/>
        <input ref={passwordRef} {...place('edtPassword')} style={{...place('edtPassword').style, ...roomCreateInputVisual(layout, 'edtPassword')}} type="password" autoComplete="new-password" data-room-create-password="" data-create-control="password" aria-label="房间密码"
          value={editing && passwordAction !== 'REPLACE' ? '' : draft.password} disabled={pending || (editing && passwordAction !== 'REPLACE')}
          placeholder={editing ? passwordAction === 'KEEP' ? '保持当前密码' : passwordAction === 'CLEAR' ? '不设密码' : '请输入新密码' : undefined}
          onFocus={() => {lastInput.current = 'password';}} {...passwordLimit}/>
        {editing && <select className="room-edit-password-action" aria-label="密码操作" value={passwordAction} disabled={pending}
          style={{backgroundImage: place('tiao7', layout.control('tiao7').properties.Image).style.backgroundImage}}
          onChange={event => setPasswordAction(event.target.value as RoomPasswordAction)}>
          <option value="KEEP">保持密码</option><option value="REPLACE">修改密码</option><option value="CLEAR">取消密码</option>
        </select>}
        <RoomCreatePasswordSelection input={passwordRef} style={place('edtPassword').style}/>
        <RoomCreateNameSelection input={nameRef} style={place('edtRoomName').style} disabled={pending}/>
        <RoomCreateCaret input={nameRef} ui={ui} layout={layout} name="edtRoomName" style={place('edtRoomName').style} disabled={pending}/>
        <RoomCreateCaret input={passwordRef} ui={ui} layout={layout} name="edtPassword" style={place('edtPassword').style} disabled={pending}/>
        {(['minPlayers','maxPlayers'] as const).flatMap(bound => [-1, 1].map(delta => {
          let allowed = !!map;
          if (map) try {changeRoomCreateBound(draft, map, bound, delta);} catch {allowed = false;}
          const low = bound === 'minPlayers';
          return button(`btn${delta < 0 ? 'Dec' : 'Inc'}${low ? 'Low' : 'High'}Bound`, `${low ? 'low' : 'high'}${delta}`,
            `${delta < 0 ? '减少' : '增加'}${low ? '开局人数' : '房间容量'}`, () => {
              if (map) {setDraft(changeRoomCreateBound(draft, map, bound, delta)); setStatus('');}
            }, !allowed, false, {[low ? 'data-room-create-low' : 'data-room-create-high']: String(delta)});
        }))}
        {[false, true].map(enabled => button(enabled ? 'rdoFriendlyFireOn' : 'rdoFriendlyFireOff', `friendly${enabled}`,
          enabled ? '允许伤害队友' : '禁止伤害队友', () => setDraft({...draft, friendlyFire: enabled}), draft.mode > 3, draft.friendlyFire === enabled,
          {'data-room-create-friendly': String(enabled), 'aria-pressed': String(draft.friendlyFire === enabled)}))}
        {(['rdoCatVsDog', 'rdoNonCatVsDog'] as const).map((name, index) => <SourceButton key={name}
          ui={ui} layout={layout} source={name} suffix="createroom.xml" offsetX={-246} offsetY={-130} selected={(draft.mode <= 3) === (index === 0)} disabled
          aria-label={index === 0 ? '团队模式' : '个人模式'} aria-disabled="true"/>)}
        {button('btnOK', 'confirm', editing ? '保存房间' : '确认创建房间', () => {void confirm();}, !map, false, {'data-room-create-confirm': ''})}
        {button('btnCancel', 'cancel', editing ? '取消编辑房间' : '取消创建房间', close, false, false, {'data-room-create-cancel': ''})}
        {button('btnClose', 'close', editing ? '关闭编辑房间' : '关闭创建房间', close, false, false, {'data-room-create-close': ''})}
      </RoomCreateImageScale>}
    </div></div>
    <output data-room-create-status="" role="status">{(error || scale.fontError) ? `原建房资源载入失败：${error || scale.fontError}；按Escape返回后重试`
      : !ui ? editing ? '正在载入房间编辑…' : '正在载入创建房间…' : status}</output>
  </dialog>;
}
