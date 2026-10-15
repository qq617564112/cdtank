import {memo} from 'react';
import './hud-item-source.css';
import type {CombatCatalog} from '../../../../shared/combat/catalog';
import type {ResInventory} from '../../../../shared/protocols/PtlInventory';
import type {BattleHud, HudCombatSnapshot, SourceUi, SourceWindow} from './battle-hud';
import {hudItemSlots, sameHudItemSlot, type HudItemSlot} from './hud-item-slots';
import {absoluteRect, sourceAsset} from './hud-source-controls';
import {ImageArtwork} from '../resources/image-artwork';
import {BattleItemSocket} from './battle-hud-artwork';
import {HudItemCooldown} from './hud-item-cooldown';

/** CSS/SVG sockets and HTML counters share the authoritative shortcut bindings. */
export function HudItemSourceView({data, hud, combat, catalog, inventory, selectedItemSlot, onUseSlot}: {
  data: SourceUi; hud: BattleHud; combat: HudCombatSnapshot; catalog: CombatCatalog; inventory?: ResInventory;
  selectedWeaponSlot?: number; selectedItemSlot?: number;
  onUseSlot: (slot: number) => void;
}) {
  const layout = data.layouts.find(value => value.path === 'ui/layouts/game_main.xml');
  const bar = layout?.windows.find(value => value.name === 'daojulan');
  if (!layout || !bar) return null;
  const slots = hudItemSlots(combat, catalog, inventory, selectedItemSlot, 1);
  return <div className="hud-item-source-bar" data-source-control="daojulan" data-source-layout={layout.path}
    hidden={!combat.visible} data-hud-renderer="html" style={absoluteRect(bar)}>
    <svg className="hud-item-bar-frame" viewBox="0 0 300 47" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <path d="M1 2L298 1 299 45 1 46Z" fill="#386a3c" fillOpacity=".78" stroke="#112717" strokeWidth="2"/>
      <path d="M3 43L3 4 296 3" fill="none" stroke="#cff0a0" strokeWidth="1.5"/>
      <path d="M3 43L296 43 296 4" fill="none" stroke="#173521" strokeWidth="2"/>
    </svg>
    {slots.map(binding => <HudItemSlotView key={binding.slot} data={data} hud={hud}
      control={layout.windows.find(value => value.name === `picItem${binding.slot - 1}`)!}
      binding={binding} canUseShortcuts={combat.canUseShortcuts} onUseSlot={onUseSlot}/>)}
  </div>;
}

const HudItemSlotView = memo(function HudItemSlotView({data, hud, control, binding, canUseShortcuts, onUseSlot}: {
  data: SourceUi; hud: BattleHud; control: SourceWindow; binding: HudItemSlot; canUseShortcuts: boolean;
  onUseSlot: (slot: number) => void;
}) {
  const slot = binding.slot;
  const asset = binding.item?.iconId === undefined ? undefined : sourceAsset(data,
    `set:daoju0 image:data\\ui\\daoju\\${String(binding.item.iconId).padStart(5, '0')}.tga`);
  const selected = binding.ammoSelected || binding.itemCursor;
  const remainingLabel = binding.remainingSeconds === undefined ? undefined
    : `${binding.cooldownBinding === 'effect-expiry' ? '效果剩余' : '装填剩余'} ${Math.ceil(binding.remainingSeconds)} 秒`;
  return <button type="button" className="hud-item-action" style={absoluteRect(control)}
    data-source-control={control.name} data-item-slot={slot}
    data-item-selected={binding.ammoSelected ? '' : undefined} data-item-cursor={binding.itemCursor ? '' : undefined}
    data-item-instance={binding.instanceId} data-item-quantity={binding.quantity}
    data-item-selection-binding={slot <= 4 ? 'ammo-authority' : undefined}
    data-item-cursor-binding={slot >= 5 ? 'local-item-cursor' : undefined}
    aria-label={`${slot <= 4 ? '选择弹药' : '立即使用'} ${binding.item?.name ?? `槽位${slot}`}`}
    aria-pressed={selected} title={remainingLabel ?? binding.item?.name}
    disabled={!canUseShortcuts || binding.itemTableId === undefined}
    onPointerDown={event => {event.stopPropagation(); event.preventDefault();}}
    onKeyDown={event => event.stopPropagation()} onKeyUp={event => event.stopPropagation()}
    onClick={event => {
      event.stopPropagation(); onUseSlot(slot);
      if (event.detail > 0) event.currentTarget.blur();
    }}>
    <BattleItemSocket selected={selected}/>
    {asset && <ImageArtwork asset={`/${asset}`} className="hud-item-icon" fit="contain" aria-hidden="true"/>}
    <span className="hud-item-key" data-source-control={`lblItem${slot - 1}`}>{slot}</span>
    <HudItemCooldown hud={hud} binding={binding}/>
    {(binding.infinite || binding.quantity !== undefined) && <span className="hud-item-count"
      data-source-control={`txtItemCount${slot - 1}`} data-item-count-binding={binding.infinite
        ? 'default-infinite-supply' : 'web-confirmed-battle-quantity'}>{binding.infinite ? '∞' : binding.quantity}</span>}
  </button>;
}, (previous, next) => previous.data === next.data && previous.hud === next.hud && previous.control === next.control
  && previous.canUseShortcuts === next.canUseShortcuts && previous.onUseSlot === next.onUseSlot
  && sameHudItemSlot(previous.binding, next.binding));
