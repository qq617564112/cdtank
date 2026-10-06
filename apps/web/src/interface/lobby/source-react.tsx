import {useEffect, useRef, useState, type ComponentPropsWithoutRef} from 'react';
import type {HomeSourceLayout, HomeSourceUi} from '../resources/source-ui-layout';
import {sourceProps} from '../resources/source-ui-props';

export {sourceProps} from '../resources/source-ui-props';

interface SourceButtonProps extends ComponentPropsWithoutRef<'button'> {
  ui: HomeSourceUi; layout: HomeSourceLayout; suffix: string; source: string;
  selected?: boolean; selectedImage?: string; offsetX?: number; offsetY?: number;
}
export function SourceButton({ui, layout, suffix, source, selected = false,
  selectedImage = 'CheckMarkImage', offsetX = 0, offsetY = 0, ...props}: SourceButtonProps) {
  const [hover, setHover] = useState(false), [pressed, setPressed] = useState(false);
  const images = layout.control(source).properties;
  const property = selected ? selectedImage : props.disabled && images.DisabledImage ? 'DisabledImage'
    : pressed && !props.disabled ? 'PushedImage' : hover && !props.disabled ? 'HoverImage' : 'NormalImage';
  return <button type="button" {...sourceProps(ui, layout, suffix, source, images[property] || images.NormalImage, offsetX, offsetY)}
    {...props} onMouseEnter={() => setHover(true)} onMouseLeave={() => {setHover(false); setPressed(false);}}
    onMouseDown={() => setPressed(true)} onMouseUp={() => setPressed(false)}/>;
}

export function useSourceUi(open: boolean, suffixes: readonly string[]) {
  const [ui, setUi] = useState<HomeSourceUi>(), [error, setError] = useState('');
  const suffixKey = suffixes.join('|');
  useEffect(() => {
    if (!open || ui) return;
    let active = true;
    setError('');
    void fetch('/ui.json').then(async response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const next = await response.json() as HomeSourceUi;
      for (const suffix of suffixKey.split('|')) if (!next.layouts.some(layout => layout.path.endsWith(suffix))) throw new Error(`布局缺失：${suffix}`);
      if (active) setUi(next);
    }).catch(reason => {if (active) setError(String(reason));});
    return () => {active = false;};
  }, [open, ui, suffixKey]);
  return {ui, error};
}

export function useSourceDialog(open: boolean) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
    return () => {if (dialog.open) dialog.close();};
  }, [open]);
  return ref;
}

export function useSourceScale(width: number, height: number, marginX: number, marginY: number, min: number, max: number) {
  const calculate = () => Math.max(min, Math.min((innerWidth - marginX) / width, (innerHeight - marginY) / height, max));
  const [scale, setScale] = useState(calculate);
  useEffect(() => {
    const resize = () => setScale(calculate());
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [width, height, marginX, marginY, min, max]);
  return {viewport: {width: width * scale, height: height * scale}, stage: {transform: `scale(${scale})`}};
}
