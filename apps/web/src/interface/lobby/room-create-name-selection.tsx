import {useLayoutEffect, useState, type CSSProperties, type RefObject} from 'react';

/** Original room-name EmotionFont is unset; selection preserves the complete text prefix. */
export function RoomCreateNameSelection({input, style, disabled}: {
  input: RefObject<HTMLInputElement | null>; style: CSSProperties; disabled: boolean;
}) {
  const [view, setView] = useState({prefix: '', selected: '', suffix: '', start: 0, end: 0, scroll: 0,
    prefixWidth: 0, backgroundWidth: 0, selectedWidth: 0, focused: false, active: false});
  useLayoutEffect(() => {
    const element = input.current;
    if (!element) return;
    const context = document.createElement('canvas').getContext('2d')!;
    const read = () => {
      const start = element.selectionStart ?? 0, end = element.selectionEnd ?? start;
      const prefix = element.value.slice(0, start), selected = element.value.slice(start, end);
      const active = end > start;
      element.classList.toggle('room-create-name-selected', active);
      const computed = getComputedStyle(element);
      context.font = `${computed.fontSize} ${computed.fontFamily}`;
      setView({prefix, selected, suffix: element.value.slice(end), start, end, scroll: element.scrollLeft,
        prefixWidth: context.measureText(prefix).width,
        backgroundWidth: context.measureText(element.value.slice(0, end)).width - context.measureText(prefix).width, selectedWidth: context.measureText(selected).width,
        focused: document.activeElement === element && !element.disabled, active});
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
      element.classList.remove('room-create-name-selected');
    };
  }, [input, disabled]);
  if (!view.active) return null;
  return <span className="room-create-name-selection" aria-hidden="true" data-room-name-selection=""
    data-source-selection-start={view.start} data-source-selection-end={view.end} data-source-scroll={view.scroll} style={style}>
    <i data-room-name-selection-background="" style={{left: view.prefixWidth - view.scroll,
      width: view.backgroundWidth, background: view.focused ? '#607fff' : '#808080'}}/>
    <span data-room-name-selection-text="prefix" style={{left: -view.scroll}}>{view.prefix}</span>
    <span data-room-name-selection-text="selected" style={{left: view.prefixWidth - view.scroll}}>{view.selected}</span>
    <span data-room-name-selection-text="suffix" style={{left: view.prefixWidth + view.selectedWidth - view.scroll}}>{view.suffix}</span>
  </span>;
}
