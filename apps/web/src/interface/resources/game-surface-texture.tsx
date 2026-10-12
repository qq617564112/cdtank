import {imageResourceUrl} from '../../assets/image-cache';
export type GameSurfaceTone = 'rose' | 'peach' | 'sand' | 'coral' | 'terracotta' | 'walnut' | 'clay'
  | 'salmon' | 'parchment' | 'ochre' | 'room-canvas' | 'room-edge' | 'player-paper'
  | 'tab-ochre' | 'panel-gold' | 'input-cream' | 'waiting-canvas' | 'roster-sage' | 'map-description';

const SURFACE_TONES = {
  rose: {color: '#ed987f', red: '.84 1', green: '.49 .70', blue: '.40 .60'},
  peach: {color: '#efab8a', red: '.85 1', green: '.57 .77', blue: '.44 .64'},
  sand: {color: '#eeb17f', red: '.85 1', green: '.59 .80', blue: '.40 .60'},
  coral: {color: '#e37d64', red: '.79 .99', green: '.39 .59', blue: '.29 .49'},
  terracotta: {color: '#e78268', red: '.81 1', green: '.41 .61', blue: '.31 .51'},
  walnut: {color: '#995b43', red: '.50 .70', green: '.25 .45', blue: '.17 .35'},
  clay: {color: '#da9c7c', red: '.775 .935', green: '.53 .70', blue: '.405 .565'},
  salmon: {color: '#d88762', red: '.75 .94', green: '.43 .63', blue: '.28 .47'},
  parchment: {color: '#ead99b', red: '.82 1', green: '.75 .94', blue: '.48 .71'},
  ochre: {color: '#b5893e', red: '.60 .82', green: '.40 .62', blue: '.13 .35'},
  'room-canvas': {color: '#d07f5f', red: '.72 .91', green: '.42 .575', blue: '.285 .46'},
  'room-edge': {color: '#b76252', red: '.63 .81', green: '.315 .46', blue: '.26 .39'},
  'player-paper': {color: '#efd6a3', red: '.90 .98', green: '.77 .91', blue: '.54 .73'},
  'tab-ochre': {color: '#b26e26', red: '.61 .79', green: '.355 .51', blue: '.05 .25'},
  'panel-gold': {color: '#af924c', red: '.61 .76', green: '.49 .655', blue: '.21 .385'},
  'input-cream': {color: '#ffebba', red: '1 1', green: '.89 .95', blue: '.69 .77'},
  'waiting-canvas': {color: '#ed9677', red: '.85 1', green: '.48 .73', blue: '.34 .58'},
  'roster-sage': {color: '#abb677', red: '.60 .76', green: '.64 .79', blue: '.35 .57'},
  'map-description': {color: '#c65752', red: '.67 .88', green: '.25 .43', blue: '.24 .40'},
} as const;

/** Panels and cards recolor the same continuous MDF photograph. */
export function GameSurfaceTexture({id, tone, size}: {
  id: string; tone: GameSurfaceTone; size?: {width: number; height: number;};
}) {
  const palette = SURFACE_TONES[tone];
  const colorId = `${id}-color`;
  const width = size?.width ?? 256;
  const height = size?.height ?? 256;
  return <defs>
    <filter id={colorId} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
      <feColorMatrix type="saturate" values="0"/>
      <feComponentTransfer>
        <feFuncR type="table" tableValues={palette.red}/>
        <feFuncG type="table" tableValues={palette.green}/>
        <feFuncB type="table" tableValues={palette.blue}/>
      </feComponentTransfer>
    </filter>
    <pattern id={id} patternUnits="userSpaceOnUse" width={width} height={height}>
      <rect width={width} height={height} fill={palette.color}/>
      <image href={imageResourceUrl('/ui/cards/mdf-texture.webp')} width={width} height={height}
        preserveAspectRatio="xMidYMid slice" filter={`url(#${colorId})`}/>
    </pattern>
  </defs>;
}
