import {useLayoutEffect, useRef} from 'react';
import type {BattleHud} from './battle-hud';
import {hudItemCooldown, type HudItemSlot} from './hud-item-slots';

/** Continuous feedback owns two leaves; icons and input bindings stay in React. */
export function HudItemCooldown({hud, binding, mobile = false}: {
  hud: BattleHud; binding: HudItemSlot; mobile?: boolean;
}) {
  const overlay = useRef<HTMLSpanElement>(null);
  const remaining = useRef<HTMLSpanElement>(null);
  const {slot, item} = binding;
  const hasItem = binding.itemTableId !== undefined;
  const read = () => {
    if (!hasItem) return;
    const combat = hud.getCombatSnapshot();
    const selected = slot <= 4 && slot === (combat.selectedAmmoSlot === 0 ? 1 : combat.selectedAmmoSlot);
    return hudItemCooldown(combat, slot, item, selected, hud.getReloadSnapshot().fraction);
  };
  const initial = read();
  useLayoutEffect(() => {
    const update = (): void => {
      const state = read();
      const shade = overlay.current, label = remaining.current;
      if (!shade || !label) return;
      shade.style.display = state ? '' : 'none';
      label.style.display = state ? '' : 'none';
      const fraction = state?.cooldownFraction;
      if (fraction !== undefined) shade.style.clipPath = `inset(${(1 - fraction) * 100}% 0 0 0)`;
      if (state?.cooldownBinding) shade.dataset.itemCooldownBinding = state.cooldownBinding;
      else delete shade.dataset.itemCooldownBinding;
      const seconds = state?.remainingSeconds;
      const text = seconds === undefined ? '' : String(Math.ceil(seconds));
      if (label.textContent !== text) label.textContent = text;
      if (!mobile) {
        if (fraction === undefined) delete shade.dataset.itemCooldownFraction;
        else shade.dataset.itemCooldownFraction = String(fraction);
        if (seconds === undefined) delete shade.dataset.itemRemainingSeconds;
        else shade.dataset.itemRemainingSeconds = String(seconds);
        const title = seconds === undefined ? item?.name ?? ''
          : `${state?.cooldownBinding === 'effect-expiry' ? '效果剩余' : '装填剩余'} ${Math.ceil(seconds)} 秒`;
        const button = shade.parentElement;
        if (button && button.title !== title) button.title = title;
      }
    };
    const stopCombat = hud.subscribeCombat(update);
    const stopReload = hud.subscribeReload(update);
    update();
    return () => {stopCombat(); stopReload();};
  });
  return <>
    <span ref={overlay} className={mobile ? 'mobile-battle-item-cooldown' : 'hud-item-cooldown'}
      data-source-control={mobile ? undefined : `lengque${slot}`}
      data-item-cooldown-binding={initial?.cooldownBinding}
      data-item-cooldown-fraction={mobile ? undefined : initial?.cooldownFraction}
      data-item-remaining-seconds={mobile ? undefined : initial?.remainingSeconds}
      style={{display: initial ? undefined : 'none', clipPath: initial
        ? `inset(${(1 - initial.cooldownFraction!) * 100}% 0 0 0)` : undefined}}
      aria-hidden={mobile ? undefined : true}/>
    <span ref={remaining} className={mobile ? 'mobile-battle-item-remaining' : 'hud-item-remaining'}
      style={{display: initial ? undefined : 'none'}} aria-hidden={mobile ? undefined : true}>
      {initial?.remainingSeconds === undefined ? '' : Math.ceil(initial.remainingSeconds)}
    </span>
  </>;
}
