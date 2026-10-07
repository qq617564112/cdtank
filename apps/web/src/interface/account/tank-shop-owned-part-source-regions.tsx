import {SourceStaticImage} from '../resources/source-static-image';
import {HomeSourceLayout, type HomeSourceUi} from '../resources/source-ui-layout';
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
  const slots = partSlotCount === undefined ? [] : partSlots.slice(0, partSlotCount);
  const backgrounds = ['bgHatIcon', 'bgMarkIcon', ...slots.map(slot => slot.background)];
  const icons = [
    {name: 'picHatIcon', instanceId: equipment?.decorationInstanceId},
    {name: 'picMarkIcon', instanceId: equipment?.markInstanceId},
    ...slots.map((slot, index) => ({name: slot.icon, instanceId: equipment?.slots[index]})),
  ].map(icon => ({...icon, reference: iconReference(inventory, catalog, icon.instanceId)}));
  return <>{backgrounds.map(name => <SourceStaticImage key={name} ui={ui} layout={layout}
    suffix={suffix} name={name} offsetX={0} offsetY={36}
    className="tank-shop-source-picture" aria-hidden="true" />)}
    {icons.filter(icon => icon.reference).map(icon => <SourceStaticImage key={icon.name} ui={ui} layout={layout}
      suffix={suffix} name={icon.name} reference={icon.reference} offsetX={0} offsetY={36}
      className="tank-shop-source-picture" aria-hidden="true" />)}</>;
}
