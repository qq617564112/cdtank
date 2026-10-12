import {imageResourceUrl} from '../../assets/image-cache';
import {useEffect, useId, useRef, useState, type ComponentPropsWithoutRef, type RefObject} from 'react';
import {useButtonInteraction} from './button-interaction';
import './game-scrollbar.css';

interface GameScrollbarProps extends ComponentPropsWithoutRef<'div'> {
  list: RefObject<HTMLElement | null>;
  step?: number;
  label: string;
}

/** One scroll owner keeps the arrows, track and draggable thumb inside the list. */
export function GameScrollbar({list, step = 38, label, className = '', ...props}: GameScrollbarProps) {
  const root = useRef<HTMLDivElement>(null), thumb = useRef<HTMLDivElement>(null);
  const [metrics, setMetrics] = useState({height: 0, extent: 0, scroll: 0, scale: 1, thumb: 53, travel: 0});
  const current = useRef(metrics);
  current.current = metrics;
  const drag = useRef<{pointer: number; y: number; scroll: number; scale: number} | undefined>(undefined);
  const [dragging, setDragging] = useState(false);

  const refresh = () => {
    const element = list.current;
    if (!element) return;
    const height = element.clientHeight, track = Math.max(0, height - 53);
    const extent = Math.max(0, element.scrollHeight - height);
    const thumbSize = height > 0
      ? Math.min(track, Math.max(53, Math.round(track * height / Math.max(height, element.scrollHeight) * 2) / 2))
      : 0;
    element.style.paddingRight = extent ? '30px' : '';
    const next = {height, extent, scroll: element.scrollTop,
      scale: height ? element.getBoundingClientRect().height / height : 1,
      thumb: thumbSize, travel: track - thumbSize};
    current.current = next;
    setMetrics(next);
  };
  const scrollTo = (value: number) => {
    if (list.current) list.current.scrollTop = value;
    refresh();
  };
  const end = () => {
    const pointer = drag.current?.pointer;
    drag.current = undefined;
    if (pointer !== undefined && thumb.current?.hasPointerCapture(pointer)) thumb.current.releasePointerCapture(pointer);
    setDragging(false);
  };
  useEffect(() => {
    const element = list.current!, scrollbar = root.current!;
    const observer = new ResizeObserver(refresh), mutations = new MutationObserver(refresh);
    const resize = () => requestAnimationFrame(refresh);
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const factor = event.deltaMode === 1 ? step : event.deltaMode === 2 ? element.clientHeight : 1 / current.current.scale;
      scrollTo(element.scrollTop + event.deltaY * factor);
    };
    observer.observe(element);
    mutations.observe(element, {childList: true, subtree: true, characterData: true});
    element.addEventListener('scroll', refresh);
    element.addEventListener('wheel', wheel, {passive: false});
    scrollbar.addEventListener('wheel', wheel, {passive: false});
    window.addEventListener('blur', end);
    window.addEventListener('resize', resize);
    void document.fonts.ready.then(refresh);
    refresh();
    return () => {
      end(); observer.disconnect(); mutations.disconnect();
      element.removeEventListener('scroll', refresh);
      element.removeEventListener('wheel', wheel);
      scrollbar.removeEventListener('wheel', wheel);
      window.removeEventListener('blur', end);
      window.removeEventListener('resize', resize);
      element.style.removeProperty('padding-right');
    };
  }, [list, step]);
  return <div {...props} ref={root} className={`game-scrollbar ${className}`} hidden={!metrics.extent}
    data-scroll-geometry-binding="web-list-dimensions" onKeyDown={event => {
      event.stopPropagation();
      const targets: Record<string, number> = {Home: 0, End: metrics.extent,
        ArrowUp: metrics.scroll - step, ArrowDown: metrics.scroll + step,
        PageUp: metrics.scroll - metrics.height, PageDown: metrics.scroll + metrics.height};
      if (!(event.key in targets)) return;
      event.preventDefault(); scrollTo(targets[event.key]);
    }} onKeyUp={event => event.stopPropagation()}>
    <div className="game-scrollbar-track" onPointerDown={event => {
      if (event.button !== 0 || event.target !== event.currentTarget) return;
      event.preventDefault();
      scrollTo(metrics.scroll + (event.clientY < thumb.current!.getBoundingClientRect().top ? -metrics.height : metrics.height));
    }}>
      <div ref={thumb} className="game-scrollbar-thumb" data-dragging={dragging ? '' : undefined}
        tabIndex={0} role="scrollbar" aria-label={label} aria-orientation="vertical"
        aria-valuemin={0} aria-valuemax={metrics.extent} aria-valuenow={Math.round(metrics.scroll)}
        style={{top: metrics.extent ? Math.round(metrics.scroll / metrics.extent * metrics.travel * 2) / 2 : 0, height: metrics.thumb}}
        onPointerDown={event => {
          if (event.button !== 0) return;
          event.preventDefault(); event.currentTarget.focus();
          drag.current = {pointer: event.pointerId, y: event.clientY, scroll: metrics.scroll, scale: metrics.scale};
          event.currentTarget.setPointerCapture(event.pointerId); setDragging(true);
        }} onPointerMove={event => {
          const active = drag.current, value = current.current;
          if (!active || active.pointer !== event.pointerId || !value.travel) return;
          scrollTo(active.scroll + (event.clientY - active.y) / active.scale * value.extent / value.travel);
        }} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end}>
        <span className="game-scrollbar-thumb-middle"/>
        <img className="game-scrollbar-thumb-top" src={imageResourceUrl('/ui/home/scroll-thumb-top.png')} alt="" draggable={false}/>
        <img className="game-scrollbar-thumb-bottom" src={imageResourceUrl('/ui/home/scroll-thumb-bottom.png')} alt="" draggable={false}/>
      </div>
    </div>
    <GameScrollArrow direction="up" disabled={metrics.scroll <= 0}
      onClick={() => scrollTo(current.current.scroll - step)}/>
    <GameScrollArrow direction="down" disabled={metrics.scroll >= metrics.extent}
      onClick={() => scrollTo(current.current.scroll + step)}/>
  </div>;
}

function GameScrollArrow({direction, ...props}: ComponentPropsWithoutRef<'button'> & {direction: 'up' | 'down'}) {
  const id = useId();
  const {element, buttonProps, state} = useButtonInteraction(props);
  return <button {...buttonProps} ref={element} type="button" className="game-scrollbar-arrow"
    data-direction={direction} data-arrow-state={state} aria-label={direction === 'up' ? '向上滚动' : '向下滚动'}>
    <svg viewBox="0 0 28 26" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}-face`} x1="0" y1={direction === 'up' ? '0' : '1'} x2="1" y2={direction === 'up' ? '1' : '0'}>
          <stop className="game-scrollbar-arrow-face-top"/>
          <stop offset="1" className="game-scrollbar-arrow-face-bottom"/>
        </linearGradient>
      </defs>
      <g transform={direction === 'down' ? 'translate(0 26) scale(1 -1)' : undefined}>
        <path d="M2.1 22.5L12.6 2Q14 .5 15.5 3L25.7 22.3Q27 25.1 23.5 25L3 25Q.9 25.1 2.1 22.5Z"
          fill="#0a1029" stroke="#514838" strokeWidth="1.3" strokeLinejoin="round"/>
        <path d="M5.5 22.6L13.8 5L22.5 22.6Z" fill={`url(#${id}-face)`}/>
        <path d={direction === 'up' ? 'M5.5 22.6L13.8 5L14.7 9L8.1 21.4Z'
          : 'M5.5 22.6L22.5 22.6L20.5 20.6L8.1 21.4Z'} className="game-scrollbar-arrow-highlight"/>
        <path d={direction === 'up' ? 'M5.5 22.6L22.5 22.6L20.5 20.6L8.1 21.4Z'
          : 'M22.5 22.6L13.8 5L13 9L20.5 20.6Z'} className="game-scrollbar-arrow-bevel"/>
        <path d="M4.4 23.7L13.7 3.9" fill="none" stroke="#fff2d0" strokeWidth=".55" opacity=".7"/>
      </g>
    </svg>
  </button>;
}
