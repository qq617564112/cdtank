import {useEffect, useRef, useState, type RefObject} from 'react';
import {SourceButton} from '../resources/source-button';
import {SourceStaticImage} from '../resources/source-static-image';
import {HomeSourceLayout, type HomeSourceUi} from '../resources/source-ui-layout';
import {sourceProps} from '../resources/source-ui-props';
import {useSourceUi} from '../lobby/source-react';
import {SOURCE_CHARACTER_DECORATIONS, SOURCE_CHARACTER_KEYS} from './source-character-keyboard-map';
import './source-character-keyboard.css';

export interface SourceCharacterKeyboardProps {
  open: boolean;
  busy: boolean;
  passwordInput: RefObject<HTMLInputElement | null>;
  onCharacter: (value: string) => void;
  onClose: (returnToPassword: boolean) => void;
}

/** Source keyboard mounts on password activation; its retry stays local to the panel. */
export function SourceCharacterKeyboard({open, busy, passwordInput, onCharacter, onClose}: SourceCharacterKeyboardProps) {
  const [attempt, setAttempt] = useState(0);
  if (!open) return null;
  return <SourceCharacterKeyboardSession key={attempt} retried={attempt > 0} busy={busy}
    passwordInput={passwordInput} onCharacter={onCharacter} onClose={onClose}
    onRetry={() => setAttempt(value => value + 1)}/>;
}

function SourceCharacterKeyboardSession({busy, passwordInput, onCharacter, onClose, onRetry, retried}: {
  busy: boolean; passwordInput: RefObject<HTMLInputElement | null>; onCharacter: (value: string) => void;
  onClose: (returnToPassword: boolean) => void; onRetry: () => void; retried: boolean;
}) {
  const [shift, setShift] = useState(false), [caps, setCaps] = useState(false);
  const container = useRef<HTMLDivElement>(null), retryButton = useRef<HTMLButtonElement>(null);
  const {ui, error} = useSourceUi(true, ['keyboard.xml']);
  // A failed load parks focus on retry; a successful retry returns it to the source target.
  useEffect(() => {if (!ui && error) retryButton.current?.focus();}, [ui, error]);
  useEffect(() => {
    const element = passwordInput.current;
    if (retried && ui && element && !element.disabled) element.focus({preventScroll: true});
  }, [retried, ui, passwordInput]);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {if (event.key === 'Escape') {event.preventDefault(); onClose(true);}};
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [onClose]);
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (container.current?.contains(target) || target === passwordInput.current) return;
      onClose(false);
    };
    document.addEventListener('pointerdown', outside, true);
    return () => document.removeEventListener('pointerdown', outside, true);
  }, [onClose, passwordInput]);
  const layout = ui ? new HomeSourceLayout(ui, 'keyboard.xml') : undefined;
  const insert = (value: string) => {setShift(false); onCharacter(value);};
  return <div ref={container} className="source-keyboard" data-busy={String(busy)}
    onBlur={event => {
      const next = event.relatedTarget;
      if (next instanceof Node && (container.current?.contains(next) || next === passwordInput.current)) return;
      onClose(false);
    }}>
    {!ui && <p className="source-keyboard-status" role="status" aria-live="polite">
      <span>{error ? '键盘资源载入失败' : '正在载入键盘…'}</span>
      {error && <button ref={retryButton} type="button" className="source-keyboard-retry" onClick={onRetry}>重试</button>}
    </p>}
    {ui && layout && <>
      <SourceStaticImage ui={ui} layout={layout} suffix="keyboard.xml" name="all"
        reference={layout.control('all').properties.Image} className="source-keyboard-frame" aria-hidden="true"/>
      {SOURCE_CHARACTER_DECORATIONS.map(name => <SourceStaticImage key={name} ui={ui} layout={layout}
        suffix="keyboard.xml" name={name} reference={layout.control(name).properties.Image}
        className="source-keyboard-picture" aria-hidden="true"/>)}
      {SOURCE_CHARACTER_KEYS.map(key => <SourceButton key={key.control} ui={ui} layout={layout}
        suffix="keyboard.xml" source={key.control} className="source-keyboard-key" data-source-key={key.control}
        aria-label={key.upper === key.lower ? key.lower : `${key.lower} ${key.upper}`}
        aria-disabled={busy} tabIndex={busy ? -1 : undefined}
        onClick={() => {if (!busy) insert(shift !== caps ? key.upper : key.lower);}}/>)}
      <KeyboardCheck ui={ui} layout={layout} name="shift" pressed={shift} busy={busy}
        onToggle={() => setShift(value => !value)}/>
      <KeyboardCheck ui={ui} layout={layout} name="caps" pressed={caps} busy={busy}
        onToggle={() => setCaps(value => !value)}/>
    </>}
  </div>;
}

/** Source checkbox keeps its normal/hover plate plus a separate selected mark draw. */
function KeyboardCheck({ui, layout, name, pressed, busy, onToggle}: {
  ui: HomeSourceUi; layout: HomeSourceLayout; name: string; pressed: boolean; busy: boolean; onToggle: () => void;
}) {
  const [hover, setHover] = useState(false);
  const properties = layout.control(name).properties;
  const place = sourceProps(ui, layout, 'keyboard.xml', name);
  const plate = sourceProps(ui, layout, 'keyboard.xml', name,
    hover && !busy ? properties.HoverImage : properties.NormalImage);
  const mark = sourceProps(ui, layout, 'keyboard.xml', name, properties.CheckMarkImage);
  return <button type="button" className="source-keyboard-check" style={place.style}
    data-source-control={name} aria-pressed={pressed} aria-label={name === 'shift' ? 'Shift' : 'Caps'}
    disabled={busy}
    onPointerEnter={() => setHover(true)} onPointerLeave={() => setHover(false)} onBlur={() => setHover(false)}
    onClick={() => {if (!busy) onToggle();}}>
    <i aria-hidden="true" data-source-asset={plate['data-source-asset']}
      style={{backgroundImage: plate.style.backgroundImage}}/>
    {pressed && <i aria-hidden="true" data-source-checkmark="" data-source-asset={mark['data-source-asset']}
      style={{backgroundImage: mark.style.backgroundImage}}/>}
  </button>;
}
