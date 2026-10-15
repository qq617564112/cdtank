import {accountPageScale, subscribeGamePageViewport} from '../../platform/page-viewport';
import {GameMessage} from '../resources/game-message';
import {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {GameDialog, GameDialogFootbar, GameDialogPanel, GameDialogTopbar} from '../resources/game-dialog';
import {DialogButton} from '../resources/dialog-button';

/** Battle departure shares the painted dialog frame and native HTML labels. */
export function BattleExitConfirmView({message, pending, disabled, status, confirm, cancel, label,
  binding, confirmLabel, cancelLabel, messageLabel}: {
  label: string; binding: string; confirmLabel: string; cancelLabel: string; messageLabel: string;
  message: string; pending: boolean; disabled: boolean; status: string;
  confirm(): void; cancel(): void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [scale, setScale] = useState(() => accountPageScale());
  useLayoutEffect(() => {
    const element = dialog.current!;
    element.showModal();
    element.querySelector<HTMLButtonElement>('[data-source-confirm-cancel]')?.focus();
    return () => {
      if (element.open) element.close();
      document.querySelector<HTMLCanvasElement>('canvas')?.focus();
    };
  }, []);
  useEffect(() => {
    const resize = () => setScale(accountPageScale());
    return subscribeGamePageViewport(resize);
  }, []);
  return <GameDialog ref={dialog} width={420} height={248} uiScale={scale}
    data-source-confirm="" data-confirm-binding={binding} className="battle-exit-confirm"
    aria-label={label} aria-busy={pending}
    onCancel={event => {event.preventDefault(); if (!pending) cancel();}}
    onKeyDown={event => {
      event.stopPropagation();
      if (event.key === 'Escape') {
        event.preventDefault();
        if (!pending && !event.nativeEvent.isComposing) cancel();
      }
    }} onKeyUp={event => event.stopPropagation()}>
    <GameDialogTopbar><h2 className="battle-exit-title">退出确认</h2></GameDialogTopbar>
    <GameDialogPanel className="battle-exit-content">
      <p role="document" aria-label={messageLabel}>{message}</p>
      <GameMessage text={status} tone={pending ? 'pending' : 'info'}/>
    </GameDialogPanel>
    <GameDialogFootbar className="battle-exit-actions">
      <DialogButton data-source-confirm-ok="" disabled={pending || disabled} onClick={confirm}>
        {confirmLabel}
      </DialogButton>
      <DialogButton data-source-confirm-cancel="" disabled={pending} onClick={cancel}>
        {cancelLabel}
      </DialogButton>
    </GameDialogFootbar>
  </GameDialog>;
}
