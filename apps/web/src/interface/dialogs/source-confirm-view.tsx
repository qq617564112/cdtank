import {accountPageScale, subscribeGamePageViewport} from '../../platform/page-viewport';
import {isMobileDevice} from '../../platform/device';
import {GameMessage} from '../resources/game-message';
import './source-confirm.css';
import {useEffect, useId, useLayoutEffect, useRef, useState} from 'react';
import {DialogButton} from '../resources/dialog-button';
import {GameConfirmFrame} from '../resources/game-confirm-frame';

const viewportScale = () => accountPageScale();

/** Native confirmation controls share the shop's two-panel SVG frame. */
export function SourceConfirmView({message, pending, disabled, status, confirm, cancel, label = '房间邀请', binding = 'web-room-invitation',
  confirmLabel = '确定', cancelLabel = '取消', messageLabel = '确认内容'}: {
  label?: string; binding?: string; confirmLabel?: string; cancelLabel?: string; messageLabel?: string;
  message: string; pending: boolean; disabled: boolean; status: string;
  confirm(): void; cancel(): void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const messageId = useId();
  const escapePending = useRef(false);
  const [scale, setScale] = useState(viewportScale);
  const mobile = isMobileDevice();
  const width = mobile ? 480 : 315, height = mobile ? 200 : 108;
  useLayoutEffect(() => {
    const element = dialog.current!;
    const origin = document.activeElement;
    element.showModal();
    element.querySelector<HTMLButtonElement>('[data-source-confirm-cancel]')?.focus();
    return () => {
      const restore = document.activeElement === document.body || element.contains(document.activeElement);
      if (element.open) element.close();
      if (restore) {
        if (origin instanceof HTMLElement && origin !== document.body && origin.isConnected) origin.focus();
        else document.querySelector<HTMLButtonElement>('[data-room-card-create]')?.focus();
      }
    };
  }, []);
  useEffect(() => {
    const resize = () => setScale(viewportScale());
    return subscribeGamePageViewport(resize);
  }, []);
  useLayoutEffect(() => {
    if (!pending && (document.activeElement === document.body || document.activeElement === dialog.current)) {
      dialog.current?.querySelector<HTMLButtonElement>('[data-source-confirm-cancel]')?.focus();
    }
  }, [pending]);
  const requestCancel = () => {if (!pending) cancel();};
  return <dialog ref={dialog} className="game-confirm-dialog" data-source-confirm="" data-confirm-binding={binding}
    aria-label={label} aria-describedby={messageId} aria-busy={pending} style={{width: width * scale, height: height * scale}}
    onCancel={event => {event.preventDefault(); requestCancel();}}
    onKeyDown={event => {
      event.stopPropagation();
      if (event.key === 'Escape') {
        event.preventDefault();
        if (!event.nativeEvent.isComposing && !pending) escapePending.current = true;
      }
    }} onKeyUp={event => {
      event.stopPropagation();
      if (event.key === 'Escape' && escapePending.current) {
        escapePending.current = false;
        requestCancel();
      }
    }}>
    <div className="source-confirm-stage" style={{transform: `scale(${scale})`}}>
      <GameConfirmFrame width={width} height={height} headerHeight={mobile ? 112 : 56}/>
      <div id={messageId} data-source-control="txtMessage" data-source-layout="ui/layouts/confirm_dialog.xml"
        role="document" aria-label={messageLabel}>{message}</div>
      <DialogButton data-source-control="btnOK" data-source-layout="ui/layouts/confirm_dialog.xml" data-source-confirm-ok=""
        aria-label={confirmLabel} disabled={pending || disabled} onClick={confirm}>确定</DialogButton>
      <DialogButton data-source-control="btnCancel" data-source-layout="ui/layouts/confirm_dialog.xml" data-source-confirm-cancel=""
        aria-label={cancelLabel} disabled={pending} onClick={requestCancel}>取消</DialogButton>
      <GameMessage text={status} tone={pending ? 'pending' : 'info'}/>
    </div>
  </dialog>;
}
