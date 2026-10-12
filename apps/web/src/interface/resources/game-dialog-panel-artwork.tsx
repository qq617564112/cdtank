import {imageResourceUrl} from '../../assets/image-cache';
import {useId} from 'react';
import {GameSurfaceTexture, type GameSurfaceTone} from './game-surface-texture';

/** One MDF fill follows the torn outer contour beneath the inner frame. */
export function GameDialogPanelArtwork({tone = 'clay', innerFrame = true}: {
  tone?: GameSurfaceTone; innerFrame?: boolean;
}) {
  const textureId = useId();
  return <svg className="game-dialog-frame game-dialog-panel-artwork" viewBox="0 0 717 539"
    preserveAspectRatio="none" aria-hidden="true" focusable="false">
    <GameSurfaceTexture id={textureId} tone={tone}/>
    <use href={imageResourceUrl('/ui/dialog/panel.svg#cloth')} fill={`url(#${textureId})`} stroke="#394818"
      strokeWidth="1.8" strokeLinejoin="round"/>
    {innerFrame && <use href={imageResourceUrl('/ui/dialog/panel.svg#inner-frame')}/>}
    <use href={imageResourceUrl('/ui/dialog/panel.svg#edge-marks')}/>
  </svg>;
}
