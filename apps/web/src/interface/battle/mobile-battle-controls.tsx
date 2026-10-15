import {useEffect, useRef, useState, type PointerEvent} from 'react';
import type {BattleTouchInput} from '../../match/battle-input';
import {ImageArtwork} from '../resources/image-artwork';

interface TouchControlProps {
  disabled: boolean;
  onInput: (patch: Partial<BattleTouchInput>) => void;
}

const MOVEMENT_DEAD_ZONE = .2;
const TURRET_DEAD_ZONE = .05;
const JOYSTICK_SIZE = 144;

/** Each floating joystick captures its own pointer and clears only its input axes. */
export function MobileBattleJoystick({disabled, onInput, kind, scale}: TouchControlProps & {
  kind: 'movement' | 'turret'; scale: number;
}) {
  const pointer = useRef<{id: number; type: string; x: number; y: number; radius: number;
    scale: number} | undefined>(undefined);
  const element = useRef<HTMLButtonElement>(null);
  const gestureSequence = useRef(0);
  const movementGesture = useRef<number | undefined>(undefined);
  const [pressed, setPressed] = useState(false);
  const [center, setCenter] = useState({x: 0, y: 0});
  const [position, setPosition] = useState({x: 0, y: 0});
  const stop = () => onInput(kind === 'movement'
    ? {move: 0, turn: 0, direction: undefined, movementGesture: movementGesture.current} : {aim: 0});
  const neutral = () => {
    const id = pointer.current?.id;
    pointer.current = undefined;
    movementGesture.current = undefined;
    setPressed(false);
    setPosition({x: 0, y: 0});
    stop();
    if (id !== undefined && element.current?.hasPointerCapture(id)) element.current.releasePointerCapture(id);
  };
  useEffect(() => {
    const finish = (event: globalThis.PointerEvent) => {
      if (pointer.current?.id === event.pointerId) neutral();
    };
    const recover = () => {
      const id = pointer.current?.id;
      if (id !== undefined && !element.current?.hasPointerCapture(id)) neutral();
    };
    const lifted = (event: TouchEvent) => {
      if (pointer.current?.type === 'touch' && event.touches.length === 0) neutral();
    };
    const visibility = () => {if (document.hidden) neutral();};
    window.addEventListener('pointerup', finish, true);
    window.addEventListener('pointercancel', finish, true);
    window.addEventListener('pointerdown', recover, true);
    window.addEventListener('touchend', lifted, {capture: true, passive: true});
    window.addEventListener('touchcancel', lifted, {capture: true, passive: true});
    window.addEventListener('blur', neutral);
    window.addEventListener('resize', neutral);
    document.addEventListener('visibilitychange', visibility);
    if (disabled) neutral();
    return () => {
      window.removeEventListener('pointerup', finish, true);
      window.removeEventListener('pointercancel', finish, true);
      window.removeEventListener('pointerdown', recover, true);
      window.removeEventListener('touchend', lifted, true);
      window.removeEventListener('touchcancel', lifted, true);
      window.removeEventListener('blur', neutral);
      window.removeEventListener('resize', neutral);
      document.removeEventListener('visibilitychange', visibility);
      neutral();
    };
  }, [disabled, kind, onInput]);
  const move = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = pointer.current;
    if (drag?.id !== event.pointerId || disabled) return;
    const x = (event.clientX - drag.x) / drag.radius;
    const y = (event.clientY - drag.y) / drag.radius;
    if (kind === 'turret') {
      const offset = (event.clientX - drag.x) / drag.scale;
      const distance = Math.abs(offset);
      const travel = drag.radius / drag.scale;
      const deadZone = travel * TURRET_DEAD_ZONE;
      const reach = Math.max(0, Math.min(1, (distance - deadZone) / (travel - deadZone)));
      const speed = reach ** 1.4;
      setPosition({x: speed ? Math.max(-1, Math.min(1, x)) * 30 : 0, y: 0});
      onInput({aim: -Math.sign(offset) * speed});
      return;
    }
    const distance = Math.hypot(x, y);
    if (distance < MOVEMENT_DEAD_ZONE) {
      setPosition({x: 0, y: 0});
      stop();
      return;
    }
    const reach = Math.min(1, distance) / distance;
    const direction = {x: x * reach, y: y * reach};
    setPosition({x: direction.x * 30, y: direction.y * 30});
    onInput({move: 0, turn: 0, direction});
  };
  const release = (event: PointerEvent<HTMLButtonElement>) => {
    if (pointer.current?.id === event.pointerId) neutral();
  };
  return <button ref={element} type="button"
    className={`mobile-battle-joystick-zone mobile-battle-joystick-zone-${kind}`}
    data-mobile-joystick={kind} data-pressed={pressed || undefined} disabled={disabled}
    aria-label={kind === 'movement' ? '按相机方向行驶' : '左右转动炮塔'}
    onPointerDown={event => {
      event.preventDefault(); event.stopPropagation();
      if (disabled || pointer.current !== undefined || event.button !== 0) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      pointer.current = {id: event.pointerId, type: event.pointerType,
        x: event.clientX, y: event.clientY, radius: JOYSTICK_SIZE * scale * .3, scale};
      if (kind === 'movement') movementGesture.current = ++gestureSequence.current;
      event.currentTarget.setPointerCapture(event.pointerId);
      setCenter({x: event.clientX - bounds.left, y: event.clientY - bounds.top});
      setPosition({x: 0, y: 0});
      setPressed(true);
      stop();
    }} onPointerMove={move} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}
    onContextMenu={event => event.preventDefault()}
    onKeyDown={event => {
      event.stopPropagation();
      if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      const bounds = event.currentTarget.getBoundingClientRect();
      const direction = {x: event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0,
        y: event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0};
      setCenter({x: bounds.width / 2, y: bounds.height * .75});
      setPosition({x: direction.x * 30, y: kind === 'movement' ? direction.y * 30 : 0});
      setPressed(true);
      if (kind === 'movement' && movementGesture.current === undefined) {
        movementGesture.current = ++gestureSequence.current;
      }
      onInput(kind === 'movement' ? {move: 0, turn: 0, direction, movementGesture: movementGesture.current}
        : {aim: -direction.x});
    }} onKeyUp={event => {event.stopPropagation(); if (event.key.startsWith('Arrow')) neutral();}} onBlur={neutral}>
    <span className="mobile-battle-stick" hidden={!pressed} data-pressed={pressed || undefined}
      style={{left: center.x, top: center.y}} aria-hidden="true">
      <ImageArtwork className="mobile-battle-stick-base"
        asset={`/ui/battle/mobile/${kind === 'movement' ? 'movement' : 'turret'}-base.webp`}/>
      <ImageArtwork className="mobile-battle-stick-thumb" asset="/ui/battle/mobile/stick-thumb.webp"
        style={{left: `${50 + position.x}%`, top: `${50 + position.y}%`}}/>
    </span>
  </button>;
}

export function MobileBattleFire({disabled, onInput}: TouchControlProps) {
  const pointer = useRef<number | undefined>(undefined);
  const [pressed, setPressed] = useState(false);
  const release = () => {pointer.current = undefined; setPressed(false); onInput({fire: false});};
  useEffect(() => {
    const visibility = () => {if (document.hidden) release();};
    window.addEventListener('blur', release);
    document.addEventListener('visibilitychange', visibility);
    if (disabled) release();
    return () => {
      window.removeEventListener('blur', release);
      document.removeEventListener('visibilitychange', visibility);
      onInput({fire: false});
    };
  }, [disabled, onInput]);
  const finish = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.pointerId !== pointer.current) return;
    release();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  return <button type="button" className="mobile-battle-fire mobile-battle-art-button" aria-label="开火"
    data-mobile-fire="" data-pressed={pressed || undefined} disabled={disabled}
    onPointerDown={event => {
      event.preventDefault(); event.stopPropagation();
      if (disabled || pointer.current !== undefined || event.button !== 0) return;
      pointer.current = event.pointerId; event.currentTarget.setPointerCapture(event.pointerId);
      setPressed(true); onInput({fire: true});
    }} onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish}
    onContextMenu={event => event.preventDefault()} onBlur={release}
    onKeyDown={event => {
      event.stopPropagation();
      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();
        setPressed(true); onInput({fire: true});
      }
    }} onKeyUp={event => {
      event.stopPropagation(); if (event.key === ' ' || event.key === 'Enter') {event.preventDefault(); release();}
    }}>
    <ImageArtwork asset="/ui/battle/mobile/fire-normal.webp"/>
  </button>;
}
