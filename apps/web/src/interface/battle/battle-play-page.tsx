import './battle-play-page.css';
import {useEffect, useRef, useState, type ReactNode} from 'react';
import {useSourceUi} from '../lobby/source-react';
import {SourceButton} from '../resources/source-button';
import {SourceImageScale} from '../resources/source-static-image';
import {HomeSourceLayout} from '../resources/source-ui-layout';

/** The source battle sheet anchors exit and supplementary match controls beside the HUD. */
export function BattlePlayPage({round, busy, canLeave, leave, feedback, children}: {
  round: number; busy: boolean; canLeave: boolean; leave: () => void;
  feedback: ReactNode; children: ReactNode;
}) {
  const {ui, error} = useSourceUi(true, ['game_main.xml']);
  const [size, setSize] = useState(() => ({width: innerWidth, height: innerHeight}));
  const tools = useRef<HTMLDetailsElement>(null), summary = useRef<HTMLElement>(null);
  useEffect(() => {
    const resize = () => setSize({width: innerWidth, height: innerHeight});
    const keydown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented || event.isComposing || !tools.current?.open) return;
      const target = event.target;
      if (!(target instanceof HTMLElement) || (target !== document.body && !tools.current.contains(target))
          || target.closest('input, select, textarea, [contenteditable]')) return;
      event.preventDefault(); tools.current.open = false; summary.current?.focus();
    };
    window.addEventListener('resize', resize);
    window.addEventListener('keydown', keydown);
    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('keydown', keydown);
    };
  }, []);
  const scale = Math.min(size.width / 800, size.height / 600);
  return <section data-match-panel="" data-phase="PLAYING" data-round={round}
    data-formal-battle-page="" aria-label="对局控制">
    <div className="battle-play-stage" data-battle-play-stage="" style={{left: (size.width - 800 * scale) / 2,
      top: (size.height - 600 * scale) / 2, transform: `scale(${scale})`}}
      onKeyDown={event => {
        event.stopPropagation();
        if (event.key === 'Escape' && tools.current?.open) {
          event.preventDefault(); tools.current.open = false; summary.current?.focus();
        }
      }} onKeyUp={event => event.stopPropagation()}>
      <SourceImageScale value={scale}>
        {ui ? <SourceButton ui={ui} layout={new HomeSourceLayout(ui, 'game_main.xml')} suffix="game_main.xml"
          source="btnExit" data-leave-room="" aria-label="离开房间" disabled={busy || !canLeave} onClick={leave}/>
          : <button className="battle-play-loading-exit" type="button" data-leave-room=""
            disabled={busy || !canLeave} onClick={leave}>离开房间</button>}
        <div className="battle-play-feedback">{feedback}</div>
        <details ref={tools} className="battle-play-tools" data-battle-play-tools="">
          <summary ref={summary} data-battle-play-summary="">对局控制</summary>
          <div className="battle-play-tool-content">{children}{error && <output role="status">{error}</output>}</div>
        </details>
      </SourceImageScale>
    </div>
  </section>;
}
