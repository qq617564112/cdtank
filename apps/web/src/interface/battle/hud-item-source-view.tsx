import './hud-item-source.css';
import type {CSSProperties} from 'react';
import type {CombatCatalog} from '../../../../shared/combat/catalog';
import type {ResInventory} from '../../../../shared/protocols/PtlInventory';
import type {HudCombatSnapshot, SourceUi, SourceWindow} from './battle-hud';

/** Original shortcut bar; icon ownership comes only from confirmed inventory. */
export function HudItemSourceView({data, combat, catalog, inventory, selectedItemSlot, onUseSlot}: {
  data: SourceUi; combat: HudCombatSnapshot; catalog: CombatCatalog; inventory?: ResInventory;
  selectedWeaponSlot?: number; selectedItemSlot?: number;
  onUseSlot: (slot: number) => void;
}) {
  const layout = data.layouts.find(value => value.path === 'ui/layouts/game_main.xml');
  const bar = layout?.windows.find(value => value.name === 'daojulan');
  if (!layout || !bar) return null;
  function asset(reference?: string): string | undefined {
    const match = /^set:(\S+) image:(.+)$/.exec(reference ?? '');
    if (!match) return;
    const sets = data.imagesets.filter(value => value.attributes.Name === match[1]);
    const set = sets.find(value => value.path.includes('imagesets_dds/')) ?? sets[0];
    return set?.images.find(value => value.Name === match[2])?.asset;
  }
  function style(control: SourceWindow): CSSProperties {
    const rect = control.properties.AbsoluteRect.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
    return {left: rect[0], top: rect[1], width: rect[2] - rect[0], height: rect[3] - rect[1]};
  }
  function glyphs(value: string, fontName: string) {
    const size = fontName === 'SmallHT' ? 17 : 14;
    return <span data-dynamic-font="xiangjiao-brush" style={{fontSize: size,
      lineHeight: `${size}px`, color: fontName === 'Cheap' ? '#ffdf41' : '#fff'}}>{value}</span>;
  }
  function instanceForSlot(slot: number): ResInventory['records'][number] | undefined {
    if (slot < 2 || slot > 8) return;
    const instanceId = inventory?.hotkeys[slot - 2];
    return instanceId === undefined ? undefined
      : inventory?.records.find(value => (value.instanceId >>> 0) === (instanceId >>> 0));
  }
  function itemTableIdForSlot(slot: number): {itemTableId?: number; instanceId?: number} {
    if (slot === 1) return {itemTableId: 2001};
    const instanceId = inventory?.hotkeys[slot - 2];
    const record = instanceForSlot(slot);
    const ammo = slot >= 2 && slot <= 4 ? combat.ammoSlots.find(value => value.slot === slot) : undefined;
    return {itemTableId: ammo?.itemTableId ?? record?.itemTableId, instanceId};
  }
  function usableItemSlot(slot: number): boolean {
    if (slot < 5 || slot > 8) return false;
    const record = instanceForSlot(slot);
    return !!record && (record.ownedQuantity >>> 0) > 0 && (record.battleQuantity >>> 0) > 0;
  }
  function quantityForSlot(slot: number): number | 'infinite' | undefined {
    if (slot === 1) return 'infinite';
    const ammo = slot >= 2 && slot <= 4 ? combat.ammoSlots.find(value => value.slot === slot) : undefined;
    if (ammo) return ammo.quantity;
    const instanceId = inventory?.hotkeys[slot - 2];
    return instanceId === undefined ? undefined
      : inventory?.records.find(value => value.instanceId === instanceId)?.battleQuantity;
  }
  function activeEffectForSlot(slot: number, itemTableId?: number): {skillId: number; expiresAt: number} | undefined {
    if (slot < 5 || slot > 8 || itemTableId === undefined) return;
    const skillIds = catalog.items.find(value => value.itemTableId === itemTableId)?.skillIds ?? [];
    return combat.activeEffects.find(effect => skillIds.includes(effect.skillId) && effect.expiresAt > combat.serverTime);
  }
  const reloadSlot = combat.selectedAmmoSlot === undefined ? undefined
    : combat.selectedAmmoSlot === 0 ? 1
    : combat.selectedAmmoSlot >= 1 && combat.selectedAmmoSlot <= 4 ? combat.selectedAmmoSlot : undefined;
  function controls(parent: string): React.ReactNode {
    return layout!.windows.filter(value => value.parent === parent).map(control => {
      const name = control.name;
      let reference: string | undefined = control.properties.Image;
      let instanceId: number | undefined;
      let itemName: string | undefined;
      let quantity: number | undefined;
      let infinite = false;
      let slot = 0;
      if (/^daoju[1-8]$/.test(name)) {
        slot = Number(name.slice(5));
        const bound = itemTableIdForSlot(slot);
        instanceId = bound.instanceId;
        const itemTableId = bound.itemTableId;
        const item = catalog.items.find(value => value.itemTableId === itemTableId);
        itemName = item?.name;
        reference = item?.iconId === undefined ? undefined
          : `set:daoju0 image:data\\ui\\daoju\\${String(item.iconId).padStart(5, '0')}.tga`;
      }
      if (name.startsWith('txtItemCount')) {
        const value = quantityForSlot(Number(name.slice(12)) + 1);
        infinite = value === 'infinite';
        quantity = typeof value === 'number' ? value : undefined;
      }
      if (name.startsWith('lengque')) slot = Number(name.slice(7));
      const slotFrame = /^picItem[0-7]$/.test(name);
      if (slotFrame) slot = Number(name.slice(7)) + 1;
      const image = asset(reference);
      const count = name.startsWith('txtItemCount'), cooldown = name.startsWith('lengque'), daoju = name.startsWith('daoju');
      const label = name.startsWith('lblItem') ? control.properties.Text ?? '' : undefined;
      const ammoSelected = slotFrame && slot <= 4 && slot === reloadSlot
        && itemTableIdForSlot(slot).itemTableId !== undefined;
      const itemCursor = slotFrame && slot >= 5 && slot === selectedItemSlot && usableItemSlot(slot);
      let cooldownFraction: number | undefined;
      let cooldownBinding: string | undefined;
      let remainingSeconds: number | undefined;
      if (cooldown && slot <= 4 && slot === reloadSlot && combat.alive
          && itemTableIdForSlot(slot).itemTableId !== undefined && combat.reload
          && combat.reload.duration > 0 && combat.reload.startedAt > 0) {
        const remaining = Math.max(0, (combat.reload.startedAt + combat.reload.duration * 1000 - combat.serverTime) / 1000);
        if (remaining > 0) {
          remainingSeconds = remaining;
          cooldownFraction = Math.min(1, remaining / combat.reload.duration);
          cooldownBinding = 'reload-timing';
        }
      } else if (cooldown && slot >= 5 && combat.alive) {
        const bound = itemTableIdForSlot(slot);
        const effect = activeEffectForSlot(slot, bound.itemTableId);
        if (effect) {
          remainingSeconds = (effect.expiresAt - combat.serverTime) / 1000;
          cooldownFraction = 1;
          cooldownBinding = 'effect-expiry';
        }
      }
      const boundItem = daoju ? catalog.items.find(value => value.itemTableId === itemTableIdForSlot(slot).itemTableId) : undefined;
      return <div key={name} className="hud-item-source-control" data-source-control={name}
        data-source-layout={layout!.path} data-source-asset={image} data-item-instance={instanceId}
        data-item-count-binding={count ? infinite ? 'default-infinite-supply'
          : quantity === undefined ? 'unbound' : 'web-confirmed-battle-quantity' : undefined}
        data-item-quantity={quantity} data-item-infinite={infinite ? '' : undefined}
        data-item-cooldown-binding={cooldown ? cooldownBinding ?? 'unbound' : undefined}
        data-item-cooldown-fraction={cooldownFraction}
        data-item-selected={ammoSelected ? '' : undefined}
        data-item-cursor={itemCursor ? '' : undefined}
        data-item-selection-binding={slotFrame && slot <= 4 ? 'ammo-authority' : undefined}
        data-item-cursor-binding={slotFrame && slot >= 5 ? 'local-item-cursor' : undefined}
        data-item-remaining-seconds={remainingSeconds}
        hidden={cooldown && cooldownFraction === undefined}
        title={remainingSeconds === undefined ? itemName ?? boundItem?.name
          : `${cooldownBinding === 'effect-expiry' ? '效果剩余' : '装填剩余'} ${Math.ceil(remainingSeconds)} 秒`}
        aria-label={remainingSeconds !== undefined
          ? `${cooldownBinding === 'effect-expiry' ? '效果剩余' : '装填剩余'} ${Math.ceil(remainingSeconds)} 秒`
          : quantity === undefined ? infinite ? '无限弹药' : label ?? itemName ?? boundItem?.name : `本局可用 ${quantity}`}
        style={{...style(control), textAlign: count ? 'right' : undefined,
          backgroundImage: image ? `url('/${image}')` : undefined}}>
        {label === undefined ? null : glyphs(label, control.properties.Font)}
        {infinite ? <img className="hud-item-infinite" src="/ui/regions/2/0.png" alt="" aria-hidden="true" />
          : quantity === undefined ? null : glyphs(String(quantity), control.properties.Font)}
        {cooldownFraction !== undefined && <span className="hud-item-cooldown" data-item-cooldown-fraction={cooldownFraction}
          style={{height: `${cooldownFraction * 100}%`}} />}
        {remainingSeconds !== undefined && <span className="hud-item-remaining" aria-hidden="true">{Math.ceil(remainingSeconds)}</span>}
        {controls(name)}
        {slotFrame && <button type="button" className="hud-item-action"
          data-item-slot={slot}
          aria-label={`${slot <= 4 ? '选择弹药' : '立即使用'} ${catalog.items.find(value =>
            value.itemTableId === itemTableIdForSlot(slot).itemTableId)?.name ?? `槽位${slot}`}`}
          disabled={!combat.canUseShortcuts || itemTableIdForSlot(slot).itemTableId === undefined}
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
  const background = asset(bar.properties.Image);
  return <div className="hud-item-source-bar" data-source-control="daojulan" data-source-layout={layout.path}
    hidden={!combat.visible}
    data-source-asset={background} style={{...style(bar), backgroundImage: background ? `url('/${background}')` : undefined}}>
    {controls(bar.name)}
  </div>;
}
