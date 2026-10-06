import './source-multiline-reading.css';
import {useContext, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent} from 'react';
import type {HomeSourceLayout, HomeSourceUi} from './source-ui-layout';
import {sourceProps} from './source-ui-props';
import {SourceImageScale} from './source-static-image';
import {sourceMultilineLayout, type SourceMultilineLine} from './source-multiline-layout';

/** Read the source MultiLine text and scrollbar without creating an editable field. */
export function SourceMultilineReading({ui, layout, name, text, suffix}: {
  ui: HomeSourceUi; layout: HomeSourceLayout; name: string; text: string; suffix: string;
}) {
  const props = sourceProps(ui, layout, suffix, name);
  const width = Number(props.style.width), height = Number(props.style.height), scale = useContext(SourceImageScale);
  const root = useRef<HTMLDivElement>(null), thumb = useRef<HTMLDivElement>(null);
  const drag = useRef<{id: number; y: number; position: number} | null>(null);
  const [rows, setRows] = useState<SourceMultilineLine[]>([]), [position, setPosition] = useState(0);
  const [arrow, setArrow] = useState({up: 'Normal', down: 'Normal'});
  const arrowPointers = useRef<{up?: number; down?: number}>({});
  const arrowRelease = useRef({up: true, down: true});
  const scrollbarWidth = Math.fround(Math.fround(.05) * width), lineHeight = 16;
  useLayoutEffect(() => {
    let active = true;
    const format = () => {
      if (!active) return;
      cancelDrag(); cancelArrows();
      const context = document.createElement('canvas').getContext('2d')!;
      context.font = '12px CDTank-Xiangjiao';
      const glyph = (character: string) => {
        if (character === '\n' || character === '\r') return {width: 0, actualBoundingBoxRight: 0};
        return context.measureText(character);
      };
      const metrics = {
        advance: (value: string) => Array.from(value).reduce((advance, character) => Math.fround(advance + glyph(character).width), 0),
        extent: (value: string) => {
          let advance = 0, extent = 0;
          for (const character of value) {
            const measured = glyph(character);
            extent = Math.max(extent, Math.fround(advance + measured.actualBoundingBoxRight));
            advance = Math.fround(advance + measured.width);
          }
          return Math.max(extent, advance);
        },
      };
      let next = sourceMultilineLayout(text, width, metrics);
      if (next.length * lineHeight > height) next = sourceMultilineLayout(text, width - scrollbarWidth, metrics);
      setRows(next); setPosition(0);
    };
    format(); void document.fonts.load('12px CDTank-Xiangjiao').then(format);
    return () => {active = false;};
  }, [text, width, height, scrollbarWidth, lineHeight]);
  const documentHeight = rows.length * lineHeight, extent = Math.max(0, documentHeight - height), visible = extent > 0;
  const sourcePixels = (value: number) => Math.round(Math.fround(value * Math.fround(scale))) / scale;
  const arrowWidth = sourcePixels(28), decrementHeight = sourcePixels(26), incrementHeight = sourcePixels(27);
  const track = Math.max(0, height - 2 * decrementHeight);
  const thumbHeight = Math.max(10 / scale, documentHeight ? track * height / documentHeight : 0);
  const travel = track - thumbHeight, top = decrementHeight + (extent ? travel * position / extent : 0);
  const metrics = useRef({extent, travel, scale}); metrics.current = {extent, travel, scale};
  const scrollTo = (value: number) => setPosition(Math.max(0, Math.min(metrics.current.extent, value)));
  const cancelArrows = () => {
    for (const direction of ['up', 'down'] as const) {
      const id = arrowPointers.current[direction]; delete arrowPointers.current[direction];
      const button = root.current?.querySelector<HTMLButtonElement>(`[data-source-description-arrow="${direction}"]`);
      if (id !== undefined && button?.hasPointerCapture(id)) button.releasePointerCapture(id);
    }
    setArrow({up: 'Normal', down: 'Normal'});
  };
  const cancelDrag = () => {
    const id = drag.current?.id; drag.current = null;
    if (id !== undefined && thumb.current?.hasPointerCapture(id)) thumb.current.releasePointerCapture(id);
  };
  useEffect(() => {
    const element = root.current!;
    const wheel = (event: WheelEvent) => {
      event.preventDefault(); event.stopPropagation(); element.focus();
      const delta = event.deltaMode === 1 ? event.deltaY * lineHeight : event.deltaMode === 2 ? event.deltaY * height : event.deltaY / metrics.current.scale;
      setPosition(old => Math.max(0, Math.min(metrics.current.extent, old + delta)));
    };
    element.addEventListener('wheel', wheel, {passive: false}); window.addEventListener('blur', cancelDrag); window.addEventListener('blur', cancelArrows);
    return () => {cancelDrag(); cancelArrows(); window.removeEventListener('blur', cancelArrows); element.removeEventListener('wheel', wheel); window.removeEventListener('blur', cancelDrag);};
  }, [height, lineHeight]);
  const keyboard = (event: KeyboardEvent<HTMLDivElement>) => {
    event.stopPropagation();
    const target: Record<string, number> = {Home: 0, End: extent, ArrowUp: position - lineHeight,
      ArrowDown: position + lineHeight, PageUp: position - height, PageDown: position + height};
    if (target[event.key] === undefined || event.altKey || event.ctrlKey || event.metaKey) return;
    event.preventDefault(); scrollTo(target[event.key]);
  };
  const picture = (direction: 'up' | 'down') => {
    const property = `VertScrollbar${direction === 'up' ? 'Dec' : 'Inc'}Button${arrow[direction]}Image`;
    return sourceProps(ui, layout, suffix, name, layout.control(name).properties[property]);
  };
  return <div ref={root} {...props} className="source-multiline-reading" data-waiting-description=""
    data-source-font="xiangjiao-brush" data-source-text-colour="FFFFFFFF" data-source-description-position={position}
    data-source-description-scale={scale} data-source-description-line-spacing={lineHeight}
    data-source-description-document={documentHeight} data-source-description-page={height}
    tabIndex={0} role="region" aria-label="地图说明" onKeyDown={keyboard} onKeyUp={event => event.stopPropagation()}>
    <div className="source-multiline-lines" data-source-description-lines="" style={{width: width - (visible ? scrollbarWidth : 0), height: height + 5 / scale}}>
      {rows.map((line, index) => <span key={index} data-source-description-line={index} data-source-line-start={line.start}
        data-source-line-length={line.length} data-source-line-extent={line.extent}
        style={{top: index * lineHeight - position, height: lineHeight, lineHeight: `${lineHeight}px`}}>
          {line.text}
        </span>)}
    </div>
    <div className="source-description-scrollbar" data-source-description-scrollbar="" hidden={!visible}
      style={{width: scrollbarWidth}} onPointerDown={event => {
        if (event.button === 0 && event.target === event.currentTarget) {
          event.preventDefault(); root.current?.focus();
          scrollTo(position + (event.clientY < thumb.current!.getBoundingClientRect().top ? -height : height));
        }
      }}>
      <div ref={thumb} data-source-description-thumb="" role="scrollbar" tabIndex={0} aria-label="地图说明滚动位置"
        aria-orientation="vertical" aria-valuemin={0} aria-valuemax={extent} aria-valuenow={position}
        style={{top, width: arrowWidth, height: thumbHeight}}
        onPointerDown={event => {if (event.button !== 0) return;
          event.preventDefault(); event.stopPropagation(); event.currentTarget.focus();
          drag.current = {id: event.pointerId, y: event.clientY, position}; event.currentTarget.setPointerCapture(event.pointerId);
        }} onPointerMove={event => {const active = drag.current, current = metrics.current;
          if (!active || active.id !== event.pointerId || !current.travel) return;
          scrollTo(active.position + (event.clientY - active.y) / current.scale * current.extent / current.travel);
        }} onPointerUp={cancelDrag} onPointerCancel={cancelDrag} onLostPointerCapture={cancelDrag}/>
      {(['up', 'down'] as const).map(direction => {
        const image = picture(direction);
        return <button key={direction} type="button" data-source-description-arrow={direction}
          data-source-asset={image['data-source-asset']} aria-label={direction === 'up' ? '向上阅读地图说明' : '向下阅读地图说明'}
          style={{backgroundImage: image.style.backgroundImage, top: direction === 'up' ? 0 : height - incrementHeight,
            width: arrowWidth, height: direction === 'up' ? decrementHeight : incrementHeight}}
          onPointerEnter={() => setArrow(old => ({...old, [direction]: arrowPointers.current[direction] === undefined ? 'Hover' : 'Pushed'}))}
          onPointerLeave={() => setArrow(old => ({...old, [direction]: arrowPointers.current[direction] === undefined ? 'Normal' : 'Hover'}))}
          onPointerDown={event => {if (event.button !== 0) return;
            arrowPointers.current[direction] = event.pointerId; arrowRelease.current[direction] = true;
            event.currentTarget.setPointerCapture(event.pointerId); setArrow(old => ({...old, [direction]: 'Pushed'}));
          }} onPointerMove={event => {
            if (arrowPointers.current[direction] !== event.pointerId) return;
            const r = event.currentTarget.getBoundingClientRect();
            const inside = event.clientX >= r.left && event.clientX < r.right && event.clientY >= r.top && event.clientY < r.bottom;
            setArrow(old => ({...old, [direction]: inside ? 'Pushed' : 'Hover'}));
          }} onPointerUp={event => {
            if (arrowPointers.current[direction] !== event.pointerId) return;
            const r = event.currentTarget.getBoundingClientRect();
            const inside = event.clientX >= r.left && event.clientX < r.right && event.clientY >= r.top && event.clientY < r.bottom;
            arrowRelease.current[direction] = inside; delete arrowPointers.current[direction];
            event.currentTarget.releasePointerCapture(event.pointerId); setArrow(old => ({...old, [direction]: inside ? 'Hover' : 'Normal'}));
          }} onPointerCancel={() => {arrowRelease.current[direction] = false; cancelArrows();}}
          onLostPointerCapture={() => {delete arrowPointers.current[direction];}}
          onBlur={cancelArrows} onKeyDown={event => {if (event.key === ' ' || event.key === 'Enter') setArrow(old => ({...old, [direction]: 'Pushed'}));}}
          onKeyUp={event => {if (event.key === ' ' || event.key === 'Enter') setArrow(old => ({...old, [direction]: 'Normal'}));}}
          onClick={event => {
            if (event.detail && !arrowRelease.current[direction]) {arrowRelease.current[direction] = true; return;}
            root.current?.focus(); scrollTo(position + (direction === 'up' ? -lineHeight : lineHeight));
          }}/>;
      })}
    </div>
  </div>;
}
