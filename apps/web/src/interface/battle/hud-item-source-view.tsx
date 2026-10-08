import './hud-item-source.css';
import type {CSSProperties} from 'react';
import type {CombatCatalog} from '../../../../shared/combat/catalog';
import type {ResInventory} from '../../../../shared/protocols/PtlInventory';
import type {HudCombatSnapshot, SourceUi, SourceWindow} from './battle-hud';
import {hudItemSlots} from './hud-item-slots';
import {absoluteRect, sourceAsset} from './hud-source-controls';
import {SourceNumericText} from '../resources/source-text-artwork';

/** Original shortcut interaction and vector-font layer over the source artwork. */
export function HudItemSourceView({data, combat, catalog, inventory, selectedItemSlot, reloadFraction, onUseSlot}: {
  data: SourceUi; combat: HudCombatSnapshot; catalog: CombatCatalog; inventory?: ResInventory;
  selectedWeaponSlot?: number; selectedItemSlot?: number; reloadFraction: number;
  onUseSlot: (slot: number) => void;
}) {
  const layout = data.layouts.find(value => value.path === 'ui/layouts/game_main.xml');
  const bar = layout?.windows.find(value => value.name === 'daojulan');
  if (!layout || !bar) return null;
  const slots = hudItemSlots(combat, catalog, inventory, selectedItemSlot, reloadFraction);
  function style(control: SourceWindow): CSSProperties {
    return {...absoluteRect(control), backgroundImage: 'none'};
  }
  function glyphs(value: string, fontName: string) {
    return <SourceNumericText text={value} font={fontName}/>;
  }
  function controls(parent: string): React.ReactNode {
    return layout!.windows.filter(value => value.parent === parent).map(control => {
      const name = control.name, slotFrame = /^picItem[0-7]$/.test(name);
      const count = name.startsWith('txtItemCount'), cooldown = name.startsWith('lengque'), daoju = /^daoju[1-8]$/.test(name);
      const slot = count ? Number(name.slice(12)) + 1 : slotFrame || name.startsWith('lblItem')
        ? Number(/\d+$/.exec(name)?.[0]) + 1 : daoju || cooldown ? Number(/\d+$/.exec(name)?.[0]) : 0;
      const binding = slots[slot - 1];
      const reference = daoju ? binding?.item?.iconId === undefined ? undefined
        : `set:daoju0 image:data\\ui\\daoju\\${String(binding.item.iconId).padStart(5, '0')}.tga` : control.properties.Image;
      const asset = sourceAsset(data, reference);
      const label = name.startsWith('lblItem') ? control.properties.Text ?? '' : undefined;
      const infinite = count && binding?.infinite, quantity = count ? binding?.quantity : undefined;
      const cooldownFraction = cooldown ? binding?.cooldownFraction : undefined;
      const cooldownBinding = cooldown ? binding?.cooldownBinding : undefined;
      const remainingSeconds = cooldown ? binding?.remainingSeconds : undefined;
      const remainingLabel = `${cooldownBinding === 'effect-expiry' ? '效果剩余' : '装填剩余'} ${Math.ceil(remainingSeconds ?? 0)} 秒`;
      return <div key={name} className="hud-item-source-control" data-source-control={name}
        data-source-layout={layout!.path} data-source-asset={asset} data-item-instance={daoju ? binding?.instanceId : undefined}
        data-item-count-binding={count ? infinite ? 'default-infinite-supply'
          : quantity === undefined ? 'unbound' : 'web-confirmed-battle-quantity' : undefined}
        data-item-quantity={quantity} data-item-infinite={infinite ? '' : undefined}
        data-item-cooldown-binding={cooldown ? cooldownBinding ?? 'unbound' : undefined}
        data-item-cooldown-fraction={cooldownFraction}
        data-item-selected={slotFrame && binding?.ammoSelected ? '' : undefined}
        data-item-cursor={slotFrame && binding?.itemCursor ? '' : undefined}
        data-item-selection-binding={slotFrame && slot <= 4 ? 'ammo-authority' : undefined}
        data-item-cursor-binding={slotFrame && slot >= 5 ? 'local-item-cursor' : undefined}
        data-item-remaining-seconds={remainingSeconds}
        hidden={cooldown && cooldownFraction === undefined}
        title={remainingSeconds === undefined ? binding?.item?.name : remainingLabel}
        aria-label={remainingSeconds !== undefined ? remainingLabel
          : quantity === undefined ? infinite ? '无限弹药' : label ?? binding?.item?.name : `本局可用 ${quantity}`}
        style={{...style(control), textAlign: count ? 'right' : undefined}}>
        {label === undefined ? null : glyphs(label, control.properties.Font)}
        {quantity === undefined ? null : glyphs(String(quantity), control.properties.Font)}
        {remainingSeconds !== undefined && <span className="hud-item-remaining" aria-hidden="true">{Math.ceil(remainingSeconds)}</span>}
        {controls(name)}
        {slotFrame && <button type="button" className="hud-item-action" data-item-slot={slot}
          aria-label={`${slot <= 4 ? '选择弹药' : '立即使用'} ${binding?.item?.name ?? `槽位${slot}`}`}
          disabled={!combat.canUseShortcuts || binding?.itemTableId === undefined}
          onPointerDown={event => {event.stopPropagation(); event.preventDefault();}}
          onKeyDown={event => {event.stopPropagation();}}
          onKeyUp={event => {event.stopPropagation();}}
          onClick={event => {
            event.stopPropagation();
            onUseSlot(slot);
            if (event.detail > 0) event.currentTarget.blur();
          }} />}
      </div>;
    });
  }
  return <div className="hud-item-source-bar" data-source-control="daojulan" data-source-layout={layout.path}
    hidden={!combat.visible} data-hud-renderer="source-image"
    data-source-asset={sourceAsset(data, bar.properties.Image)} style={style(bar)}>
    {controls(bar.name)}
  </div>;
}
