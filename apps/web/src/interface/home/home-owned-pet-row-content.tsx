import {ImageArtwork} from '../resources/image-artwork';
import {SourceFeedbackText} from '../resources/source-feedback-text';
import type {HomeSourceUi} from '../resources/source-ui-layout';
import {sourceUiAsset} from '../resources/source-ui-image';
import {sourcePetKind} from '../account/pet-shop-row-display';
import {HomeRoleRowStatusBadge} from './home-role-row-status-badge';
import './home-owned-pet-row-content.css';

/** Original4bc86b owned Pet row, supplied by the same ownership record and PetTable. */
export function HomeOwnedPetRowContent({ui, name, petId, petType, petSize, current}: {
  ui: HomeSourceUi; name: string; petId?: number; petType?: number; petSize?: number;
  current?: boolean;
}) {
  const icon = petId === undefined ? undefined : sourceUiAsset(ui,
    `set:gy0 image:data\\ui\\gy\\maogou_${petId}.tga`);
  return <>
    <span className="home-owned-pet-row-icon" data-home-owned-pet-icon="" aria-hidden="true"
      data-pet-thumbnail={icon?.petThumbnail ? '' : undefined}
      data-source-asset={icon?.asset} style={{backgroundImage: 'none'}}>
      {icon?.asset && <ImageArtwork asset={`/${icon.asset}`} fit="contain"
        style={{width: '100%', height: '100%'}} aria-hidden="true"/>}
    </span>
    {current && <HomeRoleRowStatusBadge ui={ui} status="current"/>}
    <span className="home-owned-pet-row-name" data-home-owned-pet-name=""><SourceFeedbackText text={name}/></span>
    <span className="home-owned-pet-row-secondary" data-home-owned-pet-secondary=""><SourceFeedbackText text={sourcePetKind(petSize, petType)}/></span>
  </>;
}
