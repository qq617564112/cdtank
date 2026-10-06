import {useLayoutEffect, useRef} from 'react';
import {createPortal} from 'react-dom';
import type {TradeRecordView} from '../../../../shared/protocols/PtlTrade';
import type {CombatCatalog} from '../../../../shared/combat/catalog';
import {classifyInventoryCategory} from '../../../../shared/combat/inventory-query';
import {HomeSourceLayout, type HomeSourceControl, type HomeSourceUi} from '../resources/source-ui-layout';
import {SourceImageScale, SourceStaticImage} from '../resources/source-static-image';
import {SourceStaticText} from '../resources/source-static-text';
import {sourceProps} from '../resources/source-ui-props';
import {sourceOwnedTankDays} from '../home/home-owned-tank-row-display';
import {sourcePartOwnedDays, sourcePartOwnedKind} from './part-shop-owned-row-display';
import {sourcePetKind} from './pet-shop-row-display';
import {sourcePetDescription, sourceTankDescription} from '../resources/role-source-descriptions';

const rectWidth = (value: string | undefined) => Number(value?.match(/r:(-?\d+(?:\.\d+)?)/)?.[1] ?? 0);
const rectHeight = (value: string | undefined) => Number(value?.match(/b:(-?\d+(?:\.\d+)?)/)?.[1] ?? 0);
const absoluteRect = (controls: HomeSourceControl[], control: HomeSourceControl) => {
  const byName = new Map(controls.map(value => [value.name, value]));
  const values = (value: HomeSourceControl) => value.properties.AbsoluteRect.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
  const box = values(control);
  let left = box[0], top = box[1], right = box[2], bottom = box[3];
  for (let parent = control.parent; parent;) {
    const parentBox = values(byName.get(parent)!);
    left += parentBox[0]; right += parentBox[0];
    top += parentBox[1]; bottom += parentBox[1];
    parent = byName.get(parent)!.parent;
  }
  return {left, top, right, bottom};
};

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
export function TradeSourceDetail({ui, catalog, record, scale, close}: {
  ui: HomeSourceUi; catalog?: CombatCatalog; record: TradeRecordView; scale: number; close(): void;
}) {
  const suffix = record.kind === 'pet' ? 'trade_petdesc.xml' : record.kind === 'tank' ? 'trade_tankdesc.xml' : 'trade_partdesc.xml';
  const layout = new HomeSourceLayout(ui, suffix);
  const controls = ui.layouts.find(value => value.path.endsWith(suffix))!.windows;
  const root = layout.control('all');
  const bounds = controls.map(control => absoluteRect(controls, control));
  const width = Math.max(rectWidth(root.properties.AbsoluteRect), ...bounds.map(value => value.right));
  const height = Math.max(rectHeight(root.properties.AbsoluteRect), ...bounds.map(value => value.bottom));
  const fields = new Map(record.role?.fields);
  const texts: Record<string, string> = {};
  if (record.role) texts.txtName = record.role.name;
  if (record.kind === 'tank') {
    texts.txtDurable = sourceOwnedTankDays(fields.get(0x34));
    for (const [name, offset] of [['txtAttack', 0x3c], ['txtAttackExtra', 0x40],
      ['txtPanzer', 0x4c], ['txtPanzerExtra', 0x50]] as const) {
      const value = fields.get(offset);
      texts[name] = value === undefined ? '' : String(value);
    }
  }
  if (record.kind === 'pet') {
    for (const [name, offset] of [['txtHP', 0x2c], ['txtSavage', 0x34], ['txtLucky', 0x3c]] as const) {
      const value = fields.get(offset); texts[name] = value === undefined ? '' : String(value);
    }
    const pet = catalog?.petTypes?.find(value => value.petId === fields.get(8));
    texts.leixing = sourcePetKind(pet?.petSize, pet?.petType);
    for (let slot = 0; slot < 6; slot++) {
      const base = fields.get(0x44 + slot * 4), rank = fields.get(0x5c + slot * 4);
      const skillId = base === undefined || rank === undefined ? undefined : base + Math.max(0, rank - 1);
      texts[`txtSkillName${slot}`] = base ? catalog?.skills.find(value => value.skillId === skillId)?.name ?? '' : '';
      texts[`txtSkill${slot}`] = !base || rank === undefined ? '' : String(rank);
    }
  }
  if (record.item) {
    texts.txtType = sourcePartOwnedKind(record.item.itemTableId);
    texts.txtDurable = sourcePartOwnedDays(record.item.ownedQuantity);
  }
  const definitionId = fields.get(record.kind === 'pet' ? 8 : 0x24);
  const description = record.item
    ? catalog?.items.find(item => item.itemTableId === record.item!.itemTableId)?.info ?? ''
    : definitionId === undefined ? '' : record.kind === 'pet'
      ? sourcePetDescription(definitionId) ?? '' : sourceTankDescription(definitionId) ?? '';
  const dialog = useRef<HTMLDialogElement>(null);
  const escapePending = useRef(false);
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
    onCancel={event => {event.preventDefault(); event.stopPropagation(); close();}}
    onKeyDown={event => {
      event.stopPropagation();
      if (event.key === 'Escape') {
        event.preventDefault();
        if (!event.nativeEvent.isComposing && event.keyCode !== 229) escapePending.current = true;
      }
    }}
    onKeyUp={event => {
      event.stopPropagation();
      if (event.key === 'Escape' && escapePending.current) {
        escapePending.current = false;
        if (!event.nativeEvent.isComposing && event.keyCode !== 229) close();
      }
    }}>
    <div className="trade-source-detail-stage" style={{width: width * scale, height: height * scale}}>
      <div className="trade-source-detail-source" style={{width, height, transform: `scale(${scale})`}}>
        <SourceImageScale value={scale}>
          {controls.filter(control => control.type === 'WindowsLook/StaticImage').map(control =>
            <SourceStaticImage key={control.name} ui={ui} layout={layout} suffix={suffix} name={control.name} aria-hidden="true"/>)}
          {controls.filter(control => control.type === 'WindowsLook/StaticText').map(control =>
            <SourceStaticText key={control.name} ui={ui} layout={layout} suffix={suffix} name={control.name}
              text={texts[control.name] ?? control.properties.Text ?? ''}/>)}
          {controls.filter(control => control.type?.endsWith('Editbox')).map(control =>
            <div key={control.name} {...sourceProps(ui, layout, suffix, control.name)} className="trade-source-description"
              role="region" aria-label="交易物品说明" tabIndex={description ? 0 : -1}>
              {description}
            </div>)}
        </SourceImageScale>
      </div>
    </div>
    <button type="button" data-trade-detail-close="" aria-label="关闭详情" onClick={close}>关闭详情</button>
  </dialog>, document.body);
}
