import './source-confirm.css';
import {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {HomeSourceLayout} from '../resources/source-ui-layout';
import {SourceButton} from '../resources/source-button';
import {SourceImageScale, SourceStaticImage} from '../resources/source-static-image';
import {loadUiFont} from '../resources/source-ui-fonts';
import {sourceProps, useSourceUi} from '../lobby/source-react';

const suffix = 'confirm_dialog.xml';
const viewportScale = () => Math.min(innerWidth / 800, innerHeight / 600);

/** Original confirmation imagery consumes the current decision. */
export function SourceConfirmView({message, pending, disabled, status, confirm, cancel, label = '房间邀请', binding = 'web-room-invitation',
  confirmLabel = '加入房间', cancelLabel = '忽略邀请', messageLabel = '邀请内容'}: {
  label?: string; binding?: string; confirmLabel?: string; cancelLabel?: string; messageLabel?: string;
  message: string; pending: boolean; disabled: boolean; status: string;
  confirm(): void; cancel(): void;
}) {
  const {ui, error} = useSourceUi(true, [suffix]);
  const dialog = useRef<HTMLDialogElement>(null);
  const escapePending = useRef(false);
  const [scale, setScale] = useState(viewportScale);
  const layout = ui ? new HomeSourceLayout(ui, suffix) : undefined;
  useLayoutEffect(() => {
    const element = dialog.current!;
    const origin = document.activeElement;
    element.showModal();
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
    window.addEventListener('resize', resize);
    void loadUiFont().catch(() => {});
    return () => window.removeEventListener('resize', resize);
  }, []);
  useLayoutEffect(() => {
    if (!pending && (document.activeElement === document.body || document.activeElement === dialog.current)) {
      dialog.current?.querySelector<HTMLButtonElement>('[data-source-confirm-cancel]')?.focus();
    }
  }, [ui, pending]);
  const requestCancel = () => {if (!pending) cancel();};
  return <dialog ref={dialog} data-source-confirm="" data-confirm-binding={binding}
    aria-label={label} aria-busy={pending} style={{width: 315 * scale, height: 108 * scale}}
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
      <SourceImageScale value={scale}>
        {ui && layout && <>
          {['SheetWindow', 'picBackgroundMask', 'shangkuang', 'xiakuang'].map(name =>
            <SourceStaticImage key={name} ui={ui} layout={layout} suffix={suffix} name={name}
              className="source-confirm-picture" aria-hidden="true" />)}
          <div {...sourceProps(ui, layout, suffix, 'txtMessage')} role="document" aria-label={messageLabel}>{message}</div>
          <SourceButton ui={ui} layout={layout} suffix={suffix} source="btnOK" data-source-confirm-ok=""
            aria-label={confirmLabel} disabled={pending || disabled} onClick={confirm}/>
          <SourceButton ui={ui} layout={layout} suffix={suffix} source="btnCancel" data-source-confirm-cancel=""
            aria-label={cancelLabel} disabled={pending} onClick={requestCancel}/>
        </>}
      </SourceImageScale>
      <output className="source-confirm-status" role="status" aria-live="polite" hidden={!error && !status}>{error || status}</output>
      {!ui && <button type="button" data-source-confirm-cancel="" disabled={pending} onClick={requestCancel}>{cancelLabel}</button>}
    </div>
  </dialog>;
}
