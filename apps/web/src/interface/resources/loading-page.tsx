import {useEffect, useState, type ComponentPropsWithoutRef, type ReactNode} from 'react';
import {imageResourceUrl} from '../../assets/image-cache';
import './loading-page.css';

/** Embedded letter fills in the original 800×600 background content. */
const LOADING_WORDS: Record<number, {left: number; top: number; width: number; height: number;
  empty: string; full: string}> = {
  1: {left: 425, top: 537, width: 342, height: 39,
    empty: '/local-images/interface/resources/loading-words/1-empty.png',
    full: '/local-images/interface/resources/loading-words/1-full.png'},
  2: {left: 24, top: 533, width: 342, height: 39,
    empty: '/local-images/interface/resources/loading-words/2-empty.png',
    full: '/local-images/interface/resources/loading-words/2-full.png'},
  3: {left: 8, top: 523, width: 342, height: 39,
    empty: '/local-images/interface/resources/loading-words/3-empty.png',
    full: '/local-images/interface/resources/loading-words/3-full.png'},
  4: {left: 439, top: 530, width: 342, height: 39,
    empty: '/local-images/interface/resources/loading-words/4-empty.png',
    full: '/local-images/interface/resources/loading-words/4-full.png'},
  5: {left: 11, top: 554, width: 302, height: 36,
    empty: '/local-images/interface/resources/loading-words/5-empty.png',
    full: '/local-images/interface/resources/loading-words/5-full.png'},
};

export function getLoadingArtwork(background: number) {
  const word = LOADING_WORDS[background];
  return {
    backgroundClassic: `/hd-ui/loading/${background}-4-3.png`,
    backgroundWide: `/hd-ui/loading/${background}-16-9.png`,
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

function loadingViewport() {
  const width = innerWidth / innerHeight >= 1.55 ? 600 * 16 / 9 : 800;
  return {width, scale: Math.min(innerWidth / width, innerHeight / 600)};
}

/** Shared loading backdrop with centered 800×600 progress and actions. */
export function LoadingPage({background, progress, status, details, artworkReady = true,
  actions, className, ...attributes}: LoadingPageProps) {
  const [{width: stageWidth, scale}, setViewport] = useState(loadingViewport);
  useEffect(() => {
    const resize = () => setViewport(loadingViewport());
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  const artwork = getLoadingArtwork(background);
  const {left, top, width, height} = LOADING_WORDS[background];
  const fraction = Math.max(0, Math.min(1, progress ?? 0));
  return <section {...attributes} className={`loading-page${className ? ` ${className}` : ''}`}>
    <div className="loading-viewport" style={{width: stageWidth * scale, height: 600 * scale}}>
      <div className="loading-stage" style={{width: stageWidth, transform: `scale(${scale})`}}>
        {artworkReady && <img className="loading-background"
          src={imageResourceUrl(stageWidth > 800 ? artwork.backgroundWide : artwork.backgroundClassic)}
          alt="" draggable={false}/>}
        <div className="loading-content">
          {artworkReady && <>
            <img className="loading-tank" src={imageResourceUrl(artwork.tank)} alt="" draggable={false}/>
            <div className="loading-word" style={{left, top, width, height}}
              role="progressbar" aria-label="本机资源加载进度"
              aria-valuemin={0} aria-valuemax={100}
              aria-valuenow={progress === undefined ? undefined : Math.round(fraction * 100)}
              aria-valuetext={status}>
              <img src={imageResourceUrl(artwork.progressEmpty)} alt="" draggable={false}/>
              <img src={imageResourceUrl(artwork.progressFull)} alt="" draggable={false}
                style={{clipPath: `inset(0 ${(1 - fraction) * 100}% 0 0)`}}/>
            </div>
          </>}
          <output className="loading-status" role="status" aria-live="polite">
            {status}
            {details && <span className="loading-details">{details}</span>}
          </output>
          {actions && <div className="loading-actions">{actions}</div>}
        </div>
      </div>
    </div>
  </section>;
}
