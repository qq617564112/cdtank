import {useCallback, useEffect, useId, useRef, useState, type ComponentPropsWithoutRef,
  type CSSProperties, type ReactNode, type Ref} from 'react';
import {CartoonButtonArtwork, type CartoonButtonShape} from './cartoon-button-artwork';
import './cartoon-controls.css';

export type CartoonButtonTone = 'orange' | 'violet' | 'blue' | 'cyan' | 'red' | 'neutral';

interface CartoonButtonProps extends ComponentPropsWithoutRef<'button'> {
  width: number;
  height?: number;
  shape?: CartoonButtonShape;
  tone?: CartoonButtonTone;
  gradient?: boolean;
}

/** Fixed-size end caps share the original normal, hover and pushed states. */
export function CartoonButton({width, height = 41, shape = 'pill', tone = 'orange', gradient = false, className = '', style, children,
  type = 'button', disabled = false, onClick, onPointerEnter, onPointerMove,
  onPointerLeave, onPointerDown, onPointerUp, onPointerCancel, onLostPointerCapture,
  onKeyDown, onKeyUp, onBlur, ...props}: CartoonButtonProps) {
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
    return () => {window.removeEventListener('blur', cancel);};
  }, [cancel]);
  useEffect(() => {if (disabled) cancel();}, [disabled, cancel]);
  const inside = (x: number, y: number) => {
    const rect = element.current!.getBoundingClientRect();
    return x >= rect.left && x < rect.right && y >= rect.top && y < rect.bottom;
  };
  const pushed = !disabled && (view.held || view.keyHeld);
  const hovering = !disabled && !view.keyHeld && (view.inside !== pushed);
  const state = disabled ? 'disabled' : hovering ? 'hover' : pushed ? 'pressed' : 'normal';
  return <button {...props} ref={element} type={type} disabled={disabled}
    className={`cartoon-button ${className}`} data-cartoon-button-state={state}
    data-cartoon-button-shape={shape} data-cartoon-button-tone={tone}
    style={{width, height, '--cartoon-button-pressed-scale': (width - (width < 50 ? 2 : width < 100 ? 8 : 15)) / width,
      ...style} as CSSProperties}
    onPointerEnter={event => {
      if (!disabled) setView(value => ({...value, inside: inside(event.clientX, event.clientY)}));
      onPointerEnter?.(event);
    }} onPointerMove={event => {
      if (!disabled) setView(value => ({...value, inside: inside(event.clientX, event.clientY)}));
      onPointerMove?.(event);
    }} onPointerLeave={event => {
      setView(value => ({...value, inside: false}));
      onPointerLeave?.(event);
    }} onPointerDown={event => {
      if (!disabled && event.button === 0) {
        pointer.current = event.pointerId;
        releasedInside.current = false;
        event.currentTarget.setPointerCapture(event.pointerId);
        setView({inside: true, held: true, keyHeld: false});
      }
      onPointerDown?.(event);
    }} onPointerUp={event => {
      if (pointer.current === event.pointerId) {
        const hit = inside(event.clientX, event.clientY);
        releasedInside.current = hit;
        pointer.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        setView({inside: hit, held: false, keyHeld: false});
      }
      onPointerUp?.(event);
    }} onPointerCancel={event => {cancel(); onPointerCancel?.(event);}}
    onLostPointerCapture={event => {if (pointer.current !== null) cancel(); onLostPointerCapture?.(event);}}
    onKeyDown={event => {
      if (!disabled && (event.key === ' ' || event.key === 'Enter')) setView(value => ({...value, keyHeld: true}));
      onKeyDown?.(event);
    }} onKeyUp={event => {
      if (event.key === ' ' || event.key === 'Enter') setView(value => ({...value, keyHeld: false}));
      onKeyUp?.(event);
    }} onBlur={event => {cancel(); onBlur?.(event);}}
    onClick={event => {
      if (event.detail !== 0 && !releasedInside.current) {event.preventDefault(); return;}
      onClick?.(event);
    }}>
    <CartoonButtonArtwork width={width} shape={shape} gradient={gradient}/>
    {children && <span className="cartoon-control-label">{children}</span>}
  </button>;
}

interface CartoonInputProps extends ComponentPropsWithoutRef<'input'> {
  width: number;
  height: number;
  shape?: 'account' | 'password';
  inputStyle?: CSSProperties;
  ref?: Ref<HTMLInputElement>;
}

/** The frame stays vector while the editable value remains native HTML text. */
export function CartoonInput({width, height, shape = 'account', className = '', style,
  inputStyle, ref, ...props}: CartoonInputProps) {
  const filter = useId();
  const edge = shape === 'account'
    ? 'M2 7 L12 7 L24 1 L31 3 L57 2 L82 3 L97 1 L104 3 L128 2 L151 3 L174 1 L178 5 L194 3 L187 8 L188 24 L193 28 L177 27 L172 30 L149 28 L122 29 L100 28 L83 30 L61 28 L44 29 L16 29 L15 26 L2 28 L6 21 Z'
    : 'M7 2 L24 3 L39 1 L62 2 L82 1 L100 3 L124 2 L148 2 L169 2 L172 6 L188 5 L183 11 L189 19 L184 20 L187 28 L171 27 L165 32 L158 28 L124 29 L98 28 L82 30 L65 29 L52 30 L43 27 L34 28 L35 33 L26 28 L12 30 L6 26 L2 17 L3 8 Z';
  return <span className={`cartoon-input ${className}`} style={{width, height, ...style}}>
    <svg className="cartoon-control-art" viewBox={`0 0 ${shape === 'account' ? 196 : 189} ${shape === 'account' ? 31 : 34}`}
      preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <defs>
        <filter id={filter} x="-5%" y="-20%" width="110%" height="140%" colorInterpolationFilters="sRGB">
          <feGaussianBlur in="SourceAlpha" stdDeviation="1.1" result="soft-edge"/>
          <feComposite in="SourceAlpha" in2="soft-edge" operator="out" result="inner-edge"/>
          <feFlood floodColor="#825900" floodOpacity=".85"/>
          <feComposite in2="inner-edge" operator="in" result="edge-shade"/>
          <feOffset in="soft-edge" dx="0" dy="2" result="lower-edge"/>
          <feComposite in="SourceAlpha" in2="lower-edge" operator="out" result="top-edge"/>
          <feFlood floodColor="#9a6900" floodOpacity=".8"/>
          <feComposite in2="top-edge" operator="in" result="top-shade"/>
          <feMerge>
            <feMergeNode in="SourceGraphic"/>
            <feMergeNode in="edge-shade"/>
            <feMergeNode in="top-shade"/>
          </feMerge>
        </filter>
      </defs>
      <path d={edge} fill="#ffa800" filter={`url(#${filter})`}/>
      <path d={edge} fill="none" stroke="#a7812d" strokeWidth="1.3"/>
    </svg>
    <input {...props} ref={ref} className="cartoon-input-value" style={inputStyle}/>
  </span>;
}

interface CartoonCheckboxProps extends Omit<ComponentPropsWithoutRef<'input'>, 'type' | 'children'> {
  children: ReactNode;
}

export function CartoonCheckbox({children, className = '', style, ...props}: CartoonCheckboxProps) {
  const gradient = useId();
  return <label className={`cartoon-checkbox ${className}`} style={style}>
    <input {...props} type="checkbox"/>
    <svg className="cartoon-checkbox-art" viewBox="0 0 37 37" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id={gradient} cx="50%" cy="51%" r="52%">
          <stop offset="0" stopColor="#ffa800"/>
          <stop offset=".72" stopColor="#ffa800"/>
          <stop offset=".88" stopColor="#df9700"/>
          <stop offset="1" stopColor="#a37106"/>
        </radialGradient>
      </defs>
      <ellipse cx="17" cy="19.5" rx="16" ry="16.5" fill={`url(#${gradient})`} stroke="#b49548" strokeWidth="1.2"/>
      <g className="cartoon-checkbox-tick">
        <path d="M3 20 L10 16 L15 22 L31 3 L33.5 3 L33.5 14
          L30 14 L17 31 L16 33 L14 33 L4 24 Z" fill="#122540"/>
        <path d="M3 20 L10 16 L15 22 L31 3 L33.5 3 L33.5 14
          L31.5 14 L31.5 4 L15 30 L5 23 Z" fill="#355674"/>
        <path d="M3 19 L10 15 L15 22 L30 2 L32 1 L33 2 L33 12
          L30 12 L15 30 L13 28 L4 21 Z" fill="#0665ff"/>
        <path d="M30 2 L32 1 L33 2 L33 4 L31 4 L31 3 L29 4 Z" fill="#79b1ff"/>
      </g>
    </svg>
    <span className="cartoon-control-label">{children}</span>
  </label>;
}
