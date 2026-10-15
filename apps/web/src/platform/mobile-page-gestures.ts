import {enableMobileDoubleTap} from './mobile-double-tap';
import './mobile-page-gestures.css';

/** Keep browser gestures from resizing or moving the mobile game viewport. */
export function lockMobilePageGestures(): () => void {
  const restoreDoubleTap = enableMobileDoubleTap();
  const viewport = document.querySelector<HTMLMetaElement>('meta[name="viewport"]')!;
  const content = viewport.content;
  viewport.content = `${content}, minimum-scale=1, maximum-scale=1, user-scalable=no`;
  const preventZoom = (event: Event) => {
    if (event.cancelable) event.preventDefault();
  };
  const touchMove = (event: TouchEvent) => {
    if (event.touches.length > 1) preventZoom(event);
  };
  const wheel = (event: WheelEvent) => {
    if (event.ctrlKey) preventZoom(event);
  };
  document.addEventListener('gesturestart', preventZoom, {passive: false});
  document.addEventListener('gesturechange', preventZoom, {passive: false});
  document.addEventListener('touchmove', touchMove, {passive: false});
  document.addEventListener('wheel', wheel, {passive: false});
  return () => {
    restoreDoubleTap();
    viewport.content = content;
    document.removeEventListener('gesturestart', preventZoom);
    document.removeEventListener('gesturechange', preventZoom);
    document.removeEventListener('touchmove', touchMove);
    document.removeEventListener('wheel', wheel);
  };
}
