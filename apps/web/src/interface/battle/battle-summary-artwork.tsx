import {useId, type ComponentPropsWithoutRef, type CSSProperties} from 'react';
import {useButtonInteraction} from '../resources/button-interaction';
import {GameGlassFrame} from '../resources/game-glass-frame';
import {imageResourceUrl} from '../../assets/image-cache';

export const SUMMARY_ART = '/ui/battle/summary';
export const SUMMARY_TEAM_ART = {Cat: '/ui/regions/67/2.png', Dog: '/ui/regions/67/5.png'};
export const SUMMARY_COLUMNS = {
  name: {left: 68, width: 94},
  score: {left: 166, width: 48},
  metric: {left: 222, width: 60},
  awards: {left: 288, width: 96},
} as const;
const PLATES = `${SUMMARY_ART}/plates.svg`;

/** Both animated header halves sample one continuous full-width background. */
export function SummaryPlate({kind, style, edge = 'both', className = ''}: {
  kind: 'top-left' | 'top-right' | 'body' | 'bottom' | 'bottom-ribbon' | 'medallion';
  style: CSSProperties; edge?: 'left' | 'right' | 'both'; className?: string;
}) {
  const size = kind.startsWith('top-') ? [390, 121] : kind === 'bottom' ? [780, 85]
    : kind === 'bottom-ribbon' ? [780, 40]
    : kind === 'medallion' ? [50, 44] : [Number(style.width), Number(style.height)];
  return <svg style={style} className={`battle-summary-plate ${className}`} viewBox={`0 0 ${size[0]} ${size[1]}`}
    preserveAspectRatio="none" aria-hidden="true" focusable="false">
    {kind.startsWith('top-') ? <image href={imageResourceUrl(`${SUMMARY_ART}/top-background.png`)}
      x={kind === 'top-right' ? -390 : 0} width="780" height="121" preserveAspectRatio="none"/>
      : kind === 'bottom' || kind === 'bottom-ribbon' ? <image href={imageResourceUrl(`${SUMMARY_ART}/bottom-background.png`)}
        y={kind === 'bottom-ribbon' ? -45 : 0} width="780" height="85" preserveAspectRatio="none"/>
      : kind === 'medallion' ? <>
        <circle cx="27" cy="22" r="21.5" fill="#615bd4" stroke="#756be9" strokeWidth="1"/>
        <circle cx="27" cy="22" r="17.8" fill="#f6f5fc" stroke="#6e6c90" strokeWidth="2.6"/>
      </> : <>
        <rect width={size[0]} height={size[1]} fill="#3c72af" fillOpacity={238 / 255}/>
        <path d={`${edge !== 'right' ? `M.8 0V${size[1]}` : ''}${edge !== 'left' ? `M${size[0] - .8} 0V${size[1]}` : ''}`}
          stroke="#6266cb" strokeWidth="1.5"/>
      </>}
  </svg>;
}

/** Blue score strips and the local player's green strip share their carved contour. */
export function SummaryRowArtwork({self, dividers}: {self: boolean; dividers?: readonly [number, number, number]}) {
  const [scoreEdge, metricEdge, awardEdge] = dividers ?? [
    SUMMARY_COLUMNS.score.left - 2, SUMMARY_COLUMNS.metric.left - 4, SUMMARY_COLUMNS.awards.left - 4,
  ];
  const sourceEdges = [0, 226, 280, 342, 386];
  const edges = [0, scoreEdge, metricEdge, awardEdge, 386];
  return <svg className="battle-summary-row-background" viewBox="0 0 386 58" preserveAspectRatio="none"
    aria-hidden="true" focusable="false">
    <use href={imageResourceUrl(`${PLATES}#row-rim`)} transform="translate(-2 1.5)" fill="#080e20" opacity=".9"/>
    <use href={imageResourceUrl(`${PLATES}#row-rim`)} fill={self ? '#00bc73' : '#0049bc'} stroke={self ? '#39c994' : '#356fca'} strokeWidth="1"/>
    {sourceEdges.slice(0, -1).map((left, index) => <svg key={left} x={edges[index]} y="0"
      width={edges[index + 1] - edges[index]} height="58"
      viewBox={`${left} 0 ${sourceEdges[index + 1] - left} 58`} preserveAspectRatio="none" overflow="hidden">
      <use href={imageResourceUrl(`${PLATES}#row-face`)} fill={self ? '#009148' : '#004991'}/>
    </svg>)}
    <path d={`M${scoreEdge} 9V49M${metricEdge} 16L${metricEdge + 1} 50M${awardEdge} 9L${awardEdge + 1} 49`}
      stroke={self ? '#1faa69' : '#0452a4'} strokeWidth="1.1"/>
  </svg>;
}

export function SummaryPortrait({petId, outcome, frame, style, name}: {
  petId: number; outcome: string; frame: number; style: CSSProperties; name: string;
}) {
  const pose = outcome === 'WIN' ? `yeah_${frame}` : 'die';
  return <img style={style} className="battle-summary-portrait" alt={`${name}的宠物头像`} draggable={false}
    src={imageResourceUrl(`${SUMMARY_ART}/pet-${petId}-${pose}.png`)}
    data-summary-pet={petId} data-summary-portrait-frame={outcome === 'WIN' ? frame : undefined}/>;
}

/** The EXP fill is clipped inside the original black track and cyan rim. */
export function SummaryProgress({percent, style}: {percent: number; style: CSSProperties}) {
  const id = useId();
  const value = Math.max(0, Math.min(100, percent));
  return <svg className="battle-summary-exp" style={style} viewBox="0 0 718 17" preserveAspectRatio="none"
    role="progressbar" aria-label="成长进度" aria-valuemin={0} aria-valuemax={100}
    aria-valuenow={value} data-summary-exp={percent}>
    <defs>
      <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
        <stop stopColor="#e3292c"/><stop offset=".45" stopColor="#c51e24"/><stop offset="1" stopColor="#a7131a"/>
      </linearGradient>
    </defs>
    <rect x=".5" y=".5" width="717" height="16" fill="#000"/>
    <rect x="1" y="1" width={716 * value / 100} height="15" fill={`url(#${id})`}/>
    <path d="M.5 .5H717.5V16.5H.5Z" fill="none" stroke="#83e5eb" strokeWidth=".8"/>
  </svg>;
}

/** The continue silhouette retains its cyan, yellow-hover and blue-pressed source states. */
export function SummaryContinueButton({className = '', children = '继续', ...props}: ComponentPropsWithoutRef<'button'>) {
  const {element, buttonProps, state} = useButtonInteraction(props);
  return <button {...buttonProps} ref={element} className={`battle-summary-continue ${className}`}
    data-source-button-state={state}>
    <svg viewBox="0 0 183 39" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <use href={imageResourceUrl(`${PLATES}#continue-shadow`)} fill="#052144"/>
      <use href={imageResourceUrl(`${PLATES}#continue-edge`)} fill="#02091b"/>
      <use href={imageResourceUrl(`${PLATES}#continue-face`)} fill="var(--summary-button-face)"/>
      <use href={imageResourceUrl(`${PLATES}#continue-light`)} fill="var(--summary-button-light)"/>
      <use href={imageResourceUrl(`${PLATES}#continue-bevel`)} fill="var(--summary-button-shade)"/>
    </svg>
    <span>{children}</span>
  </button>;
}

export function SummaryReceiptArtwork({style}: {style: CSSProperties}) {
  const width = Number(style.width), height = Number(style.height);
  return <GameGlassFrame className="battle-summary-receipt-art" style={style} width={width} height={height}/>;
}
