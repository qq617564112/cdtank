import {ShopSourceBackground as SourceStaticImage} from './shop-source-background';
import {HomeSourceLayout, type HomeSourceUi} from '../resources/source-ui-layout';
import {sourceProps} from '../resources/source-ui-props';
import type {CombatCatalog} from '../../../../shared/combat/catalog';
import type {ResEquipment} from '../../../../shared/protocols/PtlEquipment';
import type {ResInventory} from '../../../../shared/protocols/PtlInventory';

const partSlots = [
  {background: 'bgInternalPart0', icon: 'picInternalIcon0'},
  {background: 'bgInternalPart1', icon: 'picInternalIcon1'},
  {background: 'bgExternalPart0', icon: 'picExternalIcon0'},
  {background: 'bgExternalPart1', icon: 'picExternalIcon1'},
  {background: 'bgExternalPart2', icon: 'picExternalIcon2'},
];

function iconReference(inventory: ResInventory | undefined, catalog: CombatCatalog | undefined, instanceId?: number) {
  if (!instanceId) return undefined;
  const record = inventory?.records.find(value => value.instanceId === instanceId);
  if (!record) return undefined;
  const item = catalog?.items.find(value => value.itemTableId === record.itemTableId);
  if (!item) return undefined;
  const iconId = item.iconId ?? item.itemTableId;
  return `set:daoju0 image:data\\ui\\daoju\\${String(iconId).padStart(5, '0')}.tga`;
}

export function TankShopOwnedPartSourceRegions({ui, partSlotCount, equipment, inventory, catalog}: {
  ui: HomeSourceUi; partSlotCount?: number; equipment?: ResEquipment; inventory?: ResInventory; catalog?: CombatCatalog;
}) {
  const suffix = 'shop_tankpage_part.xml';
  const layout = new HomeSourceLayout(ui, suffix);
  const preview = sourceProps(ui, new HomeSourceLayout(ui, 'shop_tankpage.xml'), 'shop_tankpage.xml', 'ditukuang');
  const parts = partSlotCount === undefined ? [] : partSlots.slice(0, partSlotCount);
  const slots = [
    {background: 'bgHatIcon', icon: 'picHatIcon', instanceId: equipment?.decorationInstanceId, left: 8, top: 8},
    {background: 'bgMarkIcon', icon: 'picMarkIcon', instanceId: equipment?.markInstanceId, left: 44, top: 8},
    ...parts.map((slot, index) => ({...slot, instanceId: equipment?.slots[index],
      left: 8 + index * 32, top: Number(preview.style.height) - 40})),
  ].map(slot => ({...slot, reference: iconReference(inventory, catalog, slot.instanceId)}));
  return <div className="tank-shop-owned-parts" style={preview.style} aria-hidden="true">
    {slots.map(slot => <SourceStaticImage key={slot.background} ui={ui} layout={layout}
      suffix={suffix} name={slot.background} style={{left: slot.left, top: slot.top}}
      className="tank-shop-source-picture" aria-hidden="true" />)}
    {slots.filter(slot => slot.reference).map(slot => <SourceStaticImage key={slot.icon} ui={ui} layout={layout}
      suffix={suffix} name={slot.icon} reference={slot.reference} style={{left: slot.left, top: slot.top}}
      className="tank-shop-source-picture" aria-hidden="true" />)}
  </div>;
}
