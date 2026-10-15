import {ImageArtwork} from '../resources/image-artwork';
import {SourceFeedbackText} from '../resources/source-feedback-text';
import type {HomeSourceUi} from '../resources/source-ui-layout';
import {sourceUiAsset} from '../resources/source-ui-image';
import {sourcePetKind} from './pet-shop-row-display';
import './pet-shop-row-content.css';

/** Product branch of the original CastlePage list row4bd110. */
export function PetShopRowContent({ui, petId, name, petType, petSize}: {
  ui: HomeSourceUi; petId?: number; name: string; petType?: number; petSize?: number;
}) {
  const icon = petId === undefined ? undefined : sourceUiAsset(ui,
    `set:gy0 image:data\\ui\\gy\\maogou_${petId}.tga`);
  return <>
    <span className="pet-shop-row-icon" aria-hidden="true" data-pet-row-icon=""
      data-pet-thumbnail={icon?.petThumbnail ? '' : undefined}
      data-source-asset={icon?.asset} style={{backgroundImage: 'none'}}>
      {icon?.asset && <ImageArtwork asset={`/${icon.asset}`} fit="contain"
        style={{width: '100%', height: '100%'}} aria-hidden="true"/>}
    </span>
    <span className="pet-shop-row-name" data-pet-row-name=""><SourceFeedbackText text={name}/></span>
    <span className="pet-shop-row-secondary" data-pet-row-secondary="" data-source-binding="pet-table-size-type"><SourceFeedbackText text={sourcePetKind(petSize, petType)}/></span>
  </>;
}
