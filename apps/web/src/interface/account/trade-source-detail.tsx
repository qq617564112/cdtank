import {useLayoutEffect, useRef} from 'react';
import {createPortal} from 'react-dom';
import type {TradeRecordView} from '../../../../shared/protocols/PtlTrade';
import type {CombatCatalog} from '../../../../shared/combat/catalog';
import {classifyInventoryCategory} from '../../../../shared/combat/inventory-query';
import {HomeSourceLayout, type HomeSourceUi} from '../resources/source-ui-layout';
import {SourceStaticImage} from '../resources/source-static-image';
import {SourceStaticText} from '../resources/source-static-text';
import {sourceProps} from '../resources/source-ui-props';
import {sourceOwnedTankDays} from '../home/home-owned-tank-row-display';
import {sourcePartOwnedDays, sourcePartOwnedKind} from './part-shop-owned-row-display';
import {sourcePetKind} from './pet-shop-row-display';

export function tradeRecordPresentation(record: TradeRecordView, catalog?: CombatCatalog) {
  const fields = new Map(record.role?.fields);
  if (record.kind === 'pet') {
    const id = fields.get(8);
    return {name: record.role?.name ?? '', reference: id === undefined ? undefined : `set:gy0 image:data\\ui\\gy\\maogou_${id}.tga`};
  }
  if (record.kind === 'tank') {
    const id = fields.get(0x24);
    return {name: record.role?.name ?? '', reference: id === undefined ? undefined : `set:tanke0 image:data\\ui\\tanke\\${String(id).padStart(3, '0')}.tga`};
  }
  const definition = catalog?.items.find(item => item.itemTableId === record.item?.itemTableId);
  return {name: definition?.name ?? '', reference: definition?.iconId === undefined ? undefined : `set:daoju0 image:data\\ui\\daoju\\${String(definition.iconId).padStart(5, '0')}.tga`};
}

export function hasTradeRecordDetail(record: TradeRecordView): boolean {
  return !!record.role || !!record.item && [5, 7].includes(classifyInventoryCategory(record.item.itemTableId));
}

/** Dedicated source detail panels read the same confirmed record as the offer. */
export function TradeSourceDetail({ui, catalog, record, close}: {
  ui: HomeSourceUi; catalog?: CombatCatalog; record: TradeRecordView; close(): void;
}) {
  const suffix = record.kind === 'pet' ? 'trade_petdesc.xml' : record.kind === 'tank' ? 'trade_tankdesc.xml' : 'trade_partdesc.xml';
  const layout = new HomeSourceLayout(ui, suffix);
  const controls = ui.layouts.find(value => value.path.endsWith(suffix))!.windows;
  const fields = new Map(record.role?.fields);
  const texts: Record<string, string> = {};
  if (record.role) texts.txtName = record.role.name;
  if (record.kind === 'tank') texts.txtDurable = sourceOwnedTankDays(fields.get(0x34));
  if (record.kind === 'pet') {
    for (const [name, offset] of [['txtHP', 0x2c], ['txtSavage', 0x34], ['txtLucky', 0x3c]] as const) {
      const value = fields.get(offset); texts[name] = value === undefined ? '' : String(value);
    }
    const pet = catalog?.petTypes?.find(value => value.petId === fields.get(8));
    texts.leixing = sourcePetKind(pet?.petSize, pet?.petType);
    for (let slot = 0; slot < 6; slot++) {
      const base = fields.get(0x44 + slot * 4), rank = fields.get(0x5c + slot * 4);
      const skillId = base === undefined || rank === undefined ? undefined : base + Math.max(0, rank - 1);
      texts[`txtSkillName${slot}`] = catalog?.skills.find(value => value.skillId === skillId)?.name ?? '';
      texts[`txtSkill${slot}`] = rank === undefined ? '' : String(rank);
    }
  }
  if (record.item) {
    texts.txtType = sourcePartOwnedKind(record.item.itemTableId);
    texts.txtDurable = sourcePartOwnedDays(record.item.ownedQuantity);
  }
  const dialog = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    const element = dialog.current!, previous = document.activeElement;
    element.showModal(); element.querySelector<HTMLButtonElement>('button')?.focus();
    return () => {
      if (element.open) element.close();
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, []);
  return createPortal(<dialog ref={dialog} className="trade-source-detail" data-trade-detail={record.kind}
    aria-label={`交易物品详情：${tradeRecordPresentation(record, catalog).name}`}
    onCancel={event => {event.preventDefault(); close();}}>
    <div className="trade-source-detail-stage" style={{width: record.kind === 'item' ? 240 : 280, height: record.kind === 'pet' ? 220 : record.kind === 'tank' ? 340 : 130}}>
      {controls.filter(control => control.type === 'WindowsLook/StaticImage').map(control =>
        <SourceStaticImage key={control.name} ui={ui} layout={layout} suffix={suffix} name={control.name} aria-hidden="true"/>)}
      {controls.filter(control => control.type === 'WindowsLook/StaticText').map(control =>
        <SourceStaticText key={control.name} ui={ui} layout={layout} suffix={suffix} name={control.name} text={texts[control.name] ?? ''}/>)}
      {controls.filter(control => control.type?.endsWith('Editbox')).map(control =>
        <div key={control.name} {...sourceProps(ui, layout, suffix, control.name)} className="trade-source-description">
          {record.item ? catalog?.items.find(item => item.itemTableId === record.item!.itemTableId)?.info ?? '' : ''}
        </div>)}
    </div>
    <button type="button" data-trade-detail-close="" onClick={close}>关闭详情</button>
  </dialog>, document.body);
}
