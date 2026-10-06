import {SourceFeedbackText} from '../resources/source-feedback-text';
import {HomeSourceLayout, type HomeSourceUi} from '../resources/source-ui-layout';
import {sourceProps} from '../resources/source-ui-props';
import {sourcePetKind} from '../account/pet-shop-row-display';
import './home-owned-pet-row-content.css';

/** Original4bc86b owned Pet row, supplied by the same ownership record and PetTable. */
export function HomeOwnedPetRowContent({ui, name, petId, petType, petSize}: {
  ui: HomeSourceUi; name: string; petId?: number; petType?: number; petSize?: number;
}) {
  const layout = new HomeSourceLayout(ui, 'myhome_petpage.xml');
  const icon = petId === undefined ? undefined : sourceProps(ui, layout, 'myhome_petpage.xml', 'lstPet',
    `set:gy0 image:data\\ui\\gy\\maogou_${petId}.tga`);
  return <>
    <span className="home-owned-pet-row-icon" data-home-owned-pet-icon="" aria-hidden="true"
      data-source-asset={icon?.['data-source-asset']} style={{backgroundImage: icon?.style.backgroundImage}} />
    <span className="home-owned-pet-row-name" data-home-owned-pet-name=""><SourceFeedbackText text={name}/></span>
    <span className="home-owned-pet-row-secondary" data-home-owned-pet-secondary=""><SourceFeedbackText text={sourcePetKind(petSize, petType)}/></span>
  </>;
}
