import {useId, useLayoutEffect, useRef, type ReactNode} from 'react';
import {useSourceScale} from '../lobby/source-react';
import {GameDialog, GameDialogFootbar, GameDialogPanel, GameDialogTopbar} from './game-dialog';
import './loading-error-dialog.css';

/** Loading failures remain visible until the loading page clears the error. */
export function LoadingErrorDialog({message, details, actions}: {
  message: string; details?: string; actions?: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  const {viewport} = useSourceScale(800, 600, 0, 0, 0.1, Infinity);
  const scale = viewport.width / 800;
  useLayoutEffect(() => {
    const element = dialog.current!;
    element.showModal();
    return () => {if (element.open) element.close();};
  }, []);
  return <GameDialog ref={dialog} width={480} uiScale={scale} className="loading-error-dialog"
    data-loading-error-dialog="" role="alertdialog" aria-labelledby={`${id}-title`}
    aria-describedby={`${id}-message${details ? ` ${id}-details` : ''}`}
    onCancel={event => event.preventDefault()}
    onKeyDown={event => {
      event.stopPropagation();
      if (event.key === 'Escape') event.preventDefault();
    }} onKeyUp={event => event.stopPropagation()}>
    <GameDialogTopbar><h2 id={`${id}-title`} className="loading-error-title">加载失败</h2></GameDialogTopbar>
    <GameDialogPanel className="loading-error-content">
      <p id={`${id}-message`}>{message}</p>
      {details && <p id={`${id}-details`} className="loading-error-details">{details}</p>}
    </GameDialogPanel>
    <GameDialogFootbar className="loading-error-actions">{actions}</GameDialogFootbar>
  </GameDialog>;
}
