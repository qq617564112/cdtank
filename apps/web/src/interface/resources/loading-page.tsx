import {LoadingErrorDialog} from './loading-error-dialog';
import type {ComponentPropsWithoutRef, ReactNode} from 'react';
import {imageResourceUrl} from '../../assets/image-cache';
import {ImageArtwork} from './image-artwork';
import {useSourceScale} from '../lobby/source-react';
import './loading-page.css?v=20261010-zcool-5';

export function getLoadingArtwork(background: number) {
  return {
    background: `/Data/ui/loading/${background}.png`,
    tank: '/Data/ui/loading/tanke.png',
  };
}

interface LoadingPageProps extends Omit<ComponentPropsWithoutRef<'section'>, 'children'> {
  background: number;
  progress?: number;
  status: string;
  error?: string;
  details?: string;
  artworkReady?: boolean;
  actions?: ReactNode;
}

/** Crop one widescreen master while keeping the original controls in the safe area. */
export function LoadingPage({background, progress, status, error, details, artworkReady = true,
  actions, className, ...attributes}: LoadingPageProps) {
  const {viewport, stage} = useSourceScale(800, 600, 0, 0, 0.1, Infinity);
  const artwork = getLoadingArtwork(background);
  const fraction = Math.max(0, Math.min(1, progress ?? 0));
  const percent = Math.floor(fraction * 100);
  return <section {...attributes} className={`loading-page${className ? ` ${className}` : ''}`}
    data-loading-background={background}>
    {artworkReady && <img className="loading-background" src={imageResourceUrl(artwork.background)}
      width={3840} height={2160} alt="" aria-hidden="true" draggable={false}/>}
    <div className="loading-viewport" style={viewport}>
      <div className="loading-stage" style={stage}>
        <div className="loading-content">
          {artworkReady && <ImageArtwork className="loading-tank" asset={artwork.tank} aria-hidden="true"/>}
          {artworkReady && <div className="loading-word" role="progressbar" aria-label="本机资源加载进度"
            aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}
            aria-valuetext={`${status} ${percent}%`}>
            <span className="loading-label" aria-hidden="true">
              {Array.from('LOADING...').map((character, index) =>
                <span className="loading-character" key={index}
                  style={{animationDelay: `${index * 70}ms`}}>{character}</span>)}
            </span>
            <span className="loading-percent" aria-hidden="true">
              {Array.from(`${String(percent).padStart(3, '\u00a0')}%`).map((character, index) =>
                <span className="loading-character" key={index}
                  style={{animationDelay: `${(index + 11) * 70}ms`}}>{character}</span>)}
            </span>
          </div>}
        </div>
      </div>
    </div>
    <div className="loading-progress-track" aria-hidden="true">
      <div className="loading-progress-fill" style={{width: `${fraction * 100}%`}}/>
    </div>
    {error && <LoadingErrorDialog message={error} details={details} actions={actions}/>}
  </section>;
}
