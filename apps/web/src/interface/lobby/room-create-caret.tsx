import {imageResourceBackground} from '../../assets/image-cache';
import {useContext, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject} from 'react';
import type {HomeSourceLayout, HomeSourceUi} from '../resources/source-ui-layout';
import {advanceRoomCreateCaret} from './room-create-caret-clock';
import {RoomCreateImageScale} from './room-create-source-visual';

/** Original CaratImage draws at the native caret prefix extent across the text area. */
export function RoomCreateCaret({input, ui, layout, name, style, disabled}: {
  input: RefObject<HTMLInputElement | null>; ui: HomeSourceUi; layout: HomeSourceLayout;
  name: string; style: CSSProperties; disabled: boolean;
}) {
  const scale = useContext(RoomCreateImageScale);
  const reference = layout.control(name).properties.CaratImage;
  const match = /^set:(\S+) image:(.+)$/.exec(reference ?? '');
  const sets = ui.imagesets.filter(set => set.attributes.Name === match?.[1]);
  const set = sets.find(set => set.path.includes('imagesets_dds/')) ?? sets[0];
  const image = set?.images.find(image => image.Name === match?.[2]) as
    {asset?: string; Width: string} | undefined;
  const attributes = set?.attributes as Record<string, string> | undefined;
  const factor = attributes?.AutoScaled === 'true' ? 800 * scale / Number(attributes.NativeHorzRes ?? 800) : 1;
  const width = Math.round(Math.fround(Number(image?.Width ?? 0) * Math.fround(factor))) / scale;
  const brush = useRef<HTMLElement>(null);
  useEffect(() => {
    let frame: number, elapsed = 0, previous = performance.now();
    const tick = (now: number) => {
      const next = advanceRoomCreateCaret(elapsed, (now - previous) / 1000);
      elapsed = next.elapsed; previous = now;
      if (brush.current) brush.current.style.opacity = next.visible ? '1' : '0';
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);
  const [view, setView] = useState({left: 0, index: 0, scroll: 0, focused: false});
  useLayoutEffect(() => {
    const element = input.current;
    if (!element) return;
    element.classList.add('room-create-source-caret-input');
    const context = document.createElement('canvas').getContext('2d')!;
    const read = () => {
      const index = (element.selectionDirection === 'backward' ? element.selectionStart : element.selectionEnd) ?? 0;
      const computed = getComputedStyle(element);
      context.font = `${computed.fontSize} ${computed.fontFamily}`;
      const prefix = element.type === 'password' ? '*'.repeat(index) : element.value.slice(0, index);
      setView({left: Math.min(context.measureText(prefix).width - element.scrollLeft, element.clientWidth - width), index, scroll: element.scrollLeft,
        focused: document.activeElement === element && !element.disabled && !element.readOnly});
    };
    const events = ['input', 'select', 'scroll', 'focus', 'blur', 'keyup', 'pointerup', 'compositionend'];
    events.forEach(event => element.addEventListener(event, read));
    document.addEventListener('selectionchange', read);
    let active = true;
    void document.fonts.ready.then(() => {if (active) read();});
    read();
    return () => {
      active = false;
      events.forEach(event => element.removeEventListener(event, read));
      document.removeEventListener('selectionchange', read);
      element.classList.remove('room-create-source-caret-input');
    };
  }, [input, disabled, width]);
  if (!image?.asset) return null;
  return <span aria-hidden="true" className="room-create-source-caret" data-room-create-caret={name}
    data-source-asset={image.asset} data-source-caret-width={width} data-source-caret-index={view.index} data-source-scroll={view.scroll}
    data-source-focused={String(view.focused)} style={{...style, visibility: view.focused ? 'visible' : 'hidden'}}>
    <i ref={brush} style={{left: view.left, width, backgroundImage: imageResourceBackground(`/${image.asset}`)}}/>
  </span>;
}
