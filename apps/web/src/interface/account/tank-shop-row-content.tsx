import {ImageArtwork} from '../resources/image-artwork';
import {TankIconMark} from '../resources/tank-icon-mark';
import {SourceFeedbackText} from '../resources/source-feedback-text';
import {HomeSourceLayout, type HomeSourceUi} from '../resources/source-ui-layout';
import {sourceProps} from '../resources/source-ui-props';
import {sourceTankKind, sourceTankDays} from './tank-shop-row-display';
import {sourceOwnedTankDays} from '../home/home-owned-tank-row-display';
import './tank-shop-row-content.css';

/** Original LabPage list row4bbd0a. */
export function TankShopRowContent({ui, tankId, name, tankType, defaultDurability, durationMinutes, owned}: {
  ui: HomeSourceUi; tankId?: number; name: string; tankType?: number; defaultDurability?: number; durationMinutes?: number; owned?: boolean;
}) {
  const layout = new HomeSourceLayout(ui, 'shop_tankpage.xml');
  const icon = tankId === undefined ? undefined : sourceProps(ui, layout, 'shop_tankpage.xml', 'lstTank',
    `set:tanke0 image:data\\ui\\tanke\\${String(tankId).padStart(3, '0')}.tga`);
  return <>
    <span className="tank-shop-row-icon" aria-hidden="true" data-tank-row-icon=""
      data-tank-icon-mark={icon?.['data-tank-icon-mark']}
      data-source-asset={icon?.['data-source-asset']} style={{backgroundImage: 'none'}}>
      {icon?.['data-source-asset'] && <ImageArtwork asset={`/${icon['data-source-asset']}`} fit="contain"
        style={{width: '100%', height: '100%'}} aria-hidden="true"/>}
      {icon?.['data-tank-icon-mark'] && <TankIconMark mark={icon['data-tank-icon-mark']}/>}
    </span>
    <span className="tank-shop-row-name" data-tank-row-name=""><SourceFeedbackText text={name}/></span>
    <span className="tank-shop-row-secondary" data-tank-row-secondary="" data-source-binding="tank-table-type"><SourceFeedbackText text={sourceTankKind(tankType)}/></span>
    <span className="tank-shop-row-tertiary" data-tank-row-tertiary="" data-source-binding={owned ? 'mytank-duration-minutes' : 'tankshop-default-durability'}><SourceFeedbackText text={owned ? sourceOwnedTankDays(durationMinutes) : sourceTankDays(defaultDurability)}/></span>
  </>;
}
