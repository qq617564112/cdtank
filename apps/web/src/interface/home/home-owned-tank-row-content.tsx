import {SourceFeedbackText} from '../resources/source-feedback-text';
import {HomeSourceLayout, type HomeSourceUi} from '../resources/source-ui-layout';
import {sourceProps} from '../resources/source-ui-props';
import {sourceTankKind} from '../account/tank-shop-row-display';
import {sourceOwnedTankDays} from './home-owned-tank-row-display';
import {HomeOwnedRoleCurrentBadge} from './home-owned-role-current-badge';
import './home-owned-tank-row-content.css';

/** Original4bb3bc owned Tank row; display providers retain the original record identity. */
export function HomeOwnedTankRowContent({ui, name, tankId, tankType, durationMinutes, current}: {
  ui: HomeSourceUi; name: string; tankId?: number; tankType?: number; durationMinutes?: number;
  current?: boolean;
}) {
  const layout = new HomeSourceLayout(ui, 'myhome_panzerpage.xml');
  const icon = tankId === undefined ? undefined : sourceProps(ui, layout, 'myhome_panzerpage.xml', 'lstTank',
    `set:tanke0 image:data\\ui\\tanke\\${String(tankId).padStart(3, '0')}.tga`);
  return <>
    <span className="home-owned-tank-row-icon" data-home-owned-tank-icon="" aria-hidden="true"
      data-source-asset={icon?.['data-source-asset']} style={{backgroundImage: icon?.style.backgroundImage}} />
    {current && <HomeOwnedRoleCurrentBadge ui={ui}/>}
    <span className="home-owned-tank-row-name" data-home-owned-tank-name=""><SourceFeedbackText text={name}/></span>
    <span className="home-owned-tank-row-type" data-home-owned-tank-type=""><SourceFeedbackText text={sourceTankKind(tankType)}/></span>
    <span className="home-owned-tank-row-days" data-home-owned-tank-days=""><SourceFeedbackText text={sourceOwnedTankDays(durationMinutes)}/></span>
  </>;
}
