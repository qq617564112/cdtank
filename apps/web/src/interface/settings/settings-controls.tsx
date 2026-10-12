import {imageResourceUrl} from '../../assets/image-cache';
import type {ComponentPropsWithoutRef} from 'react';
import {useButtonInteraction} from '../resources/button-interaction';

interface SettingsChoiceProps extends ComponentPropsWithoutRef<'button'> {
  kind: 'checkbox' | 'radio';
  checked?: boolean;
}

/** Display choices keep the shared pointer and keyboard interaction. */
export function SettingsChoice({kind, checked = false, className = '', children,
  ...props}: SettingsChoiceProps) {
  const {element, buttonProps, state} = useButtonInteraction(props);
  return <button {...buttonProps} ref={element}
    className={`settings-option settings-option-${kind} ${className}`}
    role={kind === 'checkbox' ? 'checkbox' : undefined}
    aria-checked={kind === 'checkbox' ? checked : undefined}
    aria-pressed={kind === 'radio' ? checked : undefined}
    data-settings-checked={String(checked)} data-source-button-state={state}
    data-settings-marked={String(checked || (kind === 'radio' && state === 'Pushed'))}>
    <span className="settings-option-mark" aria-hidden="true">
      {kind === 'checkbox' && checked ? <span className="settings-checkbox-glyph">√</span> : null}
    </span>
    <span className="settings-option-label">{children}</span>
  </button>;
}

/** Key bindings capture physical keys while keeping a native, focusable input. */
export function SettingsKeyField({style, className = '', active, ...props}:
  ComponentPropsWithoutRef<'input'> & {active: boolean}) {
  return <span className="settings-key-field" style={style} data-settings-capturing={active ? '' : undefined}>
    <input {...props} readOnly type="text" className={`settings-key ${className}`}/>
  </span>;
}

interface SettingsAdjustmentProps extends Omit<ComponentPropsWithoutRef<'input'>,
  'type' | 'step' | 'min' | 'max' | 'value' | 'onChange'> {
  icon: string;
  label: string;
  min?: number;
  max?: number;
  step?: number;
  valueText?: string;
  value: number;
  onValueChange: (value: number) => void;
}

/** Pointer and keyboard input share the same range and step. */
export function SettingsAdjustment({icon, label, min = 0, max = 1, step, value, valueText, onValueChange,
  className = '', onKeyDown, ...props}: SettingsAdjustmentProps) {
  const text = valueText ?? `${Math.round(value * 100)}%`;
  return <label className="settings-adjustment">
    <img className="settings-adjustment-icon" src={imageResourceUrl(icon)} alt="" aria-hidden="true" draggable={false}/>
    <input {...props} type="range" min={min} max={max} step={step ?? 'any'} value={value}
      className={`settings-volume ${className}`} aria-label={label}
      aria-valuetext={text}
      onChange={event => onValueChange(event.currentTarget.valueAsNumber)}
      onKeyDown={event => {
        onKeyDown?.(event);
        if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
        const increment = step ?? (max - min) / 100;
        const changes: Record<string, number> = {
          ArrowLeft: -increment, ArrowDown: -increment, ArrowRight: increment, ArrowUp: increment,
          PageDown: -increment * (step ? 1 : 10), PageUp: increment * (step ? 1 : 10),
        };
        const next = event.key === 'Home' ? min : event.key === 'End' ? max
          : changes[event.key] === undefined ? undefined : value + changes[event.key];
        if (next === undefined) return;
        event.preventDefault();
        onValueChange(Math.max(min, Math.min(max, next)));
      }}/>
    <span className="settings-art-label settings-adjustment-value" aria-hidden="true">{text}</span>
  </label>;
}
