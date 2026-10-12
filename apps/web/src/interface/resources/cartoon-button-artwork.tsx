import {useId} from 'react';

export type CartoonButtonShape = 'pill' | 'badge' | 'arrow' | 'bevel' | 'tab' | 'chat' | 'slab' | 'round' | 'invite' | 'team' | 'ready' | 'previous' | 'next';

function buttonContour(width: number, shape: CartoonButtonShape) {
  const cap = Math.min(1, width / 79);
  const left = (value: number) => value * cap;
  const right = (value: number) => width - value * cap;
  switch (shape) {
    case 'team':
      return {
        edge: `M3 2L${width - 4} 2Q${width - 1} 2 ${width - 1} 5
          L${width - 1} 33L${width - 4} 39L5 39L1 34L1 5Q1 2 3 2Z`,
        face: `M4 4L${width - 4} 4L${width - 3} 6L${width - 3} 31
          L${width - 6} 34L5 34L3 31L3 6Z`,
        highlight: `M4 4L${width - 4} 4L${width - 3} 6L6 6L4 8L4 30L3 31L3 6Z`,
        bevel: `M3 33L6 35L${width - 6} 35L${width - 2} 32
          L${width - 4} 37L6 37Z`,
      };
    case 'ready':
      return {
        edge: `M16 2L${width - 16} 2L${width - 7} 5L${width - 2} 11
          L${width - 1} 28L${width - 5} 35L${width - 12} 39L12 39
          L5 36L1 28L2 12L7 6Z`,
        face: `M17 4L${width - 17} 4L${width - 8} 7L${width - 4} 12
          L${width - 4} 28L${width - 8} 32L8 32L4 28L5 13L9 8Z`,
        highlight: `M17 4L${width - 17} 4L${width - 8} 7L${width - 4} 12
          L${width - 5} 18L${width - 8} 11L${width - 18} 7L19 7L10 11L7 17
          L6 29L4 28L5 13L9 8Z`,
        bevel: `M5 30L11 34L${width - 9} 34L${width - 4} 29
          L${width - 6} 35L${width - 12} 37L12 37L7 34Z`,
      };
    case 'round':
      return {
        edge: `M${width * .5} 2Q${width * .85} 1.8 ${width - 2} 15
          Q${width + .2} 24 ${width * .82} 34Q${width * .53} 41 ${width * .23} 35
          Q1 31 2 20Q1.5 7 ${width * .5} 2Z`,
        face: `M${width * .5} 4Q${width * .82} 3.8 ${width - 4.5} 16
          Q${width - 3.5} 25 ${width * .77} 32Q${width * .51} 37 ${width * .25} 32
          Q4 29 4.5 20Q4 9 ${width * .5} 4Z`,
        highlight: `M${width * .5} 4Q${width * .82} 3.8 ${width - 4.5} 16
          L${width - 7} 15Q${width * .79} 7 ${width * .5} 6.5Q7 10 7 20
          L4.5 20Q4 9 ${width * .5} 4Z`,
        bevel: `M6 26Q${width * .5} 40 ${width - 5} 24L${width - 5} 28
          Q${width * .52} 40 8 30Z`,
      };
    case 'invite':
      return {
        edge: `M${width * .5} 1.5A${width * .5 - 2} 18.5 0 1 1 ${width * .5} 38.5
          A${width * .5 - 2} 18.5 0 1 1 ${width * .5} 1.5Z`,
        face: `M${width * .5} 4A${width * .5 - 5} 15.5 0 1 1 ${width * .5} 35
          A${width * .5 - 5} 15.5 0 1 1 ${width * .5} 4Z`,
        highlight: `M5 20Q5 4 ${width * .5} 4Q${width * .8} 4 ${width - 7} 12
          L${width - 10} 13Q${width * .75} 7 ${width * .5} 7Q9 7 8 20Z`,
        bevel: `M8 25Q${width * .5} 37 ${width - 8} 24L${width - 7} 27
          Q${width * .5} 39 7 28Z`,
      };
    case 'slab':
      return {
        edge: `M7 3L${width - 8} 2.7Q${width - 3} 3 ${width - 2.5} 7
          L${width - 2} 31Q${width - 2.4} 36 ${width - 7} 36.5L7 36.8
          Q2.3 36.4 2 32L2.4 8Q2.6 3.3 7 3Z`,
        face: `M7 5L${width - 8} 4.7Q${width - 4.6} 5 ${width - 4.5} 8
          L${width - 4} 29.5Q${width - 4.5} 32.5 ${width - 8} 32.7L7 33
          Q4.6 32.4 4.5 29.5L4.8 8Q5 5.3 7 5Z`,
        highlight: `M7 5L${width - 8} 4.7L${width - 5} 6.2L${width - 6} 8
          L8 7.5L6.8 10L6.8 29L4.5 29.5L4.8 8Z`,
        bevel: `M5 32L8 34L${width - 8} 33.7L${width - 4} 31
          L${width - 4.5} 34L${width - 8} 35L8 35.2Z`,
      };
    case 'previous':
    case 'next':
      return {
        edge: `M${width - 5} 4 Q${width - 2} 3 ${width - 2} 7 L${width - 2} 31
          Q${width - 2} 35 ${width - 5} 35 L4 22 Q1 20 4 17 Z`,
        face: `M${width - 5} 7 L${width - 5} 26 L5 20 Z`,
        highlight: `M${width - 5} 7 L5 20 L7 21 L${width - 7} 11 L${width - 7} 25 L${width - 5} 26 Z`,
        bevel: `M4 22 L${width - 5} 31 L${width - 2} 29 L${width - 2} 32
          Q${width - 2} 34 ${width - 5} 33 L4 24 Z`,
      };
    case 'badge':
      return {
        edge: `M9 5 L${width - 16} 3 Q${width - 9} 3 ${width - 6} 8 L${width - 2} 22
          Q${width - 2} 27 ${width - 8} 32 L${width - 14} 35 L12 34
          Q5 34 3 27 L2 17 Q3 11 9 5 Z`,
        face: `M10 7 L${width - 16} 5 Q${width - 10} 5 ${width - 8} 10 L${width - 5} 21
          L${width - 11} 27 L12 27 Q7 25 5 21 L5 16 Z`,
        highlight: `M10 7 L${width - 16} 5 Q${width - 10} 5 ${width - 8} 10
          L${width - 6} 18 L${width - 10} 11 L${width - 17} 8 L12 9 L7 17 L7 23 L5 21 L5 16 Z`,
        bevel: `M6 25 L13 29 L${width - 12} 29 L${width - 5} 23
          L${width - 7} 29 L${width - 14} 32 L13 31 L7 28 Z`,
      };
    case 'arrow':
      return {
        edge: `M11 4 L${width - 23} 3 Q${width - 18} 3 ${width - 13} 8 L${width - 3} 17
          Q${width - 1} 20 ${width - 4} 25 L${width - 19} 35 L11 35
          Q5 34 3 29 L2 15 Q3 8 11 4 Z`,
        face: `M12 6 L${width - 24} 5 L${width - 15} 9 L${width - 5} 19
          L${width - 19} 28 L12 28 Q7 26 5 22 L5 15 Q6 9 12 6 Z`,
        highlight: `M12 6 L${width - 24} 5 L${width - 15} 9 L${width - 5} 19
          L${width - 9} 19 L${width - 17} 11 L${width - 25} 8 L14 8
          Q8 10 7 16 L7 24 L5 22 L5 15 Q6 9 12 6 Z`,
        bevel: `M6 25 L13 30 L${width - 20} 30 L${width - 5} 22
          L${width - 7} 27 L${width - 20} 32 L13 32 L7 29 Z`,
      };
    case 'bevel':
      return {
        edge: `M13 4 L${width - 18} 3 Q${width - 11} 3 ${width - 7} 9 L${width - 2} 20
          L${width - 4} 26 Q${width - 6} 30 ${width - 13} 32.5 L${width - 21} 34
          L12 34 Q7 34 4 28 L2 18 L5 10 Q7 6 13 4 Z`,
        face: `M14 6 L${width - 18} 5 L${width - 9} 11 L${width - 5} 20
          L${width - 13} 30.5 L12 30.5 L6 24.5 L5 18 L8 11 Z`,
        highlight: `M14 6 L${width - 18} 5 L${width - 9} 11 L${width - 5} 20
          L${width - 8} 20 L${width - 11} 13 L${width - 19} 8 L15 9
          L10 13 L7 19 L8 25 L6 23 L5 18 L8 11 Z`,
        bevel: `M6 26 L13 31.3 L${width - 14} 31.3 L${width - 5} 23.5
          L${width - 7} 28.5 L${width - 15} 32.4 L13 32.4 L8 29.5 Z`,
      };
    case 'tab':
      return {
        edge: `M10 4 L${width - 15} 3 L${width - 7} 7 Q${width - 3} 9 ${width - 2} 16
          L${width - 3} 24 L${width - 11} 34 L11 35 Q5 32 3 26
          L2 19 L5 11 Z`,
        face: `M11 6 L${width - 16} 5 L${width - 8} 9 L${width - 5} 17
          L${width - 6} 22 L${width - 13} 28 L11 28 L6 23 L5 18 L8 11 Z`,
        highlight: `M11 6 L${width - 16} 5 L${width - 8} 9 L${width - 5} 17
          L${width - 8} 16 L${width - 10} 11 L${width - 17} 8 L12 9
          L9 13 L7 21 L8 26 L6 23 L5 18 L8 11 Z`,
        bevel: `M6 25 L12 30 L${width - 13} 30 L${width - 5} 23
          L${width - 7} 28 L${width - 12} 32 L12 32 L7 29 Z`,
      };
    case 'chat':
      return {
        edge: `M10 4 L${width - 16} 3 Q${width - 8} 4 ${width - 4} 10
          L${width - 2} 16 L${width - 2} 29 Q${width - 3} 33 ${width - 10} 35
          L12 35 Q7 35 4 29 L2 21 L4 13 Z`,
        face: `M11 6 L${width - 16} 5 Q${width - 9} 6 ${width - 6} 12
          L${width - 5} 17 L${width - 6} 26 L12 28 L7 23 L5 19 L7 13 Z`,
        highlight: `M11 6 L${width - 16} 5 Q${width - 9} 6 ${width - 6} 12
          L${width - 5} 17 L${width - 8} 16 L${width - 10} 11 L${width - 17} 8
          L12 9 L9 14 L7 21 L8 25 L7 23 L5 19 L7 13 Z`,
        bevel: `M6 26 L13 30 L${width - 8} 29 L${width - 4} 25
          L${width - 5} 31 L${width - 10} 33 L13 32 L8 30 Z`,
      };
    default:
      return {
        edge: `M${left(29)} 3 L${right(40)} 3 L${right(14)} 5
          Q${right(4)} 13 ${right(3)} 21 Q${right(3)} 29 ${right(13)} 34
          L${right(29)} 35 L${left(20)} 35 Q${left(8)} 31 ${left(3)} 21
          Q${left(1)} 15 ${left(8)} 10 Q${left(17)} 4 ${left(29)} 3 Z`,
        face: `M${left(28)} 5 L${right(40)} 5 L${right(15)} 7
          Q${right(5)} 14 ${right(5)} 20 L${right(15)} 27 L${left(17)} 27
          Q${left(8)} 24 ${left(5)} 20 Q${left(3)} 13 ${left(12)} 9
          Q${left(19)} 6 ${left(28)} 5 Z`,
        highlight: `M${left(5)} 20 Q${left(3)} 13 ${left(12)} 9 Q${left(19)} 6 ${left(28)} 5
          L${right(40)} 5 L${right(15)} 7 L${right(11)} 10 L${right(39)} 7 L${left(30)} 7
          Q${left(18)} 8 ${left(13)} 11 Q${left(7)} 15 ${left(7)} 21 Z`,
        bevel: `M${left(7)} 24 L${left(18)} 28 L${right(15)} 28
          L${right(5)} 22 L${right(7)} 28 L${right(14)} 32
          L${left(21)} 32 L${left(12)} 29 Z`,
      };
  }
}

/** Each original silhouette shares the same painted layers and fixed-size caps. */
export function CartoonButtonArtwork({width, shape = 'pill', gradient = false}: {
  width: number; shape?: CartoonButtonShape; gradient?: boolean;
}) {
  const id = useId();
  const {edge, face, highlight, bevel} = buttonContour(width, shape);
  return <svg className="cartoon-control-art" viewBox={`0 0 ${width} 41`}
    preserveAspectRatio="none" aria-hidden="true" focusable="false">
    {gradient && <defs>
      <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
        <stop stopColor="var(--cartoon-button-face-top, var(--cartoon-button-highlight))"/>
        <stop offset=".58" stopColor="var(--cartoon-button-face)"/>
        <stop offset="1" stopColor="var(--cartoon-button-bevel)"/>
      </linearGradient>
    </defs>}
    {shape === 'team' && <defs>
      <clipPath id={`${id}-face`}><path d={face}/></clipPath>
      <pattern id={`${id}-motif`} width="34" height="15" patternUnits="userSpaceOnUse">
        <path d="M2 4H26V11H9V7H20M31 2V14H3" fill="none" stroke="#edf1c0" strokeWidth="2.5"/>
      </pattern>
    </defs>}
    <g transform={shape === 'next' ? `translate(${width} 0) scale(-1 1)` : undefined}>
      <path className="cartoon-button-shadow" d={edge}
        transform={shape === 'next' ? 'translate(-2 4)' : 'translate(2 4)'}/>
      <path className="cartoon-button-rim" d={edge} strokeWidth="1.5"/>
      <path className="cartoon-button-face" d={face} style={gradient ? {fill: `url(#${id})`} : undefined}/>
      {shape === 'team' && <rect className="cartoon-team-motif" width={width} height="41"
        fill={`url(#${id}-motif)`} clipPath={`url(#${id}-face)`} visibility="hidden" opacity=".35"/>}
      <path className="cartoon-button-highlight" d={highlight}/>
      <path className="cartoon-button-bevel" d={bevel}/>
      <path d={edge} fill="none" stroke="#14182b" strokeWidth="1.5"/>
    </g>
  </svg>;
}
