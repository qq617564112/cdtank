import {memo, useEffect, useRef, useState, useSyncExternalStore, type ComponentPropsWithoutRef} from 'react';
import {loadCombatCatalog, preparedCombatCatalog} from '../../content';
import type {CombatCatalog} from '../../../../shared/combat/catalog';
import type {BattleHud, SourceUi} from './battle-hud';
import type {HudItemInventoryStore} from './battle-hud-view';
import {hudItemSlots, sameHudItemSlot, type HudItemSlot} from './hud-item-slots';
import {sourceAsset} from './hud-source-controls';
import {ImageArtwork} from '../resources/image-artwork';
import {GameMessage} from '../resources/game-message';
import {useButtonInteraction} from '../resources/button-interaction';
import {HudItemCooldown} from './hud-item-cooldown';

export const MobileBattleItems = memo(function MobileBattleItems({hud, data, items, disabled, onUseSlot}: {
  hud: BattleHud; data: SourceUi; items: HudItemInventoryStore; disabled: boolean;
  onUseSlot: (slot: number) => void;
}) {
  const combat = useSyncExternalStore(hud.subscribeCombat, hud.getItemCombatSnapshot);
  const inventory = useSyncExternalStore(items.subscribe, items.getSnapshot);
  const [catalog, setCatalog] = useState<CombatCatalog | undefined>(preparedCombatCatalog);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    void loadCombatCatalog().then(value => {if (active) setCatalog(value);})
      .catch(error => {if (active) setError(String(error));});
    return () => {active = false;};
  }, []);
  const slots = catalog ? hudItemSlots(combat, catalog, inventory.inventory,
    inventory.selectedItemSlot, 1) : [];
  return <>
    <div className="mobile-battle-item-bank" role="group" aria-label="战斗道具栏">
      <div className="mobile-battle-item-grid">
        {slots.map(binding => <MobileBattleItemSlot key={binding.slot} data={data} hud={hud} binding={binding}
          disabled={disabled} onUseSlot={onUseSlot}/>)}
      </div>
    </div>
    <GameMessage text={error} tone="error"/>
  </>;
});

const MobileBattleItemSlot = memo(function MobileBattleItemSlot({data, hud, binding, disabled, onUseSlot}: {
  data: SourceUi; hud: BattleHud; binding: HudItemSlot; disabled: boolean; onUseSlot: (slot: number) => void;
}) {
  const asset = binding.item?.iconId === undefined ? undefined : sourceAsset(data,
    `set:daoju0 image:data\\ui\\daoju\\${String(binding.item.iconId).padStart(5, '0')}.tga`);
  const selected = binding.ammoSelected || binding.itemCursor;
  return <MobileBattleItemButton type="button" className="mobile-battle-item"
    data-item-slot={binding.slot} data-item-selected={selected || undefined}
    data-item-quantity={binding.quantity} aria-pressed={selected}
    aria-label={`${binding.slot <= 4 ? '选择弹药' : '立即使用'} ${binding.item?.name ?? `槽位${binding.slot}`}`}
    disabled={disabled || binding.itemTableId === undefined}
    onKeyDown={event => event.stopPropagation()} onKeyUp={event => event.stopPropagation()}
    onUse={() => onUseSlot(binding.slot)}>
    {asset && <ImageArtwork className="mobile-battle-item-icon" asset={`/${asset}`} fit="contain"/>}
    <span className="mobile-battle-item-number">{binding.slot}</span>
    {(binding.infinite || binding.quantity !== undefined) && <span className="mobile-battle-item-quantity">
      {binding.infinite ? '∞' : binding.quantity}
    </span>}
    <HudItemCooldown hud={hud} binding={binding} mobile/>
  </MobileBattleItemButton>;
}, (previous, next) => previous.data === next.data && previous.hud === next.hud && previous.disabled === next.disabled
  && previous.onUseSlot === next.onUseSlot && sameHudItemSlot(previous.binding, next.binding));

function MobileBattleItemButton({onUse, disabled, ...props}:
  Omit<ComponentPropsWithoutRef<'button'>, 'onClick'> & {onUse: () => void}) {
  const pointer = useRef<number | undefined>(undefined);
  const {element, buttonProps, pushed} = useButtonInteraction({...props, disabled,
    onPointerDown: event => {
      event.preventDefault(); event.stopPropagation();
      if (!disabled && event.button === 0) pointer.current = event.pointerId;
    },
    onPointerUp: event => {
      event.preventDefault(); event.stopPropagation();
      if (pointer.current !== event.pointerId) return;
      pointer.current = undefined;
      const bounds = event.currentTarget.getBoundingClientRect();
      if (!disabled && event.clientX >= bounds.left && event.clientX < bounds.right
          && event.clientY >= bounds.top && event.clientY < bounds.bottom) {
        onUse();
      }
      event.currentTarget.blur();
    },
    onPointerCancel: () => {pointer.current = undefined;},
    onLostPointerCapture: () => {pointer.current = undefined;},
    onBlur: () => {pointer.current = undefined;},
    onContextMenu: event => event.preventDefault(),
    onClick: event => {
      event.stopPropagation();
      if (!disabled && event.detail === 0) onUse();
    },
  });
  return <button {...buttonProps} ref={element} data-pressed={pushed || undefined}/>;
}
