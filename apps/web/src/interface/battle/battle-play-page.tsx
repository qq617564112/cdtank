import {GameMessage} from '../resources/game-message';
import './battle-play-page.css';
import {useEffect, useRef, useState, type ReactNode} from 'react';
import type {LeavePenalty} from '../../../../shared/protocols/PtlLeave';
import {useBattleExitConfirm} from './battle-exit-confirm';

/** Escape opens the server-quoted departure confirmation during battle. */
export function BattlePlayPage({roomId, round, busy, canLeave, quote, leave, feedback, exitRequest = 0}: {
  roomId: string; round: number; busy: boolean; canLeave: boolean; quote: () => Promise<LeavePenalty>;
  leave: (confirmedPenaltyPoints?: number) => Promise<void>; feedback: ReactNode;
  exitRequest?: number;
}) {
  const {requestLeave, confirmation, pending, status} =
    useBattleExitConfirm(roomId, round, busy, canLeave, quote, leave);
  const request = useRef(requestLeave);
  request.current = requestLeave;
  const previousExit = useRef(exitRequest);
  useEffect(() => {
    if (previousExit.current === exitRequest) return;
    previousExit.current = exitRequest;
    request.current();
  }, [exitRequest]);
  const [size, setSize] = useState(() => ({width: innerWidth, height: innerHeight}));
  useEffect(() => {
    let escapeHeld = false;
    const resize = () => setSize({width: innerWidth, height: innerHeight});
    const keydown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.repeat || event.defaultPrevented || event.isComposing
          || event.keyCode === 229 || document.querySelector('dialog:modal')) return;
      if (event.target instanceof HTMLElement && (event.target.closest('input, textarea, select')
          || event.target.closest('.source-battle-chat') || event.target.isContentEditable)) return;
      event.preventDefault(); event.stopImmediatePropagation(); escapeHeld = true;
    };
    const keyup = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !escapeHeld) return;
      escapeHeld = false;
      event.preventDefault(); event.stopImmediatePropagation(); request.current();
    };
    const blur = () => {escapeHeld = false;};
    window.addEventListener('resize', resize);
    window.addEventListener('keydown', keydown, true);
    window.addEventListener('keyup', keyup, true);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('keydown', keydown, true);
      window.removeEventListener('keyup', keyup, true);
      window.removeEventListener('blur', blur);
    };
  }, []);
  const scale = Math.min(size.width / 800, size.height / 600);
  return <section data-match-panel="" data-phase="PLAYING" data-round={round}
    data-formal-battle-page="" aria-label="战斗操作" aria-busy={pending}>
    <div className="battle-play-stage" data-battle-play-stage="" style={{left: (size.width - 800 * scale) / 2,
      top: (size.height - 600 * scale) / 2, transform: `scale(${scale})`}}>
      <div className="battle-play-feedback">{feedback}
        <GameMessage text={confirmation ? '' : status} tone="error"/>
      </div>
    </div>
    {confirmation}
  </section>;
}
