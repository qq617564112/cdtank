import {LoadingErrorDialog} from './loading-error-dialog';
import {useEffect, useState, type ComponentPropsWithoutRef, type ReactNode} from 'react';
import {imageResourceUrl} from '../../assets/image-cache';
import {decodeImageRegion, imageRegion} from '../../assets/image-resources';
import {publishedImageUrl} from '../../assets/sprite-images';
import {ImageArtwork} from './image-artwork';
import {usePageLayout} from './use-page-layout';
import './loading-page.css?v=20261010-zcool-5';

export function getLoadingArtwork(background: number) {
  return {
    background: `/Data/ui/loading/${background}.png`,
    tank: '/Data/ui/loading/tanke.png',
  };
}

export interface LoadingPageProps extends Omit<ComponentPropsWithoutRef<'section'>, 'children'> {
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
  const {viewport, stage} = usePageLayout();
  const artwork = getLoadingArtwork(background);
  const backgroundUrl = publishedImageUrl(artwork.background);
  const tankUrl = publishedImageUrl(artwork.tank);
  const [backgroundSource, setBackgroundSource] = useState<string>();
  const [, refreshArtwork] = useState(0);
  const [artworkError, setArtworkError] = useState('');
  useEffect(() => {
    if (!artworkReady) return;
    const controller = new AbortController();
    setArtworkError('');
    void Promise.all([backgroundUrl, tankUrl]
      .map(url => decodeImageRegion(url, controller.signal))).then(() => {
      if (controller.signal.aborted) return;
      setBackgroundSource(imageResourceUrl(backgroundUrl));
      refreshArtwork(value => value + 1);
    }).catch(reason => {
      if (!controller.signal.aborted) setArtworkError(reason instanceof Error ? reason.message : String(reason));
    });
    return () => {controller.abort();};
  }, [backgroundUrl, tankUrl, artworkReady]);
  const tankReady = artworkReady && !!imageRegion(artwork.tank);
  const fraction = Math.max(0, Math.min(1, progress ?? 0));
  const percent = Math.floor(fraction * 100);
  return <section {...attributes} className={`loading-page${className ? ` ${className}` : ''}`}
    data-loading-background={background}>
    {backgroundSource && <img className="loading-background" src={backgroundSource}
      width={3840} height={2160} alt="" aria-hidden="true" draggable={false}/>}
    <div className="loading-viewport" style={viewport}>
      <div className="loading-stage" style={stage}>
        <div className="loading-content">
          {tankReady && <ImageArtwork className="loading-tank" asset={artwork.tank} aria-hidden="true"/>}
          <div className="loading-word" role="progressbar"
            aria-label={progress === undefined ? status : '本机资源加载进度'}
            aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress === undefined ? undefined : percent}
            aria-valuetext={progress === undefined ? status : `${status} ${percent}%`}>
            <span className="loading-label" aria-hidden="true">
              {Array.from('LOADING...').map((character, index) =>
                <span className="loading-character" key={index}
                  style={{animationDelay: `${index * 70}ms`}}>{character}</span>)}
            </span>
            {progress !== undefined && <span className="loading-percent" aria-hidden="true">
              {Array.from(`${String(percent).padStart(3, '\u00a0')}%`).map((character, index) =>
                <span className="loading-character" key={index}
                  style={{animationDelay: `${(index + 11) * 70}ms`}}>{character}</span>)}
            </span>}
          </div>
        </div>
      </div>
    </div>
    {progress !== undefined && <div className="loading-progress-track" aria-hidden="true">
      <div className="loading-progress-fill" style={{width: `${fraction * 100}%`}}/>
    </div>}
    {(error || artworkError) && <LoadingErrorDialog message={error || artworkError} details={details} actions={actions}/>}
  </section>;
}
