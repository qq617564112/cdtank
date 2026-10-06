import './source-notice.css';
import {useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore} from 'react';
import {HomeSourceLayout, type HomeSourceUi} from '../resources/source-ui-layout';
import type {SourceNotice} from './source-notice';
import {SourceButton} from '../resources/source-button';
import {SourceImageScale, SourceStaticImage} from '../resources/source-static-image';
import {sourceProps} from '../resources/source-ui-props';

const scaleForViewport = () => Math.max(.5, Math.min(innerWidth / 800, innerHeight / 600));
/** JSX owns the complete notification modal; the controller owns its request session. */
export function SourceNoticeView({notice}: {notice: SourceNotice}) {
  const state = useSyncExternalStore(notice.subscribe, notice.getSnapshot);
  const dialog = useRef<HTMLDialogElement>(null), previousFocus = useRef<HTMLElement | null>(null);
  const [scale, setScale] = useState(scaleForViewport);
  useEffect(() => {
    const resize = () => setScale(scaleForViewport()); window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  useLayoutEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (state.open && !element.open) {
      previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      element.showModal(); element.querySelector<HTMLButtonElement>('button')?.focus();
    } else if (!state.open && element.open) {
      element.close();
      if (previousFocus.current?.isConnected) previousFocus.current.focus();
    }
  }, [state.open]);
  const layout = state.ui ? new HomeSourceLayout(state.ui, 'notify_dialog.xml') : undefined;
  return <dialog ref={dialog} data-source-notice="" aria-label="操作提示" style={{width: 315 * scale, height: 108 * scale}}
    onCancel={event => {event.preventDefault(); notice.clear();}}
    onClose={() => {if (notice.getSnapshot().open) notice.clear();}}
    onKeyDown={event => {
      event.stopPropagation();
      if (event.nativeEvent.isComposing || event.keyCode === 229) {event.preventDefault(); return;}
      if (event.key === 'Escape') {event.preventDefault(); notice.clear();}
    }}
    onKeyUp={event => event.stopPropagation()}>
    <div className="source-notice-stage" style={{transform: `scale(${scale})`}}>
      <SourceImageScale value={scale}>
        {state.open && state.ui && layout && <>
          {['SheetWindow', 'picBackgroundMask', 'shangkuang', 'xiakuang'].map(name =>
            <SourceStaticImage key={name} ui={state.ui!} layout={layout} suffix="notify_dialog.xml" name={name}
              className="source-notice-picture" hidden={name === 'picBackgroundMask'} aria-hidden="true" />)}
          <div {...sourceProps(state.ui, layout, 'notify_dialog.xml', 'txtMessage')}
            tabIndex={0} role="document" aria-label="提示内容">{state.message}</div>
          <SourceButton ui={state.ui} layout={layout} suffix="notify_dialog.xml" source="btnOK"
            aria-label="确定" autoFocus onClick={() => notice.clear()} />
        </>}
      </SourceImageScale>
    </div>
  </dialog>;
}
