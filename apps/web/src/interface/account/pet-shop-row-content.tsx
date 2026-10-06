import {SourceFeedbackText} from '../resources/source-feedback-text';
import {HomeSourceLayout, type HomeSourceUi} from '../resources/source-ui-layout';
import {sourceProps} from '../resources/source-ui-props';
import {sourcePetKind, sourcePetPrice, sourcePetOwnedPrice} from './pet-shop-row-display';
import './pet-shop-row-content.css';

/** Product branch of the original CastlePage list row4bd110. */
export function PetShopRowContent({ui, petId, name, petType, petSize, tokenPrice, petMoney, owned}: {
  ui: HomeSourceUi; petId?: number; name: string; petType?: number; petSize?: number; tokenPrice?: number; petMoney?: number; owned?: boolean;
}) {
  const layout = new HomeSourceLayout(ui, 'shop_petpage.xml');
  const icon = petId === undefined ? undefined : sourceProps(ui, layout, 'shop_petpage.xml', 'lstPet',
    `set:gy0 image:data\\ui\\gy\\maogou_${petId}.tga`);
  return <>
    <span className="pet-shop-row-icon" aria-hidden="true" data-pet-row-icon=""
      data-source-asset={icon?.['data-source-asset']} style={{backgroundImage: icon?.style.backgroundImage}} />
    <span className="pet-shop-row-name" data-pet-row-name=""><SourceFeedbackText text={name}/></span>
    <span className="pet-shop-row-secondary" data-pet-row-secondary="" data-source-binding="pet-table-size-type"><SourceFeedbackText text={sourcePetKind(petSize, petType)}/></span>
    <span className="pet-shop-row-tertiary" data-pet-row-tertiary="" data-source-binding={owned ? 'pet-table-money-owned-display' : 'pet-table-coin-original-display'}><SourceFeedbackText text={owned ? sourcePetOwnedPrice(petMoney) : sourcePetPrice(tokenPrice)}/></span>
  </>;
}
