import './gm-support.css';
import {useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore} from 'react';
import type {GmSupportInbox, GmSupportInboxState} from '../../network/gm-support';
import type {GmSupportReply} from '../../../../shared/protocols/PtlGmSupport';

function timeText(value: number): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString('zh-CN', {hour12: false}) : '';
}

function dateTime(value: number): string | undefined {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : undefined;
}

/** The player-facing GM reply entry stays independent from room chat presentation. */
export function GmSupportView({inbox}: {inbox: GmSupportInbox}) {
  const state = useSyncExternalStore(inbox.subscribe, inbox.getSnapshot, inbox.getSnapshot);
  const [open, setOpen] = useState(false);
  const origin = useRef<HTMLButtonElement | null>(null);
  const openGeneration = useRef(state.contextGeneration);

  useEffect(() => {
    if (open && state.contextGeneration !== openGeneration.current) setOpen(false);
  }, [open, state.contextGeneration]);
  useEffect(() => {
    if (open) void inbox.refresh();
  }, [inbox, open]);
  useEffect(() => {
    if (open) inbox.markAllRead();
  }, [inbox, open, state.replies]);

  const show = () => {
    origin.current = document.activeElement instanceof HTMLButtonElement ? document.activeElement : null;
    openGeneration.current = state.contextGeneration;
    setOpen(true);
  };

  return <>
    <button className="gm-support-entry" type="button" data-gm-support-open=""
      aria-haspopup="dialog" aria-controls="gm-support-dialog" aria-expanded={open} onClick={show}>
      GM回复
      {state.unread > 0 && <span className="gm-support-unread" aria-label={`${state.unread}条未读`}>
        {state.unread > 99 ? '99+' : state.unread}
      </span>}
    </button>
    {open && <GmSupportDialog inbox={inbox} state={state} origin={origin.current} close={() => setOpen(false)}/>}
  </>;
}

function GmSupportDialog({inbox, state, origin, close}: {
  inbox: GmSupportInbox;
  state: GmSupportInboxState;
  origin: HTMLButtonElement | null;
  close: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [viewport, setViewport] = useState(() => ({width: innerWidth, height: innerHeight}));

  useEffect(() => {
    const resize = () => setViewport({width: innerWidth, height: innerHeight});
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useLayoutEffect(() => {
    const element = dialog.current!;
    element.showModal();
    element.querySelector<HTMLButtonElement>('[data-gm-support-close]')?.focus();
    return () => {
      const restore = document.activeElement === document.body || element.contains(document.activeElement);
      if (element.open) element.close();
      if (restore && origin?.isConnected && !origin.disabled) origin.focus();
    };
  }, [origin]);

  return <dialog ref={dialog} id="gm-support-dialog" aria-labelledby="gm-support-title"
    aria-busy={state.loading} data-gm-support-dialog=""
    style={{width: `min(44rem, ${Math.max(1, viewport.width - 32)}px)`,
      maxHeight: `min(38rem, ${Math.max(1, viewport.height - 32)}px)`}}
    onCancel={event => {event.preventDefault(); close();}}
    onKeyDown={event => {
      event.stopPropagation();
      if ((event.key === 'Enter' || event.key === 'Escape')
          && (event.nativeEvent.isComposing || event.keyCode === 229)) event.preventDefault();
    }}
    onKeyUp={event => event.stopPropagation()}>
    <header className="gm-support-header">
      <h2 id="gm-support-title">GM回复</h2>
      <button type="button" data-gm-support-close="" aria-label="关闭GM回复" onClick={close}>关闭</button>
    </header>
    <output className="gm-support-status" role="status" aria-live="polite">
      {state.loading ? '正在读取…' : state.error ? '' : state.replies.length ? `共 ${state.replies.length} 条` : '暂无 GM 回复'}
    </output>
    <ol className="gm-support-list" aria-label="GM回复记录">
      {state.replies.map(reply => <GmSupportItem key={reply.id} reply={reply}/>)}
    </ol>
    {state.error && <div className="gm-support-error" role="alert">
      <p>{state.error}</p>
      <button type="button" data-gm-support-retry="" disabled={state.loading}
        onClick={() => {void inbox.refresh();}}>{state.loading ? '正在重试…' : '重试读取'}</button>
    </div>}
  </dialog>;
}

function GmSupportItem({reply}: {reply: GmSupportReply}) {
  return <li className="gm-support-item">
    <div className="gm-support-question">
      <span className="gm-support-label">提问</span>
      <p>{reply.question}</p>
      <time dateTime={dateTime(reply.requestedAt)}>{timeText(reply.requestedAt)}</time>
    </div>
    <div className="gm-support-reply">
      <span className="gm-support-label">回复</span>
      <p>{reply.text}</p>
      <time dateTime={dateTime(reply.repliedAt)}>{timeText(reply.repliedAt)}</time>
    </div>
  </li>;
}
