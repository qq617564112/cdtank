import {classifyItemId} from '../../../../shared/combat/item-hotkeys';
import {sourceProps} from '../resources/source-ui-props';
import {HomeSourceLayout, type HomeSourceUi} from '../resources/source-ui-layout';
import {HomeRoleRowStatusBadge} from '../home/home-role-row-status-badge';
import './mend-part-row-content.css';

const TYPE_LABELS: Record<number, string> = {
  5: '坦克帽子', 6: '坦克气球', 7: '坦克标志', 8: '炮管类',
  9: '装甲类', 10: '射击类', 11: '移动类', 12: '一般类',
};

/** Original MyItem row text and image; remaining quantity is displayed without changing it. */
export function MendPartRowContent({ui, name, itemTableId, iconId, ownedQuantity, installed}: {
  ui: HomeSourceUi; name: string; itemTableId: number; iconId?: number; ownedQuantity: number; installed?: boolean;
}) {
  const layout = new HomeSourceLayout(ui, 'shop_mendpage.xml');
  const icon = iconId === undefined ? undefined : sourceProps(ui, layout, 'shop_mendpage.xml', 'lstPart',
    `set:daoju0 image:data\\ui\\daoju\\${String(iconId).padStart(5, '0')}.tga`);
  const days = Math.ceil((ownedQuantity >>> 0) / 1440);
  return <>
    <span className="mend-part-icon" aria-hidden="true" data-source-asset={icon?.['data-source-asset']}
      style={{backgroundImage: icon?.style.backgroundImage}} />
    {installed && <HomeRoleRowStatusBadge ui={ui} status="installed"/>}
    <span className="mend-part-name" data-mend-part-name="">{name}</span>
    <span className="mend-part-type" data-mend-part-type="">{TYPE_LABELS[classifyItemId(itemTableId)] ?? ''}</span>
    <span className="mend-part-duration" data-mend-part-duration="" data-source-duration-field="MyItem+0x10"
      data-source-owned-quantity={ownedQuantity}>{`（${days}天）`}</span>
  </>;
}
