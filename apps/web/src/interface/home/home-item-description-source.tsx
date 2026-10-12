import {GameItemTooltip} from '../resources/game-item-tooltip';
import {HomeStaticText as SourceStaticText} from './home-text';
import {HomeSourceLayout, type HomeSourceUi} from '../resources/source-ui-layout';
import {sourceProps} from '../resources/source-ui-props';

export interface HomeItemDescription {
  instanceId: number;
  itemTableId: number;
  name: string;
  info: string;
  left: number;
  top: number;
}

/** Keep the source description sheet inside the owning Home page. */
export function homeItemDescriptionPosition(anchor: HTMLButtonElement): {left: number; top: number} {
  const sheet = anchor.closest<HTMLElement>('.home-inventory-stage, .home-equipment-stage')!.getBoundingClientRect();
  const row = anchor.getBoundingClientRect();
  const scale = sheet.width / 625;
  return {left: Math.max(0, Math.min(625 - 218, (row.left - sheet.left) / scale)),
    top: Math.max(0, Math.min(404 - 103, (row.bottom - sheet.top) / scale + 4))};
}

/** Inventory and equipment share the vector item-description frame. */
export function HomeItemDescriptionSource({ui, description}: {ui: HomeSourceUi; description: HomeItemDescription}) {
  const suffix = 'shop_itemdesc.xml';
  const layout = new HomeSourceLayout(ui, suffix);
  return <GameItemTooltip id="home-item-description" className="home-item-description-source"
    style={{left: description.left, top: description.top}} data-home-item-description=""
    data-instance-id={description.instanceId} data-item-table-id={description.itemTableId}>
    <SourceStaticText ui={ui} layout={layout} suffix={suffix} name="txtType" text={description.name}
      className="game-item-tooltip-title"/>
    <div {...sourceProps(ui, layout, suffix, 'edtDescription')}
      className="game-item-tooltip-description home-item-description-text">
      {description.info}
    </div>
  </GameItemTooltip>;
}
