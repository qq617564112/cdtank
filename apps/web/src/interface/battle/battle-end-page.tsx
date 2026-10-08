import './battle-end-page.css';
import {useLayoutEffect, useRef} from 'react';
import {BattleNoticeArtwork} from './battle-notice-artwork';

/** Keep the frozen battlefield visible until the account settlement receipt arrives. */
export function BattleEndPage({round, settlementReady}: {round: number; settlementReady: boolean}) {
  const dialog = useRef<HTMLDialogElement>(null);

  useLayoutEffect(() => {
    const element = dialog.current;
    if (!element) return;
    const block = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    window.addEventListener('keydown', block, true);
    window.addEventListener('keyup', block, true);
    element.showModal();
    element.focus();
    return () => {
      window.removeEventListener('keydown', block, true);
      window.removeEventListener('keyup', block, true);
      element.close();
    };
  }, []);

  return <dialog ref={dialog} className="battle-end-page" tabIndex={-1}
    data-match-panel="" data-phase="FINISHED" data-round={round} data-battle-ending=""
    aria-label="战斗结束" aria-busy={!settlementReady} onCancel={event => event.preventDefault()}>
    <div className="battle-end-notice" role="status">
      <div className="battle-end-banner">
        <BattleNoticeArtwork name="picModeSplash" className="battle-end-burst" aria-hidden="true"
          data-source-layout="ui/layouts/game_main.xml" data-source-control="picModeSplash" />
        <h1>战斗结束</h1>
      </div>
      <p>{settlementReady ? '正在进入结算…' : '正在结算，请稍候…'}</p>
    </div>
  </dialog>;
}
