import {useEffect, useRef} from 'react';
import type {PlayerTitle} from '../../../../shared/protocols/MsgRoomSnapshot';
import {SourceImageScale, SourceStaticImage} from '../resources/source-static-image';
import {sourceProps} from '../resources/source-ui-props';
import {HudBattleInfoView} from './hud-battle-info-view';
import {battleInfoText} from './battle-info-messages';
import {HomeSourceLayout, type HomeSourceUi} from '../resources/source-ui-layout';

/** Original title notice consumes this round's persisted title grants. */
export function BattleSummaryTitlePage({ui, title, scale, close, origin}: {
  ui: HomeSourceUi; title: PlayerTitle; scale: number; close(): void; origin(): HTMLElement | null;
}) {
  const suffix = 'game_summary_title.xml';
  const layout = new HomeSourceLayout(ui, suffix);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current!;
    element.show();
    element.focus();
    const timer = window.setTimeout(close, 3400);
    return () => {
      window.clearTimeout(timer);
      element.close();
      const target = origin();
      if (target?.isConnected) target.focus();
    };
  }, []);
  return <dialog ref={dialog} className="battle-summary-title-notice" aria-label="获得新称号"
    tabIndex={-1}
    data-summary-title-grant={title.id} onCancel={event => {event.preventDefault(); close();}}
    onKeyDown={event => {
      event.stopPropagation();
      if ((event.key === 'Enter' || event.key === 'Escape')
          && !event.nativeEvent.isComposing && event.keyCode !== 229) {
        event.preventDefault(); close();
      }
    }} onKeyUp={event => event.stopPropagation()}>
    <div className="battle-summary-title-stage" style={{zoom: scale}}>
      <SourceImageScale value={scale}>
        <SourceStaticImage ui={ui} layout={layout} suffix={suffix} name="wndDialog" aria-hidden="true" />
        <span {...sourceProps(ui, layout, suffix, 'txtMessage')}>
          <HudBattleInfoView ui={ui} label="获得新称号"
            text={`你获得了称号：<colour red=255 green=0 blue=0 alpha=255>${battleInfoText(title.name)}</colour>。`} />
        </span>
      </SourceImageScale>
    </div>
  </dialog>;
}
