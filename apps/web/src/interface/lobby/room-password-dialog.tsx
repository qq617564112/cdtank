import {useRef, useState} from 'react';
import './room-password-dialog.css';
import {SourceButton} from '../resources/source-button';
import {SourceImageScale, SourceStaticImage} from '../resources/source-static-image';
import {SourceStaticText} from '../resources/source-static-text';
import {HomeSourceLayout} from '../resources/source-ui-layout';
import {sourceProps, useSourceDialog, useSourceScale, useSourceUi} from './source-react';
import {useRoomInputLimit} from './room-input-limit';
import {ROOM_PASSWORD_MAX_CODEPOINTS} from '../../../../shared/room-input';

/** Join credentials use the original input-dialog imagery and the existing authoritative Join. */
export function RoomPasswordDialog({roomId, close, submit}: {
  roomId: string; close(): void; submit(password: string): Promise<void>;
}) {
  const {ui, error} = useSourceUi(true, ['userinput_dialog.xml']);
  const layout = ui ? new HomeSourceLayout(ui, 'userinput_dialog.xml') : undefined;
  const dialog = useSourceDialog(true), scale = useSourceScale(307, 120, 48, 80, .25, 2);
  const input = useRef<HTMLInputElement>(null);
  const composing = useRef(false);
  const escapePending = useRef(false);
  const [password, setPassword] = useState(''), [pending, setPending] = useState(false), [status, setStatus] = useState('');
  const inputProps = useRoomInputLimit(input, ROOM_PASSWORD_MAX_CODEPOINTS, setPassword);
  async function confirm(): Promise<void> {
    if (pending || composing.current) return;
    setPending(true); setStatus('');
    try {await submit(password);}
    catch (cause) {setStatus(String(cause)); requestAnimationFrame(() => input.current?.focus());}
    finally {setPending(false);}
  }
  return <dialog ref={dialog} data-room-password-dialog="" aria-label="房间密码" onCancel={event => {
    event.preventDefault(); if (!pending && !composing.current) close();
  }} onKeyDown={event => {
    event.stopPropagation();
    if (event.key === 'Escape') {
      event.preventDefault();
      if (!pending && !composing.current && !event.nativeEvent.isComposing) escapePending.current = true;
    }
  }} onKeyUp={event => {
    event.stopPropagation();
    if (event.key === 'Escape' && escapePending.current) {
      escapePending.current = false;
      if (!pending && !composing.current && !event.nativeEvent.isComposing) close();
    }
  }}>
    <div style={scale.viewport}><div className="room-password-stage" style={scale.stage}>
      {ui && layout && <SourceImageScale value={scale.viewport.width / 307}>
        {['shangkuang', 'shufukuangditu', 'xiakuang'].map(name => <SourceStaticImage key={name}
          ui={ui} layout={layout} suffix="userinput_dialog.xml" name={name}/>) }
        <SourceStaticText ui={ui} layout={layout} suffix="userinput_dialog.xml" name="txtMessage" text={`${roomId} 房间密码`}/>
        <form onSubmit={event => {event.preventDefault(); if (!composing.current) void confirm();}}>
          <input ref={input} {...sourceProps(ui, layout, 'userinput_dialog.xml', 'edtInput')}
            data-room-password-input="" type="password" autoComplete="off" autoFocus disabled={pending}
            aria-label="房间密码" value={password} {...inputProps}
            onCompositionStart={() => {composing.current = true; inputProps.onCompositionStart();}}
            onCompositionEnd={event => {composing.current = false; inputProps.onCompositionEnd(event);}}
            onKeyDown={event => {
              if (event.key === 'Enter' && (composing.current || event.nativeEvent.isComposing || event.keyCode === 229)) event.preventDefault();
            }}/>
          <SourceButton ui={ui} layout={layout} suffix="userinput_dialog.xml" source="btnOK"
            data-room-password-confirm="" aria-label="确定" disabled={pending} onClick={() => {void confirm();}}/>
          <SourceButton ui={ui} layout={layout} suffix="userinput_dialog.xml" source="btnCancel"
            data-room-password-cancel="" aria-label="取消" disabled={pending} onClick={close}/>
        </form>
      </SourceImageScale>}
    </div></div>
    <output data-room-password-status="" role="status" aria-live="polite" hidden={!error && !status}>{error || status}</output>
  </dialog>;
}
