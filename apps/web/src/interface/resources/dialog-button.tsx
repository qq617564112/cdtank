import {imageResourceUrl} from '../../assets/image-cache';
import {useImperativeHandle, type ComponentPropsWithRef, type ReactNode} from 'react';
import {useButtonInteraction} from './button-interaction';
import './dialog-button.css';

export type DialogButtonKind = 'action' | 'back' | 'close';

/** Names identify the shared dialog button family in the public UI directory. */
export function dialogButtonPreset(reference?: string): {kind: DialogButtonKind; label?: string} | undefined {
  const name = reference?.split('\\').at(-1);
  if (name === 'xiaoquxiaoanniu2.tga') return {kind: 'close'};
  if (name === 'queding2.tga') return {kind: 'action', label: '确定'};
  if (name === 'quxiao2.tga') return {kind: 'action', label: '取消'};
  if (name === 'yushezhi_2.tga') return {kind: 'action', label: '预设值'};
  return undefined;
}

export interface DialogButtonProps extends ComponentPropsWithRef<'button'> {
  kind?: DialogButtonKind;
}

export function DialogButton({kind = 'action', className = '', children, ref, ...props}: DialogButtonProps) {
  const {element, buttonProps, state, pushed, hovering} = useButtonInteraction(props);
  useImperativeHandle(ref, () => element.current!);
  return <button {...buttonProps} ref={element} className={`game-dialog-button ${className}`}
    aria-label={props['aria-label'] ?? (kind === 'close' ? '关闭' : undefined)}
    data-dialog-button={kind} data-source-button-state={state}
    data-source-pushed={String(pushed)} data-source-hovering={String(hovering)}>
    <DialogButtonArtwork kind={kind}>{children}</DialogButtonArtwork>
  </button>;
}

/** Artwork is shared by source-layout buttons and freely composed dialogs. */
export function DialogButtonArtwork({kind, children}: {kind: DialogButtonKind; children?: ReactNode}) {
  if (kind === 'close') return <>
    {(['normal', 'hover', 'pushed'] as const).map(state => <img key={state}
      className={`game-dialog-button-art game-dialog-close-${state}`} width={37} height={37}
      src={imageResourceUrl(`/ui/dialog/button-close-${state}.png`)} alt="" aria-hidden="true" draggable={false}/>)}
  </>;
  const spaced = typeof children === 'string' && Array.from(children).length === 2;
  const label = spaced
    ? Array.from(children).map((letter, index) => <span key={index} className="game-dialog-button-letter">{letter}</span>)
    : children;
  return <>
    {(['normal', 'hover', 'pushed'] as const).map(state => <img key={state}
      className={`game-dialog-button-art game-dialog-action-${state}`} width={kind === 'back' ? 187 : 81}
      height={kind === 'back' ? 41 : 43}
      src={imageResourceUrl(`/ui/dialog/button-${kind}-${state}.svg`)} alt="" aria-hidden="true" draggable={false}/>)}
    <span className="game-dialog-button-label" data-dialog-label-spaced={spaced ? '' : undefined}>
      <span className="game-dialog-button-label-rim" aria-hidden="true">{label}</span>
      <span className="game-dialog-button-label-ink">{label}</span>
    </span>
  </>;
}
