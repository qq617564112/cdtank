import './source-chat-scrollbar.css';
import {useEffect, useLayoutEffect, useRef, useState, type RefObject} from 'react';
import {ChatSourceLayout} from './source-chat-layout';

export interface ChatScrollbarGeometry {
  width: number; decrementWidth: number; incrementWidth: number;
  decrementHeight: number; incrementHeight: number; minimumThumb: number; step: number;
}
const GEOMETRY: ChatScrollbarGeometry = {
  width: Math.fround(Math.fround(.05) * 286), decrementWidth: 28, incrementWidth: 28,
  decrementHeight: 26, incrementHeight: 27, minimumThumb: 40, step: 16,
};

/** React owns controls; actual rich-text dimensions determine scroll geometry. */
export function SourceChatScrollbar({log, layout, messageVersion, releaseKeys}: {
  log: RefObject<HTMLOListElement | null>; layout: ChatSourceLayout; messageVersion: number; releaseKeys: () => void;
}) {
  const root = useRef<HTMLDivElement>(null), track = useRef<HTMLDivElement>(null), thumb = useRef<HTMLDivElement>(null);
  const drag = useRef<{pointer: number; startY: number; startScroll: number; scale: number} | undefined>(undefined);
  const [metrics, setMetrics] = useState({visible: false, left: 0, top: 0, height: 0, trackHeight: 0,
    thumbHeight: 40, extent: 0, travel: 0, scroll: 0});
  const [upState, setUpState] = useState('Normal'), [downState, setDownState] = useState('Normal');
  const [thumbState, setThumbState] = useState('Normal');
  const metricsRef = useRef(metrics); metricsRef.current = metrics;
  const refresh = () => {
    const element = log.current;
    if (!element) return;
    const height = element.clientHeight, visible = element.scrollHeight > height;
    element.style.paddingRight = visible ? `${GEOMETRY.width}px` : '';
    const trackHeight = Math.max(0, height - 2 * GEOMETRY.decrementHeight);
    const thumbHeight = Math.max(GEOMETRY.minimumThumb, trackHeight * height / element.scrollHeight);
    const next = {visible, left: element.offsetLeft + element.offsetWidth - GEOMETRY.width,
      top: element.offsetTop, height, trackHeight, thumbHeight,
      extent: Math.max(0, element.scrollHeight - height), travel: trackHeight - thumbHeight, scroll: element.scrollTop};
    metricsRef.current = next; setMetrics(next);
  };
  const scroll = (delta: number) => {releaseKeys(); if (log.current) log.current.scrollTop += delta; refresh();};
  const endDrag = () => {
    const pointer = drag.current?.pointer; drag.current = undefined;
    if (pointer !== undefined && thumb.current?.hasPointerCapture(pointer)) thumb.current.releasePointerCapture(pointer);
    setThumbState('Normal');
  };
  useEffect(() => {
    const element = log.current!;
    const resize = new ResizeObserver(refresh), mutation = new MutationObserver(refresh);
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      scroll(event.deltaY * (event.deltaMode === 1 ? GEOMETRY.step : event.deltaMode === 2 ? element.clientHeight : 1));
    };
    resize.observe(element); mutation.observe(element, {childList: true, subtree: true});
    element.addEventListener('scroll', refresh); element.addEventListener('load', refresh, true);
    element.addEventListener('wheel', wheel, {passive: false});
    const control = root.current!; control.addEventListener('wheel', wheel, {passive: false});
    refresh();
    return () => {
      endDrag(); resize.disconnect(); mutation.disconnect();
      element.removeEventListener('scroll', refresh); element.removeEventListener('load', refresh, true);
      element.removeEventListener('wheel', wheel); control.removeEventListener('wheel', wheel);
      element.style.removeProperty('padding-right');
    };
  }, []);
  useLayoutEffect(() => {
    if (messageVersion && log.current) log.current.scrollTop += log.current.clientHeight + GEOMETRY.step;
    refresh();
  }, [messageVersion]);
  const picture = (property: string) => layout.picture(layout.control('edtDisplayBox').properties[property]);
  return <div ref={root} className="source-chat-scrollbar" data-chat-scrollbar="" hidden={!metrics.visible}
    {...picture('VertScrollbarBackgroundImage')}
    style={{...picture('VertScrollbarBackgroundImage').style, left: metrics.left, top: metrics.top, width: GEOMETRY.width, height: metrics.height}}
    onFocus={releaseKeys} onPointerDown={releaseKeys} onKeyDown={event => {
      event.stopPropagation();
      const element = log.current!;
      const destinations: Record<string, number> = {Home: 0, End: metrics.extent,
        ArrowUp: element.scrollTop - GEOMETRY.step, ArrowDown: element.scrollTop + GEOMETRY.step,
        PageUp: element.scrollTop - element.clientHeight, PageDown: element.scrollTop + element.clientHeight};
      const destination = destinations[event.key];
      if (destination === undefined || event.altKey || event.ctrlKey || event.metaKey) return;
      event.preventDefault(); releaseKeys(); element.scrollTop = destination; refresh();
    }}>
    <div ref={track} data-chat-scroll-track="" style={{top: GEOMETRY.decrementHeight, height: metrics.trackHeight}}
      onPointerDown={event => {if (event.button === 0 && event.target === event.currentTarget) {
        event.preventDefault(); scroll(event.clientY < thumb.current!.getBoundingClientRect().top ? -log.current!.clientHeight : log.current!.clientHeight);
      }}}>
      <div ref={thumb} data-chat-scroll-thumb="" tabIndex={0} role="scrollbar" aria-label="聊天历史"
        aria-orientation="vertical" aria-controls="battle-chat-history" aria-valuemin={0}
        aria-valuemax={metrics.extent} aria-valuenow={metrics.scroll}
        style={{width: GEOMETRY.incrementWidth, height: metrics.thumbHeight, top: metrics.extent ? metrics.travel * metrics.scroll / metrics.extent : 0}}
        onPointerDown={event => {if (event.button !== 0) return;
          event.preventDefault(); releaseKeys(); event.currentTarget.focus();
          drag.current = {pointer: event.pointerId, startY: event.clientY, startScroll: log.current!.scrollTop,
            scale: track.current!.getBoundingClientRect().height / track.current!.offsetHeight};
          event.currentTarget.setPointerCapture(event.pointerId); setThumbState('Pushed');
        }} onPointerMove={event => {const active = drag.current, current = metricsRef.current;
          if (!active || active.pointer !== event.pointerId || !current.travel) return;
          log.current!.scrollTop = active.startScroll + (event.clientY - active.startY) / active.scale * current.extent / current.travel;
          refresh();
        }} onPointerUp={endDrag} onPointerCancel={endDrag} onLostPointerCapture={endDrag}
        onMouseEnter={() => {if (!drag.current) setThumbState('Hover');}}
        onMouseLeave={() => {if (!drag.current) setThumbState('Normal');}}>
        <span {...picture(`VertScrollbarThumb${thumbState}TopFrameImage`)} />
        <span {...picture('VertScrollbarThumbBackgroundImage')} />
        <span {...picture(`VertScrollbarThumb${thumbState}BottomFrameImage`)} />
      </div>
    </div>
    <button type="button" data-chat-scroll-up="" aria-label="查看较早聊天" disabled={metrics.scroll <= 0}
      {...picture(`VertScrollbarDecButton${upState}Image`)} style={{...picture(`VertScrollbarDecButton${upState}Image`).style,
        width: GEOMETRY.decrementWidth, height: GEOMETRY.decrementHeight}}
      onClick={() => scroll(-GEOMETRY.step)} onMouseEnter={() => setUpState('Hover')} onMouseLeave={() => setUpState('Normal')}
      onMouseDown={() => setUpState('Pushed')} onMouseUp={() => setUpState('Hover')} />
    <button type="button" data-chat-scroll-down="" aria-label="查看较新聊天" disabled={metrics.scroll >= metrics.extent - .5}
      {...picture(`VertScrollbarIncButton${downState}Image`)} style={{...picture(`VertScrollbarIncButton${downState}Image`).style,
        width: GEOMETRY.incrementWidth, height: GEOMETRY.incrementHeight}}
      onClick={() => scroll(GEOMETRY.step)} onMouseEnter={() => setDownState('Hover')} onMouseLeave={() => setDownState('Normal')}
      onMouseDown={() => setDownState('Pushed')} onMouseUp={() => setDownState('Hover')} />
  </div>;
}
