import {imageResourceUrl} from '../../assets/image-cache';
import {useId, type ComponentPropsWithoutRef} from 'react';
import {GameSurfaceTexture} from './game-surface-texture';
import './game-surface-panel.css';

const SURFACE_PANELS = {
  rooms: {width: 615, height: 277, tone: 'room-canvas', edgeTone: 'room-edge', frame: '#947d52',
    insetBlur: 1.4, insetDepth: 1.1, insetOpacity: .28},
  players: {width: 190, height: 463, tone: 'player-paper', edgeTone: 'panel-gold', frame: '#897b4e',
    insetBlur: 2.6, insetDepth: 3, insetOpacity: .66},
  social: {width: 190, height: 503, tone: 'player-paper', edgeTone: 'panel-gold', frame: '#897b4e',
    insetBlur: 2.6, insetDepth: 3, insetOpacity: .66},
  tabs: {width: 190, height: 43, tone: 'tab-ochre', edgeTone: 'panel-gold', frame: '#b38942',
    insetBlur: 1.1, insetDepth: 1, insetOpacity: .23},
  'chat-input': {width: 615, height: 39, tone: 'input-cream', edgeTone: 'panel-gold', frame: '',
    insetBlur: .9, insetDepth: .7, insetOpacity: .2},
  'waiting-sheet': {width: 615, height: 400, tone: 'waiting-canvas', edgeTone: 'waiting-canvas', frame: '', rim: '#42501d',
    insetBlur: 2.4, insetDepth: 2, insetOpacity: .3},
  'waiting-roster': {width: 179, height: 272, tone: 'roster-sage', edgeTone: 'roster-sage', frame: '', rim: '#83894f',
    insetBlur: 2, insetDepth: 1.7, insetOpacity: .4},
  'waiting-details': {width: 218, height: 334, tone: 'player-paper', edgeTone: 'player-paper', frame: '', rim: 'none',
    insetBlur: 2.4, insetDepth: 2, insetOpacity: .38},
  'waiting-rules': {width: 206, height: 258, tone: 'player-paper', edgeTone: 'waiting-canvas', frame: '', rim: 'none', softEdge: .55,
    insetBlur: .9, insetDepth: .35, insetOpacity: .09},
  'waiting-description': {width: 206, height: 136, tone: 'map-description', edgeTone: 'waiting-canvas', frame: '', rim: 'none', faceOnly: true,
    insetBlur: 3, insetDepth: 3.2, insetOpacity: .72},
  'waiting-player': {width: 179, height: 39, tone: 'player-paper', edgeTone: 'peach', frame: '', rim: '#d19771',
    insetBlur: 1.1, insetDepth: 1, insetOpacity: .35},
  'waiting-player-right': {width: 179, height: 39, tone: 'player-paper', edgeTone: 'peach', frame: '', rim: '#d19771',
    insetBlur: 1.1, insetDepth: 1, insetOpacity: .35},
  'waiting-empty': {width: 179, height: 39, tone: 'player-paper', edgeTone: 'peach', frame: '', rim: '#d19771',
    insetBlur: 1.2, insetDepth: 1.1, insetOpacity: .32},
} as const;

export interface GameSurfacePanelProps extends ComponentPropsWithoutRef<'div'> {
  shape: keyof typeof SURFACE_PANELS;
}

/** Each original panel keeps its own contour, rim and inset depth. */
export function GameSurfacePanel({shape, className = '', style, children, ...props}: GameSurfacePanelProps) {
  const {width, height} = SURFACE_PANELS[shape];
  const size = {width: typeof style?.width === 'number' ? style.width : width,
    height: typeof style?.height === 'number' ? style.height : height};
  return <div {...props} className={`game-surface-panel ${className}`} data-surface-panel={shape}
    style={{width, height, ...style}}>
    <GameSurfacePanelArtwork shape={shape} size={size}/>
    {children}
  </div>;
}

/** Fixed-size rims surround one continuous texture at every panel size. */
function SurfacePanelMask({id, shape, part, width, height}: {
  id: string; shape: 'rooms' | 'chat-input'; part: 'outer' | 'frame' | 'face'; width: number; height: number;
}) {
  const source = SURFACE_PANELS[shape];
  const leftCap = shape === 'chat-input' ? 52 : 24;
  const rightCap = shape === 'chat-input' ? 41 : 24;
  const verticalCap = shape === 'chat-input' ? 8 : 24;
  const columns = [{start: 0, length: leftCap, sourceStart: 0, sourceLength: leftCap},
    {start: leftCap, length: width - leftCap - rightCap, sourceStart: leftCap,
      sourceLength: source.width - leftCap - rightCap},
    {start: width - rightCap, length: rightCap, sourceStart: source.width - rightCap, sourceLength: rightCap}];
  const rows = [{start: 0, length: verticalCap, sourceStart: 0, sourceLength: verticalCap},
    {start: verticalCap, length: height - verticalCap * 2, sourceStart: verticalCap,
      sourceLength: source.height - verticalCap * 2},
    {start: height - verticalCap, length: verticalCap, sourceStart: source.height - verticalCap,
      sourceLength: verticalCap}];
  return <mask id={id} maskUnits="userSpaceOnUse" x="0" y="0" width={width} height={height}>
    {rows.flatMap((row, y) => columns.map((column, x) => <svg key={`${x}:${y}`}
      x={column.start} y={row.start} width={column.length} height={row.length}
      viewBox={`${column.sourceStart} ${row.sourceStart} ${column.sourceLength} ${row.sourceLength}`}
      preserveAspectRatio="none" overflow="hidden">
      <use href={imageResourceUrl(`/ui/lobby/panels.svg#${shape}-${part}`)} fill="#fff"/>
    </svg>))}
  </mask>;
}

function GameSurfacePanelArtwork({shape, size}: Pick<GameSurfacePanelProps, 'shape'> & {
  size: {width: number; height: number;};
}) {
  const id = useId();
  const panel = SURFACE_PANELS[shape];
  const scalable = shape === 'rooms' || shape === 'chat-input';
  const dimensions = scalable ? size : panel;
  const resized = scalable && (size.width !== panel.width || size.height !== panel.height);
  const textureId = `${id}-face`;
  const edgeId = `${id}-edge`;
  const insetId = `${id}-inset`;
  const lightId = `${id}-light`;
  const washId = `${id}-wash`;
  const tabTextureId = `${id}-tabs`;
  const softEdgeId = `${id}-soft-edge`;
  const outline = `/ui/lobby/panels.svg#${shape}`;
  const faceOutline = shape === 'social' ? '/ui/lobby/panels.svg#players' : outline;
  const contour = (part: 'outer' | 'frame' | 'face', paint: Pick<ComponentPropsWithoutRef<'path'>,
    'fill' | 'stroke' | 'strokeWidth' | 'strokeLinejoin' | 'filter'>) => resized
    ? <g {...paint}><rect width={dimensions.width} height={dimensions.height} mask={`url(#${id}-${part}-mask)`}/></g>
    : <use href={imageResourceUrl(`${part === 'outer' ? outline : faceOutline}-${part}`)} {...paint}/>;
  return <svg className="game-surface-panel-artwork" viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
    preserveAspectRatio="none" aria-hidden="true" focusable="false">
    <GameSurfaceTexture id={textureId} tone={panel.tone} size={dimensions}/>
    <GameSurfaceTexture id={edgeId} tone={panel.edgeTone} size={dimensions}/>
    {shape === 'social' && <GameSurfaceTexture id={tabTextureId}
      tone={SURFACE_PANELS.tabs.tone} size={SURFACE_PANELS.tabs}/>}
    <defs>
      {'softEdge' in panel && <filter id={softEdgeId} x="-2%" y="-2%" width="104%" height="104%">
        <feGaussianBlur stdDeviation={panel.softEdge}/>
      </filter>}
      {resized && (shape === 'rooms' || shape === 'chat-input')
        && (shape === 'rooms' ? ['outer', 'frame', 'face'] as const : ['outer', 'face'] as const).map(part =>
        <SurfacePanelMask key={part} id={`${id}-${part}-mask`} shape={shape} part={part} {...dimensions}/>)}
      <filter id={insetId} x="-10%" y="-30%" width="120%" height="160%" colorInterpolationFilters="sRGB">
        <feGaussianBlur in="SourceAlpha" stdDeviation={panel.insetBlur} result="soft-contour"/>
        <feOffset in="soft-contour" dx=".6" dy={panel.insetDepth} result="lower-contour"/>
        <feComposite in="SourceAlpha" in2="lower-contour" operator="out" result="inner-edge"/>
        <feFlood floodColor="#3e351a" floodOpacity={panel.insetOpacity} result="shade"/>
        <feComposite in="shade" in2="inner-edge" operator="in"/>
      </filter>
      <filter id={lightId} x="-10%" y="-30%" width="120%" height="160%" colorInterpolationFilters="sRGB">
        <feOffset in="SourceAlpha" dx="-.4" dy="-.8" result="upper-contour"/>
        <feComposite in="SourceAlpha" in2="upper-contour" operator="out" result="lower-edge"/>
        <feGaussianBlur in="lower-edge" stdDeviation=".65" result="soft-light"/>
        <feComposite in="soft-light" in2="SourceAlpha" operator="in" result="inner-light"/>
        <feFlood floodColor="#fff2cc" floodOpacity=".35" result="light"/>
        <feComposite in="light" in2="inner-light" operator="in"/>
      </filter>
      <linearGradient id={washId} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fff0c9" stopOpacity=".055"/>
        <stop offset=".45" stopColor="#fff0c9" stopOpacity="0"/>
        <stop offset="1" stopColor="#78552c" stopOpacity=".025"/>
      </linearGradient>
    </defs>
    {!('faceOnly' in panel) && contour('outer', {fill: `url(#${edgeId})`,
      stroke: 'rim' in panel ? panel.rim : '#42501d', strokeWidth: '.9', strokeLinejoin: 'round'})}
    <g transform={shape === 'social' ? 'translate(0 40)' : undefined}>
      {panel.frame && contour('frame', {fill: panel.frame})}
      {contour('face', {fill: `url(#${textureId})`,
        filter: 'softEdge' in panel ? `url(#${softEdgeId})` : undefined})}
      {contour('face', {fill: `url(#${washId})`})}
      {contour('face', {fill: '#000', filter: `url(#${insetId})`})}
      {contour('face', {fill: '#fff', filter: `url(#${lightId})`})}
    </g>
    {shape === 'social' && <>
      <use href={imageResourceUrl('/ui/lobby/panels.svg#tabs-frame')} fill={SURFACE_PANELS.tabs.frame}/>
      <use href={imageResourceUrl('/ui/lobby/panels.svg#tabs-face')} fill={`url(#${tabTextureId})`}/>
      <use href={imageResourceUrl('/ui/lobby/panels.svg#tabs-face')} fill={`url(#${washId})`}/>
      <use href={imageResourceUrl('/ui/lobby/panels.svg#social-divider')} fill="#747044"/>
    </>}
  </svg>;
}
