import type {CombatCatalog} from '../../../../shared/combat/catalog';
import {classifyInventoryCategory} from '../../../../shared/combat/inventory-query';
import {gameContent} from '../../../../shared/content/catalog';
import type {TradeRecordView} from '../../../../shared/protocols/PtlTrade';
import {HomeEquipmentCommonRowContent} from '../home/home-equipment-common-row-content';
import {HomeItemRowContent} from '../home/home-item-row-content';
import {HomeOwnedPetRowContent} from '../home/home-owned-pet-row-content';
import {HomeOwnedTankRowContent} from '../home/home-owned-tank-row-content';
import {HomeRoleRowStatusBadge} from '../home/home-role-row-status-badge';
import type {HomeSourceUi} from '../resources/source-ui-layout';

/** Confirmed Trade candidates reuse the existing Home row providers without changing ownership state. */
export function TradeCandidateRowContent({ui, catalog, record, current, offered}: {
  ui: HomeSourceUi; catalog: CombatCatalog; record: TradeRecordView; current?: boolean; offered?: boolean;
}) {
  if (record.kind === 'tank') {
    const fields = new Map(record.role?.fields);
    const tankId = fields.get(0x24);
    const tankType = catalog.tankTypes?.find(value => value.tankId === tankId)?.tankType;
    return <>
      <HomeOwnedTankRowContent ui={ui} name={record.role?.name ?? ''} tankId={tankId}
        tankType={tankType} durationMinutes={fields.get(0x34)} current={current}/>
      {!current && offered && <HomeRoleRowStatusBadge ui={ui} status="offered"/>}
    </>;
  }
  if (record.kind === 'pet') {
    const fields = new Map(record.role?.fields);
    const petId = fields.get(8);
    const pet = catalog.petTypes?.find(value => value.petId === petId);
    return <>
      <HomeOwnedPetRowContent ui={ui} name={record.role?.name ?? ''} petId={petId}
        petType={pet?.petType} petSize={pet?.petSize} current={current}/>
      {!current && offered && <HomeRoleRowStatusBadge ui={ui} status="offered"/>}
    </>;
  }
  const item = record.item;
  if (!item) return null;
  const definition = catalog.items.find(value => value.itemTableId === item.itemTableId);
  if (definition?.iconId === undefined) return null;
  const category = classifyInventoryCategory(item.itemTableId);
  if (category === 1 || category === 2 || category === 6) {
    return <HomeItemRowContent ui={ui} name={definition.name} itemTableId={item.itemTableId}
      iconId={definition.iconId} ownedQuantity={item.ownedQuantity}/>;
  }
  const equipmentGroup = gameContent().items.get(item.itemTableId)?.runtime.equipmentGroup;
  const kindLabel = category === 7 ? '外观特效'
    : equipmentGroup === 'hat' ? '坦克帽子'
      : equipmentGroup === 'balloon' ? '坦克气球'
        : equipmentGroup === 'mark' ? '坦克标志' : undefined;
  return <HomeEquipmentCommonRowContent ui={ui} name={definition.name} iconId={definition.iconId}
    itemTableId={item.itemTableId} ownedQuantity={item.ownedQuantity} kindLabel={kindLabel}/>;
}
