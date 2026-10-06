import {classifyItemId} from '../../../../shared/combat/item-hotkeys';
import {HomeSourceLayout, type HomeSourceUi} from '../resources/source-ui-layout';
import {sourceProps} from '../resources/source-ui-props';
import './home-item-row-content.css';

const TYPE_LABELS: Record<number, string> = {1: '道具', 2: '道具', 3: '炮弹', 4: '陷阱', 13: '贵重品', 14: '猫狗头部装备'};

/** Original Item, Weapon and Valuable factories supply the same owned row inputs. */
export function HomeItemRowContent({ui, name, itemTableId, iconId, ownedQuantity}: {
  ui: HomeSourceUi; name: string; itemTableId: number; iconId: number; ownedQuantity: number;
}) {
  const layout = new HomeSourceLayout(ui, 'myhome_playerpage.xml');
  const icon = sourceProps(ui, layout, 'myhome_playerpage.xml', 'lstPlayerItem',
    `set:daoju0 image:data\\ui\\daoju\\${String(iconId).padStart(5, '0')}.tga`);
  return <>
    <span className="home-item-row-icon" aria-hidden="true" data-source-asset={icon['data-source-asset']}
      style={{backgroundImage: icon.style.backgroundImage}} />
    <span className="home-item-row-name" data-home-item-row-name="">{name}</span>
    <span className="home-item-row-type" data-home-item-row-type="">{TYPE_LABELS[classifyItemId(itemTableId)] ?? ''}</span>
    <span className="home-item-row-quantity" data-home-item-row-quantity=""
      data-source-quantity-field="MyItem+0x10">{ownedQuantity}</span>
  </>;
}
