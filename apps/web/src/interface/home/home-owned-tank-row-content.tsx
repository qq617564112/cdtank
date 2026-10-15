import {ImageArtwork} from '../resources/image-artwork';
import {TankIconMark} from '../resources/tank-icon-mark';
import {SourceFeedbackText} from '../resources/source-feedback-text';
import type {HomeSourceUi} from '../resources/source-ui-layout';
import {sourceUiAsset} from '../resources/source-ui-image';
import {sourceTankKind} from '../account/tank-shop-row-display';
import {sourceOwnedTankDays} from './home-owned-tank-row-display';
import {HomeRoleRowStatusBadge} from './home-role-row-status-badge';
import './home-owned-tank-row-content.css';

/** Original4bb3bc owned Tank row; display providers retain the original record identity. */
export function HomeOwnedTankRowContent({ui, name, tankId, tankType, durationMinutes, current}: {
  ui: HomeSourceUi; name: string; tankId?: number; tankType?: number; durationMinutes?: number;
  current?: boolean;
}) {
  const icon = tankId === undefined ? undefined : sourceUiAsset(ui,
    `set:tanke0 image:data\\ui\\tanke\\${String(tankId).padStart(3, '0')}.tga`);
  return <>
    <span className="home-owned-tank-row-icon" data-home-owned-tank-icon="" aria-hidden="true"
      data-tank-icon-mark={icon?.tankMark}
      data-source-asset={icon?.asset} style={{backgroundImage: 'none'}}>
      {icon?.asset && <ImageArtwork asset={`/${icon.asset}`} fit="contain"
        style={{width: '100%', height: '100%'}} aria-hidden="true"/>}
      {icon?.tankMark && <TankIconMark mark={icon.tankMark}/>}
    </span>
    {current && <HomeRoleRowStatusBadge ui={ui} status="current"/>}
    <span className="home-owned-tank-row-name" data-home-owned-tank-name="">
      <SourceFeedbackText text={name === '鋼牙豹' ? '钢牙豹' : name}/>
    </span>
    <span className="home-owned-tank-row-type" data-home-owned-tank-type=""><SourceFeedbackText text={sourceTankKind(tankType)}/></span>
    <span className="home-owned-tank-row-days" data-home-owned-tank-days=""><SourceFeedbackText text={sourceOwnedTankDays(durationMinutes)}/></span>
  </>;
}
