import {imageResourceUrl} from '../../assets/image-cache';
import type {ComponentPropsWithoutRef} from 'react';
import {useButtonInteraction} from '../resources/button-interaction';
import './room-rule-button.css';

export type RoomRule = 'cat-vs-dog' | 'cat-dog-mixed' | 'no-friendly-fire' | 'friendly-fire';

const RULE_LABELS: Record<RoomRule, string> = {
  'cat-vs-dog': '猫狗对抗',
  'cat-dog-mixed': '猫狗混编',
  'no-friendly-fire': '不伤友军',
  'friendly-fire': '敌我不分',
};

interface RoomRuleButtonProps extends ComponentPropsWithoutRef<'button'> {
  rule: RoomRule;
  selected: boolean;
  readOnly?: boolean;
}

/** Mode indicators and friendly-fire controls share original illustrated states. */
export function RoomRuleButton({rule, selected, readOnly = false, className = '',
  disabled = false, ...props}: RoomRuleButtonProps) {
  const {element, buttonProps, state} = useButtonInteraction({...props, disabled: disabled || readOnly});
  return <button {...buttonProps} ref={element} className={`room-rule-button ${className}`}
    aria-label={props['aria-label'] ?? RULE_LABELS[rule]} aria-pressed={selected}
    data-room-rule={rule} data-rule-selected={selected} data-rule-muted={disabled && !readOnly}
    data-source-button-state={state}>
    {(['normal', 'selected'] as const).map(variant => <img key={variant}
      className={`room-rule-art room-rule-art-${variant}`} src={imageResourceUrl(`/ui/room-create/${rule}-${variant}.webp`)}
      alt="" aria-hidden="true" draggable={false}/>)}
    <span className="room-rule-label">{RULE_LABELS[rule]}</span>
  </button>;
}
