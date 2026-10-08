import './battle-play-page.css';
import {useEffect, useState, type ReactNode} from 'react';
import type {LeavePenalty} from '../../../../shared/protocols/PtlLeave';
import {useSourceUi} from '../lobby/source-react';
import {SourceButton} from '../resources/source-button';
import {SourceImageScale} from '../resources/source-static-image';
import {HomeSourceLayout} from '../resources/source-ui-layout';
import {useBattleExitConfirm} from './battle-exit-confirm';

/** The source battle sheet anchors exit and feedback beside the HUD. */
export function BattlePlayPage({roomId, round, busy, canLeave, quote, leave, feedback}: {
  roomId: string; round: number; busy: boolean; canLeave: boolean; quote: () => Promise<LeavePenalty>;
  leave: (confirmedPenaltyPoints?: number) => Promise<void>;
  feedback: ReactNode;
}) {
  const {ui, error} = useSourceUi(true, ['game_main.xml']);
  const {requestLeave, confirmation, pending, status} =
    useBattleExitConfirm(roomId, round, busy, canLeave, quote, leave);
  const [size, setSize] = useState(() => ({width: innerWidth, height: innerHeight}));
  useEffect(() => {
    const resize = () => setSize({width: innerWidth, height: innerHeight});
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  const scale = Math.min(size.width / 800, size.height / 600);
  const sideOffset = (size.width / scale - 800) / 2;
  return <section data-match-panel="" data-phase="PLAYING" data-round={round}
    data-formal-battle-page="" aria-label="战斗操作">
    <div className="battle-play-stage" data-battle-play-stage="" style={{left: (size.width - 800 * scale) / 2,
      top: (size.height - 600 * scale) / 2, transform: `scale(${scale})`}}
      onKeyDown={event => event.stopPropagation()} onKeyUp={event => event.stopPropagation()}>
      <SourceImageScale value={scale}>
        {ui ? <SourceButton ui={ui} layout={new HomeSourceLayout(ui, 'game_main.xml')} suffix="game_main.xml"
          source="btnExit" offsetX={sideOffset} data-leave-room="" aria-label="离开房间" disabled={busy || pending || !canLeave} onClick={requestLeave}/>
          : <button className="battle-play-loading-exit" type="button" data-leave-room=""
            style={{left: 747 + sideOffset}} disabled={busy || pending || !canLeave} onClick={requestLeave}>离开房间</button>}
        <div className="battle-play-feedback">{feedback}{error && <output role="status">{error}</output>}
          {status && !confirmation && <output role="status">{status}</output>}
        </div>
      </SourceImageScale>
    </div>
    {confirmation}
  </section>;
}
