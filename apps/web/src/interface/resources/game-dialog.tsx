import {imageResourceUrl} from '../../assets/image-cache';
import {useContext, type ComponentPropsWithRef, type ComponentPropsWithoutRef,
  type CSSProperties} from 'react';
import {createPortal} from 'react-dom';
import {GameDialogPanelArtwork} from './game-dialog-panel-artwork';
import type {GameSurfaceTone} from './game-surface-texture';
import {SourceImageScale} from './source-static-image';
import './game-dialog.css';

interface GameDialogProps extends ComponentPropsWithRef<'dialog'> {
  width: number;
  height?: number;
  uiScale?: number;
  stageClassName?: string;
}

/** Dialog dimensions resize the content; controls share the surrounding UI scale. */
export function GameDialog({width, height, uiScale, stageClassName = '', className = '', style,
  children, ...props}: GameDialogProps) {
  const inheritedScale = useContext(SourceImageScale);
  const scale = uiScale ?? inheritedScale;
  return createPortal(<dialog {...props} className={`game-dialog ${className}`}
    style={{...style, width, height: height ?? 'fit-content', zoom: scale,
      '--game-dialog-ui-scale': scale} as CSSProperties}>
    <div className={`game-dialog-stage ${stageClassName}`}
      style={{height: height === undefined ? 'auto' : '100%'}}>{children}</div>
  </dialog>, document.body);
}

/** Fullscreen page shells share the native dialog's backdrop styling. */
export function GameDialogBackdrop() {
  return <div className="game-dialog-backdrop" aria-hidden="true"/>;
}

export function GameDialogTopbar({className = '', children, ...props}: ComponentPropsWithoutRef<'div'>) {
  return <div {...props} className={`game-dialog-topbar ${className}`}>
    <img className="game-dialog-frame" src={imageResourceUrl('/ui/dialog/topbar.svg')} alt="" aria-hidden="true" draggable={false}/>
    {children}
  </div>;
}

export function GameDialogTitle({as: Heading = 'h2', className = '', ...props}:
  ComponentPropsWithoutRef<'h2'> & {as?: 'h1' | 'h2'}) {
  return <Heading {...props} className={`game-dialog-title ${className}`}/>;
}

export function GameDialogPanel({className = '', children, tone, innerFrame, ...props}:
  ComponentPropsWithoutRef<'div'> & {tone?: GameSurfaceTone; innerFrame?: boolean}) {
  return <div {...props} className={`game-dialog-panel ${className}`}>
    <GameDialogPanelArtwork tone={tone} innerFrame={innerFrame}/>
    {children}
  </div>;
}

export function GameDialogFootbar({className = '', children, ...props}: ComponentPropsWithoutRef<'div'>) {
  return <div {...props} className={`game-dialog-footbar ${className}`}>
    <img className="game-dialog-frame" src={imageResourceUrl('/ui/dialog/footbar.svg')} alt="" aria-hidden="true" draggable={false}/>
    {children}
  </div>;
}
