import type {ComponentPropsWithoutRef, ReactNode} from 'react';
import {useSourceScale} from '../lobby/source-react';
import './loading-page.css';

/** Embedded letter fills in the original 800×600 background content. */
const LOADING_WORDS: Record<number, {left: number; top: number; width: number; height: number;
  empty: string; full: string}> = {
  1: {left: 425, top: 537, width: 342, height: 39,
    empty: new URL('./loading-words/1-empty.png', import.meta.url).href,
    full: new URL('./loading-words/1-full.png', import.meta.url).href},
  2: {left: 24, top: 533, width: 342, height: 39,
    empty: new URL('./loading-words/2-empty.png', import.meta.url).href,
    full: new URL('./loading-words/2-full.png', import.meta.url).href},
  3: {left: 8, top: 523, width: 342, height: 39,
    empty: new URL('./loading-words/3-empty.png', import.meta.url).href,
    full: new URL('./loading-words/3-full.png', import.meta.url).href},
  4: {left: 439, top: 530, width: 342, height: 39,
    empty: new URL('./loading-words/4-empty.png', import.meta.url).href,
    full: new URL('./loading-words/4-full.png', import.meta.url).href},
  5: {left: 11, top: 554, width: 302, height: 36,
    empty: new URL('./loading-words/5-empty.png', import.meta.url).href,
    full: new URL('./loading-words/5-full.png', import.meta.url).href},
};

export function getLoadingArtwork(background: number) {
  const word = LOADING_WORDS[background];
  return {
    background: `/Data/ui/loading/${background}.png`,
    tank: '/Data/ui/loading/tanke.png',
    progressEmpty: word.empty,
    progressFull: word.full,
  };
}

interface LoadingPageProps extends Omit<ComponentPropsWithoutRef<'section'>, 'children'> {
  background: number;
  progress?: number;
  status: string;
  details?: string;
  artworkReady?: boolean;
  actions?: ReactNode;
}

/** Shared original 800×600 loading layout for startup and match resources. */
export function LoadingPage({background, progress, status, details, artworkReady = true,
  actions, className, ...attributes}: LoadingPageProps) {
  const {viewport, stage} = useSourceScale(800, 600, 0, 0, 0.1, Infinity);
  const artwork = getLoadingArtwork(background);
  const {left, top, width, height} = LOADING_WORDS[background];
  const fraction = Math.max(0, Math.min(1, progress ?? 0));
  return <section {...attributes} className={`loading-page${className ? ` ${className}` : ''}`}>
    <div className="loading-viewport" style={viewport}>
      <div className="loading-stage" style={stage}>
        <div hidden={!artworkReady}>
          <img className="loading-background" src={artwork.background} alt="" draggable={false}/>
          <img className="loading-tank" src={artwork.tank} alt="" draggable={false}/>
          <div className="loading-word" style={{left, top, width, height}}
            role="progressbar" aria-label="本机资源加载进度"
            aria-valuemin={0} aria-valuemax={100}
            aria-valuenow={progress === undefined ? undefined : Math.round(fraction * 100)}
            aria-valuetext={status}>
            <img src={artwork.progressEmpty} alt="" draggable={false}/>
            <img src={artwork.progressFull} alt="" draggable={false}
              style={{clipPath: `inset(0 ${(1 - fraction) * 100}% 0 0)`}}/>
          </div>
        </div>
        <output className="loading-status" role="status" aria-live="polite">
          {status}
          {details && <span className="loading-details">{details}</span>}
        </output>
        {actions && <div className="loading-actions">{actions}</div>}
      </div>
    </div>
  </section>;
}
