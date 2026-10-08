import {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {SourceImageScale} from '../resources/source-static-image';
import {loadUiFont} from '../resources/source-ui-fonts';
import {useSourceUi} from '../lobby/source-react';
import {HistoryIntroSourcePage} from './history-intro-source-page';
import './history-intro-source-view.css';

export function HistoryIntroSourceView({open, close}: {open: boolean; close: () => void}) {
  return open ? <HistoryIntroSession close={close} /> : null;
}

/** Original 800×600 introduction sheet, independent of account match history. */
function HistoryIntroSession({close}: {close: () => void}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const escapePending = useRef(false);
  const {ui, error} = useSourceUi(true, ['history.xml']);
  const calculate = () => Math.min(innerWidth / 800, innerHeight / 600);
  const [scale, setScale] = useState(calculate);
  useLayoutEffect(() => {
    const element = dialog.current!;
    const origin = document.activeElement;
    element.showModal();
    return () => {
      const restore = document.activeElement === document.body || element.contains(document.activeElement);
      if (element.open) element.close();
      if (restore && origin instanceof HTMLElement && origin.isConnected) origin.focus();
    };
  }, []);
  useEffect(() => {
    const resize = () => setScale(calculate());
    window.addEventListener('resize', resize);
    void loadUiFont().catch(() => {});
    return () => window.removeEventListener('resize', resize);
  }, []);
  useLayoutEffect(() => {
    if (ui) dialog.current?.querySelector<HTMLButtonElement>('[data-history-intro-tab]')?.focus();
  }, [ui]);
  return <dialog ref={dialog} data-history-intro-dialog="" aria-label="阿猫阿狗介绍"
    style={{width: 800 * scale, height: 600 * scale}}
    onCancel={event => {event.preventDefault(); close();}}
    onKeyDown={event => {
      event.stopPropagation();
      if (event.key === 'Escape') {
        event.preventDefault();
        if (!event.nativeEvent.isComposing && !event.repeat) escapePending.current = true;
      }
    }} onKeyUp={event => {
      event.stopPropagation();
      if (event.key === 'Escape' && escapePending.current) {
        escapePending.current = false;
        event.preventDefault(); close();
      }
    }}>
    <div className="history-intro-stage" data-history-intro-stage="" style={{transform: `scale(${scale})`}}>
      <SourceImageScale value={scale}>
        {ui ? <HistoryIntroSourcePage ui={ui} close={close} scale={scale} /> :
          <section className="history-intro-resource-feedback" aria-label="介绍界面资源" aria-busy={!error}>
            <p role="status">{error ? '介绍界面资源未能载入，请返回后重新打开。' : '正在载入介绍界面…'}</p>
            <button type="button" data-history-intro-close="" onClick={close}>返回</button>
          </section>}
      </SourceImageScale>
    </div>
  </dialog>;
}
