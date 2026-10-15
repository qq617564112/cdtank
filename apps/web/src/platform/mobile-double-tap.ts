interface Tap {
  target: HTMLElement;
  time: number;
  x: number;
  y: number;
}

/** Touch pairs activate the same marked controls as mouse double clicks. */
export function enableMobileDoubleTap(): () => void {
  const selector = '[data-touch-double-click]';
  let press: (Tap & {pointerId: number}) | undefined;
  let previous: Tap | undefined;
  let touchInput = false;
  const control = (target: EventTarget | null) => target instanceof Element
    ? target.closest<HTMLElement>(selector) : null;
  const reset = () => {press = undefined; previous = undefined;};
  const pointerDown = (event: PointerEvent) => {
    touchInput = event.pointerType === 'touch';
    const target = control(event.target);
    if (!touchInput || !event.isPrimary || !target || target.matches(':disabled')) {
      reset();
      return;
    }
    press = {target, pointerId: event.pointerId, time: event.timeStamp, x: event.clientX, y: event.clientY};
  };
  const pointerMove = (event: PointerEvent) => {
    if (press?.pointerId === event.pointerId
      && Math.hypot(event.clientX - press.x, event.clientY - press.y) > 12) reset();
  };
  const click = (event: MouseEvent) => {
    if (!event.isTrusted || !press) return;
    const tap = press;
    press = undefined;
    if (control(event.target) !== tap.target || event.timeStamp - tap.time > 500) {
      previous = undefined;
      return;
    }
    if (previous?.target === tap.target && event.timeStamp - previous.time <= 400
      && Math.hypot(tap.x - previous.x, tap.y - previous.y) <= 24) {
      previous = undefined;
      tap.target.dispatchEvent(new MouseEvent('dblclick', {
        bubbles: true, cancelable: true, view: window, detail: 2,
        clientX: event.clientX, clientY: event.clientY,
      }));
    } else previous = {...tap, time: event.timeStamp};
  };
  const doubleClick = (event: MouseEvent) => {
    if (touchInput && event.isTrusted && control(event.target)) event.stopImmediatePropagation();
  };
  const keyDown = () => {touchInput = false; reset();};
  document.addEventListener('pointerdown', pointerDown, true);
  document.addEventListener('pointermove', pointerMove, true);
  document.addEventListener('pointercancel', reset, true);
  document.addEventListener('click', click);
  document.addEventListener('dblclick', doubleClick, true);
  document.addEventListener('keydown', keyDown, true);
  window.addEventListener('blur', reset);
  return () => {
    document.removeEventListener('pointerdown', pointerDown, true);
    document.removeEventListener('pointermove', pointerMove, true);
    document.removeEventListener('pointercancel', reset, true);
    document.removeEventListener('click', click);
    document.removeEventListener('dblclick', doubleClick, true);
    document.removeEventListener('keydown', keyDown, true);
    window.removeEventListener('blur', reset);
  };
}
