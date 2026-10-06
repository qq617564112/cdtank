import './player-list-scrollbar.css';
import {useEffect, useRef, useState, type RefObject, type PointerEvent} from 'react';
import type {HomeSourceUi} from '../resources/source-ui-layout';

/** Source scrollbar pictures surround the existing DOM list's confirmed rows. */
export function PlayerListScrollbar({list, ui, properties}: {
  list: RefObject<HTMLUListElement | null>; ui: HomeSourceUi; properties: Record<string, string>;
}) {
  const root = useRef<HTMLDivElement>(null), thumb = useRef<HTMLDivElement>(null);
  const [metrics, setMetrics] = useState({visible: false, height: 420, extent: 0, scroll: 0,
    scale: 1, track: 368, thumb: 53, travel: 315});
  const current = useRef(metrics); current.current = metrics;
  const drag = useRef<{pointer: number; y: number; scroll: number; scale: number} | undefined>(undefined);
  const [thumbState, setThumbState] = useState('Normal');
  const picture = (property: string) => {
    const match = /^set:(\S+) image:(.+)$/.exec(properties[property] ?? '');
    const sets = ui.imagesets.filter(set => set.attributes.Name === match?.[1]);
    const set = sets.find(set => set.path.includes('imagesets_dds/')) ?? sets[0];
    const asset = set?.images.find(image => image.Name === match?.[2])?.asset;
    return {'data-source-asset': asset, style: {backgroundImage: asset ? `url('/${asset}')` : undefined}};
  };
  const refresh = () => {
    const element = list.current;
    if (!element) return;
    const height = element.clientHeight;
    if (!height) {end(); setMetrics(value => ({...value, visible: false})); return;}
    const visible = element.scrollHeight > height;
    element.style.paddingRight = visible ? '8.5px' : '';
    const scale = element.getBoundingClientRect().height / height;
    const extent = Math.max(0, element.scrollHeight - height), track = Math.max(0, height - 52);
    const minimum = Number(properties.VertScrollbarThumbMinExtent) / scale;
    const thumbSize = Math.min(track, Math.max(minimum, track * height / element.scrollHeight));
    const next = {visible, height, extent, scroll: element.scrollTop, scale,
      track, thumb: thumbSize, travel: Math.max(0, track - thumbSize)};
    current.current = next; setMetrics(next);
  };
  const scrollTo = (value: number) => {
    if (list.current) list.current.scrollTop = value;
    refresh();
  };
  const end = () => {
    const pointer = drag.current?.pointer; drag.current = undefined;
    if (pointer !== undefined && thumb.current?.hasPointerCapture(pointer)) thumb.current.releasePointerCapture(pointer);
    setThumbState('Normal');
  };
  useEffect(() => {
    const element = list.current!;
    const observer = new ResizeObserver(refresh), mutations = new MutationObserver(refresh);
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const factor = event.deltaMode === 1 ? 14 : event.deltaMode === 2 ? element.clientHeight : 1 / current.current.scale;
      scrollTo(element.scrollTop + event.deltaY * factor);
    };
    observer.observe(element); mutations.observe(element, {childList: true, subtree: true, characterData: true});
    element.addEventListener('scroll', refresh); element.addEventListener('wheel', wheel, {passive: false});
    root.current!.addEventListener('wheel', wheel, {passive: false});
    window.addEventListener('blur', end); refresh();
    return () => {
      end(); observer.disconnect(); mutations.disconnect(); element.removeEventListener('scroll', refresh);
      element.removeEventListener('wheel', wheel); root.current?.removeEventListener('wheel', wheel);
      window.removeEventListener('blur', end); element.style.removeProperty('padding-right');
    };
  }, []);
  return <div ref={root} className="player-list-scrollbar" data-player-list-scrollbar="" hidden={!metrics.visible}
    data-scroll-geometry-binding="web-list-dimensions" {...picture('VertScrollbarBackgroundImage')}
    style={{...picture('VertScrollbarBackgroundImage').style, height: metrics.height}}
    onKeyDown={event => {
      event.stopPropagation();
      const targets: Record<string, number> = {Home: 0, End: metrics.extent,
        ArrowUp: metrics.scroll - 14, ArrowDown: metrics.scroll + 14,
        PageUp: metrics.scroll - metrics.height, PageDown: metrics.scroll + metrics.height};
      if (!(event.key in targets)) return;
      event.preventDefault(); scrollTo(targets[event.key]);
    }} onKeyUp={event => event.stopPropagation()}>
    <div className="player-list-scroll-track" data-player-list-scroll-track=""
      style={{top: 26, height: metrics.track}} onPointerDown={event => {
        if (event.button !== 0 || event.target !== event.currentTarget) return;
        event.preventDefault(); scrollTo(metrics.scroll + (event.clientY < thumb.current!.getBoundingClientRect().top ? -metrics.height : metrics.height));
      }}>
      <div ref={thumb} className="player-list-scroll-thumb" data-player-list-scroll-thumb=""
        data-thumb-state={thumbState} tabIndex={0} role="scrollbar" aria-label="玩家名单"
        aria-orientation="vertical" aria-valuemin={0} aria-valuemax={metrics.extent} aria-valuenow={metrics.scroll}
        style={{top: metrics.extent ? metrics.scroll / metrics.extent * metrics.travel : 0, height: metrics.thumb}}
        onPointerDown={event => {
          if (event.button !== 0) return;
          event.preventDefault(); event.currentTarget.focus();
          drag.current = {pointer: event.pointerId, y: event.clientY, scroll: metrics.scroll, scale: metrics.scale};
          event.currentTarget.setPointerCapture(event.pointerId); setThumbState('Pushed');
        }} onPointerMove={event => {
          const active = drag.current, value = current.current;
          if (!active || active.pointer !== event.pointerId || !value.travel) return;
          scrollTo(active.scroll + (event.clientY - active.y) / active.scale * value.extent / value.travel);
        }} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end}
        onPointerEnter={() => {if (!drag.current) setThumbState('Hover');}}
        onPointerLeave={() => {if (!drag.current) setThumbState('Normal');}}>
        <span className="player-list-thumb-top" {...picture(`VertScrollbarThumb${thumbState}TopFrameImage`)} />
        <span className="player-list-thumb-middle" {...picture('VertScrollbarThumbBackgroundImage')} />
        <span className="player-list-thumb-bottom" {...picture(`VertScrollbarThumb${thumbState}BottomFrameImage`)} />
      </div>
    </div>
    <Arrow direction="up" disabled={metrics.scroll <= 0} picture={picture}
      scroll={() => scrollTo(current.current.scroll - 14)} />
    <Arrow direction="down" disabled={metrics.scroll >= metrics.extent} picture={picture}
      scroll={() => scrollTo(current.current.scroll + 14)} />
  </div>;
}

function Arrow({direction, disabled, picture, scroll}: {
  direction: 'up' | 'down'; disabled: boolean;
  picture(property: string): {style: {backgroundImage?: string}; 'data-source-asset'?: string}; scroll(): void;
}) {
  const element = useRef<HTMLButtonElement>(null);
  const pointer = useRef<number | undefined>(undefined), releasedInside = useRef(false);
  const [state, setState] = useState({inside: false, held: false});
  const name = disabled ? 'Disabled' : state.inside !== state.held ? 'Hover' : state.held ? 'Pushed' : 'Normal';
  const inside = (event: PointerEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const clip = event.currentTarget.closest('.player-list-scrollbar')!.getBoundingClientRect();
    return event.clientX >= Math.max(rect.left, clip.left) && event.clientX < Math.min(rect.right, clip.right)
      && event.clientY >= Math.max(rect.top, clip.top) && event.clientY < Math.min(rect.bottom, clip.bottom);
  };
  const end = (event: PointerEvent<HTMLButtonElement>) => {
    pointer.current = undefined; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    setState({inside: false, held: false});
  };
  useEffect(() => {
    const button = element.current!;
    const cancel = () => {
      const id = pointer.current; pointer.current = undefined;
      if (id !== undefined && button.hasPointerCapture(id)) button.releasePointerCapture(id);
      releasedInside.current = false; setState({inside: false, held: false});
    };
    window.addEventListener('blur', cancel);
    return () => {window.removeEventListener('blur', cancel); cancel();};
  }, []);
  return <button ref={element} type="button" className={`player-list-scroll-${direction}`} data-player-list-scroll-arrow={direction}
    data-arrow-state={name} disabled={disabled} aria-label={direction === 'up' ? '向上浏览玩家' : '向下浏览玩家'}
    {...picture(`VertScrollbar${direction === 'up' ? 'Dec' : 'Inc'}Button${name}Image`)}
    onPointerEnter={() => setState(value => ({...value, inside: true}))}
    onPointerLeave={() => setState(value => ({...value, inside: false}))}
    onPointerDown={event => {
      if (event.button !== 0) return;
      pointer.current = event.pointerId; releasedInside.current = false;
      event.currentTarget.setPointerCapture(event.pointerId); setState({inside: true, held: true});
    }} onPointerMove={event => {if (pointer.current === event.pointerId) setState({inside: inside(event), held: true});}}
    onPointerUp={event => {releasedInside.current = inside(event); end(event);}}
    onPointerCancel={end} onLostPointerCapture={event => {if (pointer.current !== undefined) end(event);}}
    onClick={event => {if (event.detail === 0 || releasedInside.current) scroll();}} />;
}
