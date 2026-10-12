import {useCallback, useEffect, useRef, useState, type ComponentPropsWithoutRef} from 'react';

/** The source ButtonBase selects hover when pointer-inside differs from captured push. */
export function useButtonInteraction({disabled = false, onClick, onPointerEnter, onPointerMove,
  onPointerLeave, onPointerDown, onPointerUp, onPointerCancel, onLostPointerCapture,
  onKeyDown, onKeyUp, onBlur, ...attributes}: ComponentPropsWithoutRef<'button'>) {
  const element = useRef<HTMLButtonElement>(null);
  const pointer = useRef<number | null>(null), releasedInside = useRef(true);
  const [view, setView] = useState({inside: false, held: false, keyHeld: false});
  const cancel = useCallback(() => {
    const id = pointer.current;
    pointer.current = null;
    if (id !== null && element.current?.hasPointerCapture(id)) element.current.releasePointerCapture(id);
    setView({inside: false, held: false, keyHeld: false});
  }, []);
  useEffect(() => {
    window.addEventListener('blur', cancel);
    return () => {
      window.removeEventListener('blur', cancel);
      const id = pointer.current;
      pointer.current = null;
      if (id !== null && element.current?.hasPointerCapture(id)) element.current.releasePointerCapture(id);
    };
  }, [cancel]);
  useEffect(() => {if (disabled) cancel();}, [disabled, cancel]);
  const inside = (x: number, y: number) => {
    const rect = element.current!.getBoundingClientRect();
    return x >= rect.left && x < rect.right && y >= rect.top && y < rect.bottom;
  };
  const pushed = !disabled && (view.held || view.keyHeld);
  const hovering = !disabled && !view.keyHeld && (view.inside !== pushed);
  const state = hovering ? 'Hover' : pushed ? 'Pushed' : disabled ? 'Disabled' : 'Normal';
  const buttonProps: ComponentPropsWithoutRef<'button'> = {
    type: 'button', ...attributes, disabled,
    onPointerEnter: event => {
      if (!disabled) setView(value => ({...value, inside: inside(event.clientX, event.clientY)}));
      onPointerEnter?.(event);
    },
    onPointerMove: event => {
      if (!disabled) setView(value => ({...value, inside: inside(event.clientX, event.clientY)}));
      onPointerMove?.(event);
    },
    onPointerLeave: event => {
      if (!disabled) setView(value => ({...value, inside: false}));
      onPointerLeave?.(event);
    },
    onPointerDown: event => {
      if (!disabled && event.button === 0) {
        pointer.current = event.pointerId;
        releasedInside.current = false;
        event.currentTarget.setPointerCapture(event.pointerId);
        setView({inside: true, held: true, keyHeld: false});
      }
      onPointerDown?.(event);
    },
    onPointerUp: event => {
      if (pointer.current === event.pointerId) {
        const hit = inside(event.clientX, event.clientY);
        releasedInside.current = hit;
        pointer.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        setView({inside: hit, held: false, keyHeld: false});
      }
      onPointerUp?.(event);
    },
    onPointerCancel: event => {cancel(); onPointerCancel?.(event);},
    onLostPointerCapture: event => {if (pointer.current !== null) cancel(); onLostPointerCapture?.(event);},
    onKeyDown: event => {
      if (!disabled && (event.key === ' ' || event.key === 'Enter')) setView(value => ({...value, keyHeld: true}));
      onKeyDown?.(event);
    },
    onKeyUp: event => {
      if (event.key === ' ' || event.key === 'Enter') setView(value => ({...value, keyHeld: false}));
      onKeyUp?.(event);
    },
    onBlur: event => {cancel(); onBlur?.(event);},
    onClick: event => {
      if (!disabled && (event.detail === 0 || releasedInside.current)) onClick?.(event);
      else event.preventDefault();
    },
  };
  return {element, buttonProps, state, pushed, hovering};
}
