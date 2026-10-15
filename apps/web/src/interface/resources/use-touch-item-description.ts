import {useEffect, useRef, type PointerEvent} from 'react';

/** Touch holds reveal descriptions; movement keeps list scrolling available. */
export function useTouchItemDescription<T>(describe?: (entry: T, anchor: HTMLButtonElement) => void) {
  const timer = useRef<number | undefined>(undefined);
  const origin = useRef({x: 0, y: 0});
  const cancel = () => {window.clearTimeout(timer.current); timer.current = undefined;};
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return (entry: T) => ({
    onPointerDown(event: PointerEvent<HTMLButtonElement>) {
      cancel();
      if (event.pointerType !== 'touch' || !describe) return;
      const anchor = event.currentTarget;
      origin.current = {x: event.clientX, y: event.clientY};
      timer.current = window.setTimeout(() => {timer.current = undefined; describe(entry, anchor);}, 500);
    },
    onPointerMove(event: PointerEvent<HTMLButtonElement>) {
      if (Math.abs(event.clientX - origin.current.x) > 10 || Math.abs(event.clientY - origin.current.y) > 10) cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
  });
}
