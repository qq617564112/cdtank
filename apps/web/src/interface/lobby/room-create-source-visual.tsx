import {useEffect, useLayoutEffect, useState, type CSSProperties, type RefObject} from 'react';
import type {HomeSourceUi} from '../resources/source-ui-layout';
import {HomeSourceLayout} from '../resources/source-ui-layout';
import {loadSourceUiFonts} from '../resources/source-ui-fonts';
import {sourceProps} from '../resources/source-ui-props';
import {SourceStaticImage} from '../resources/source-static-image';

export {SourceImageScale as RoomCreateImageScale} from '../resources/source-static-image';

let passwordFont: Promise<void> | undefined;

function loadRoomCreatePasswordFont(): Promise<void> {
  passwordFont ??= (async () => {
    const face = new FontFace('CDTank-SIMSUN-Password', "url('/ui/fonts/SIMSUN-password.ttf')");
    await face.load();
    document.fonts.add(face);
  })().catch(error => {passwordFont = undefined; throw error;});
  return passwordFont;
}

/** Editbox replaces colour alpha with Window effective alpha before drawing. */
export function roomCreateInputVisual(layout: HomeSourceLayout, name: string): CSSProperties {
  const normal = layout.control(name).properties.NormalTextColour ?? '00FFFFFF';
  return {color: `#${normal.slice(2)}`, fontFamily: name === 'edtPassword' ? 'CDTank-SIMSUN-Password, CDTank-SIMSUN, serif' : 'inherit'};
}

/** Source EmotionFont0 selection preserves all mask characters; the native input owns editing. */
export function RoomCreatePasswordSelection({input, style}: {
  input: RefObject<HTMLInputElement | null>; style: CSSProperties;
}) {
  const [view, setView] = useState({count: 0, start: 0, end: 0, scroll: 0, advance: 6, focused: false});
  useLayoutEffect(() => {
    const element = input.current;
    if (!element) return;
    const read = () => {
      const start = element.selectionStart ?? 0, end = element.selectionEnd ?? start;
      const selected = end > start;
      element.classList.toggle('room-create-password-selected', selected);
      const context = document.createElement('canvas').getContext('2d')!;
      const computed = getComputedStyle(element);
      context.font = `${computed.fontSize} ${computed.fontFamily}`;
      setView({count: element.value.length, start, end, scroll: element.scrollLeft,
        advance: context.measureText('*').width, focused: document.activeElement === element && !element.disabled});
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
      element.classList.remove('room-create-password-selected');
    };
  }, [input]);
  if (view.start === view.end) return null;
  return <span className="room-create-password-selection" aria-hidden="true" data-room-password-selection=""
    data-source-selection-start={view.start} data-source-selection-end={view.end} data-source-mask-count={view.count}
    data-source-scroll={view.scroll} style={style}>
    <i data-room-password-selection-background="" style={{left: view.start * view.advance - view.scroll,
      width: (view.end - view.start) * view.advance, background: view.focused ? '#607fff' : '#808080'}}/>
    <span data-room-password-selection-text="" style={{left: -view.scroll}}>{'*'.repeat(view.count)}</span>
  </span>;
}

/** The create sheet retains its source origin and image-scale context. */
export function RoomCreateSourceImage({ui, layout, name, reference}: {
  ui: HomeSourceUi; layout: HomeSourceLayout; name: string; reference?: string;
}) {
  return <SourceStaticImage ui={ui} layout={layout} name={name} reference={reference} suffix="createroom.xml"
    offsetX={-246} offsetY={-130} className="room-create-source-image" aria-hidden="true"/>;
}

export function useRoomCreateVisual(open: boolean) {
  const [viewport, setViewport] = useState(() => ({width: innerWidth, height: innerHeight}));
  const scale = Math.min(viewport.width / 800, viewport.height / 600);
  const [fontError, setFontError] = useState('');
  useEffect(() => {
    const resize = () => setViewport({width: innerWidth, height: innerHeight});
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  useEffect(() => {
    if (!open) return;
    let active = true;
    void Promise.all([loadSourceUiFonts(), loadRoomCreatePasswordFont()]).catch(error => {if (active) setFontError(String(error));});
    return () => {active = false;};
  }, [open]);
  return {fontError, scale, viewportWidth: viewport.width, viewportHeight: viewport.height, viewport: {width: 310 * scale, height: 328 * scale}, stage: {transform: `scale(${scale})`}};
}

/** The source mask is the first child of the sheet and is not clipped to its parent. */
export function RoomCreateSourceMask({ui, layout, scale, viewportWidth, viewportHeight}: {
  ui: HomeSourceUi; layout: HomeSourceLayout; scale: number; viewportWidth: number; viewportHeight: number;
}) {
  const props = sourceProps(ui, layout, 'createroom.xml', 'zhezhaoditu', layout.control('zhezhaoditu').properties.Image);
  return <span {...props} className="room-create-source-mask" aria-hidden="true" style={{...props.style,
    left: (viewportWidth - 800 * scale) / 2 + Number(props.style.left) * scale,
    top: (viewportHeight - 600 * scale) / 2 + Number(props.style.top) * scale,
    width: Number(props.style.width) * scale, height: Number(props.style.height) * scale}}/>;
}
