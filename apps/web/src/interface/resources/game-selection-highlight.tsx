import {useId, useLayoutEffect, useRef, useState, type ComponentPropsWithoutRef} from 'react';
import {selectionBrush} from './selection-brush';
import './game-selection-highlight.css';

/** The hand-drawn contour follows the row's layout size without stretching its brushwork. */
export function GameSelectionHighlight({className = '', ...props}: ComponentPropsWithoutRef<'span'>) {
  const ref = useRef<HTMLSpanElement>(null);
  const [size, setSize] = useState({width: 492, height: 32});
  const mask = `${useId()}-selection-bristles`;
  useLayoutEffect(() => {
    const element = ref.current!;
    const resize = () => {
      const width = element.clientWidth, height = element.clientHeight;
      if (width <= 0 || height <= 0) return;
      setSize(current => current.width === width && current.height === height ? current : {width, height});
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const {outline, bristles} = selectionBrush(size.width, size.height);
  const scale = size.height / 32;
  return <span {...props} ref={ref} className={`game-selection-highlight ${className}`} aria-hidden="true">
    <svg viewBox={`0 0 ${size.width} ${size.height}`} aria-hidden="true" focusable="false">
      <defs>
        <mask id={mask} maskUnits="userSpaceOnUse" x="0" y="0" width={size.width} height={size.height}>
          <rect width={size.width} height={size.height} fill="#fff"/>
          {bristles.map(path => <path key={path} d={path} fill="none" stroke="#000" strokeOpacity=".55"
            strokeWidth={.48 * scale} strokeLinecap="round"/>)}
        </mask>
      </defs>
      <path d={outline} fill="#25210b" transform={`translate(${.35 * scale} ${1.1 * scale})`}/>
      <path d={outline} fill="#fffc00" mask={`url(#${mask})`}/>
    </svg>
  </span>;
}
