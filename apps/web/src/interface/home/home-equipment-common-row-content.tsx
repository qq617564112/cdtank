import {SourceFeedbackText} from '../resources/source-feedback-text';
import {HomeSourceLayout, type HomeSourceUi} from '../resources/source-ui-layout';
import {sourceProps} from '../resources/source-ui-props';
import {sourcePartOwnedKind, sourcePartOwnedDays} from '../account/part-shop-owned-row-display';
import './home-equipment-common-row-content.css';

/** Original4b9e77 equipment row, using the same MyItem text getters. */
export function HomeEquipmentCommonRowContent({ui, name, iconId, itemTableId, ownedQuantity, kindLabel}: {
  ui: HomeSourceUi; name: string; iconId: number; itemTableId: number; ownedQuantity: number; kindLabel?: string;
}) {
  const layout = new HomeSourceLayout(ui, 'myhome_panzerpage.xml');
  const icon = sourceProps(ui, layout, 'myhome_panzerpage.xml', 'lstEquip',
    `set:daoju0 image:data\\ui\\daoju\\${String(iconId).padStart(5, '0')}.tga`);
  return <>
    <span className="home-equipment-common-row-icon" data-home-equipment-common-icon="" aria-hidden="true"
      data-source-asset={icon['data-source-asset']} style={{backgroundImage: icon.style.backgroundImage}} />
    <span className="home-equipment-common-row-name" data-home-equipment-common-name=""><SourceFeedbackText text={name}/></span>
    <span className="home-equipment-common-row-kind" data-home-equipment-common-kind=""><SourceFeedbackText text={kindLabel ?? sourcePartOwnedKind(itemTableId)}/></span>
    <span className="home-equipment-common-row-days" data-home-equipment-common-days=""><SourceFeedbackText text={sourcePartOwnedDays(ownedQuantity)}/></span>
  </>;
}
