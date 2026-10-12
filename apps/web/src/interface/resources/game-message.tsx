import {useEffect, useLayoutEffect, useRef, useSyncExternalStore,
  type ComponentPropsWithoutRef, type CSSProperties} from 'react';
import {createPortal} from 'react-dom';
import {dismissGameMessage, GAME_MESSAGE_ENTER_MS, GAME_MESSAGE_EXIT_MS, GAME_MESSAGE_HOLD_MS,
  getGameMessages, showGameMessage, subscribeGameMessages, type GameMessageTone} from './game-message-store';
import './game-message.css';

export {showGameMessage} from './game-message-store';

/** A page publishes each new message; the shared host owns its complete display time. */
export function GameMessage({text, tone = 'info', ...attributes}:
  Omit<ComponentPropsWithoutRef<'span'>, 'children'> & {text?: string; tone?: GameMessageTone}) {
  useEffect(() => {if (text) showGameMessage(text, tone);}, [text, tone]);
  return <span {...attributes} hidden aria-hidden="true">{text}</span>;
}

/** A manual popover places feedback above native dialogs without moving keyboard focus. */
export function GameMessageHost() {
  const messages = useSyncExternalStore(subscribeGameMessages, getGameMessages);
  const message = messages[0];
  const host = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = host.current;
    if (!element) return;
    const lift = () => {
      const time = element.getAnimations({subtree: true})[0]?.currentTime;
      if (element.matches(':popover-open')) element.hidePopover();
      element.showPopover();
      if (time !== undefined && time !== null) {
        for (const animation of element.getAnimations({subtree: true})) animation.currentTime = time;
      }
    };
    if (!message) {
      if (element.matches(':popover-open')) element.hidePopover();
      return;
    }
    lift();
    const dialogs = new MutationObserver(records => {
      if (records.some(record => record.target instanceof HTMLDialogElement && record.target.open)) lift();
    });
    dialogs.observe(document.body, {subtree: true, attributes: true, attributeFilter: ['open']});
    return () => dialogs.disconnect();
  }, [message?.id]);
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => dismissGameMessage(message.id),
      GAME_MESSAGE_ENTER_MS + GAME_MESSAGE_HOLD_MS + GAME_MESSAGE_EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [message?.id]);
  const duration = GAME_MESSAGE_ENTER_MS + GAME_MESSAGE_HOLD_MS + GAME_MESSAGE_EXIT_MS;
  return createPortal(<div ref={host} className="game-message-host" popover="manual"
    role="status" aria-live="polite" aria-atomic="true" aria-label="游戏提示"
    style={{'--game-message-duration': `${duration}ms`} as CSSProperties}>
    {message && <div key={message.id} className="game-message" data-game-message-tone={message.tone}>
      <svg className="game-message-frame" viewBox="0 0 360 88" preserveAspectRatio="none"
        aria-hidden="true" focusable="false">
        <path d="M12 4L348 6 356 16 354 72 345 82 13 84 4 73 6 15Z" fill="#b58b48"
          stroke="#414b25" strokeWidth="4" strokeLinejoin="round"/>
        <path d="M15 11L344 13 349 20 347 68 341 75 17 77 11 68 13 21Z" fill="#fff0c5"
          stroke="#ffe7a0" strokeWidth="3" strokeLinejoin="round"/>
        <path d="M20 17L339 19M20 71L337 69" fill="none" stroke="#c69b55" strokeWidth="1.5"/>
        <path d="M57 7L125 8M224 80L303 79" fill="none" stroke="#fff7d5" strokeWidth="2"
          strokeLinecap="round"/>
        {[18, 342].map(x => <g key={x} fill="#705331" stroke="#f4d486" strokeWidth="1">
          <circle cx={x} cy="24" r="3"/><circle cx={x} cy="65" r="3"/>
        </g>)}
      </svg>
      <span className="game-message-badge" aria-hidden="true">
        {message.tone === 'success' ? '✓' : message.tone === 'error' ? '!' : message.tone === 'pending' ? '…' : 'i'}
      </span>
      <span className="game-message-text">{message.text}</span>
    </div>}
  </div>, document.body);
}
