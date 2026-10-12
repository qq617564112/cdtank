import {imageResourceUrl} from '../../assets/image-cache';
import type {ComponentPropsWithoutRef, CSSProperties} from 'react';
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

/** The red field is CSS; its editable content remains a native input. */
export function SettingsChatField({style, frameStyle, className = '', ...props}:
  ComponentPropsWithoutRef<'input'> & {frameStyle: CSSProperties}) {
  return <span className="settings-chat-field" style={frameStyle}>
    <input {...props} className={`settings-quick-chat ${className}`}
      style={{...style, left: Number(style?.left) - Number(frameStyle.left),
        top: Number(style?.top) - Number(frameStyle.top)}}/>
  </span>;
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
  iconLabel?: string;
  min?: number;
  max?: number;
  value: number;
  onValueChange: (value: number) => void;
}

/** Continuous pointer values pair with explicit keyboard increments. */
export function SettingsAdjustment({icon, label, iconLabel, min = 0, max = 1, value, onValueChange,
  className = '', onKeyDown, ...props}: SettingsAdjustmentProps) {
  return <label className="settings-adjustment">
    <img className="settings-adjustment-icon" src={imageResourceUrl(icon)} alt="" aria-hidden="true" draggable={false}/>
    {iconLabel && <span className="settings-adjustment-icon-label" aria-hidden="true">{iconLabel}</span>}
    <input {...props} type="range" min={min} max={max} step="any" value={value}
      className={`settings-volume ${className}`} aria-label={label}
      aria-valuetext={`${Math.round(value * 100)}%`}
      onChange={event => onValueChange(event.currentTarget.valueAsNumber)}
      onKeyDown={event => {
        onKeyDown?.(event);
        if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
        const increment = (max - min) / 100;
        const changes: Record<string, number> = {
          ArrowLeft: -increment, ArrowDown: -increment, ArrowRight: increment, ArrowUp: increment,
          PageDown: -increment * 10, PageUp: increment * 10,
        };
        const next = event.key === 'Home' ? min : event.key === 'End' ? max
          : changes[event.key] === undefined ? undefined : value + changes[event.key];
        if (next === undefined) return;
        event.preventDefault();
        onValueChange(Math.max(min, Math.min(max, next)));
      }}/>
    <span className="settings-art-label settings-adjustment-max" aria-hidden="true">MAX</span>
  </label>;
}
