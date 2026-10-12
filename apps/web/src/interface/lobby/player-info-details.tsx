import {Fragment} from 'react';
import {HomePlayerProfileArtwork, HomeScoreStar} from '../home/home-player-artwork';
import {HomePlayerModels} from '../home/home-player-model-preview';
import {HOME_PLAYER_MODEL_CLIP} from '../home/home-player-preview-contour';
import {HomeSurfacePanel} from '../home/home-surface';
import {HomeStaticText} from '../home/home-text';
import {SourceImageScale, SourceStaticImage} from '../resources/source-static-image';
import {sourceProps} from '../resources/source-ui-props';
import type {HomeSourceLayout, HomeSourceUi} from '../resources/source-ui-layout';
import type {ResPlayerProfile} from '../../../../shared/protocols/PtlPlayerProfile';
import type {PlayerInfoPlayer, PlayerInfoViewProps} from './player-info';
import {waitingTankReference} from './waiting-room-state';

const SUFFIX = 'playerlist_playerinfo.xml';

/** Public profile values sit on the account page's paper and portrait artwork. */
export function PlayerInfoDetails({ui, layout, player, profile, preview, loading, error, scale}: {
  ui: HomeSourceUi; layout: HomeSourceLayout; player: PlayerInfoPlayer;
  profile?: ResPlayerProfile; preview?: PlayerInfoViewProps['preview'];
  loading: boolean; error: string; scale: number;
}) {
  const bounds = sourceProps(ui, layout, SUFFIX, 'shangmianditu');
  const models = profile?.models ?? (preview?.petId
    ? {tankId: preview.tankId, petId: preview.petId} : undefined);
  const modelKey = models && [models.tankId, models.petId,
    profile?.models?.textures?.U, profile?.models?.textures?.M, profile?.models?.textures?.XY].join(':');
  const fields = [
    {source: 'txtPlayerTitle', label: '称号', top: 78, value: profile ? profile.title?.name ?? '' : player.title ?? ''},
    {source: 'txtPlayerOriginality', label: '创意点', top: 106, value: profile?.originality},
    {source: 'txtPlayerTech', label: '技能点', top: 134, value: profile?.tech},
    {source: 'txtPlayerScore', label: '积分', top: 160, value: profile?.score},
  ];
  return <>
    <div {...bounds} className="home-player-profile-background player-info-profile" aria-hidden="true">
      <HomePlayerProfileArtwork/>
    </div>
    <HomeSurfacePanel material="brown" style={{left: 10, top: 44, width: 378, height: 27}}/>
    <HomeScoreStar style={{left: 179, top: 146, width: 38, height: 39}}/>
    <HomeStaticText ui={ui} layout={layout} suffix={SUFFIX} name="txtPlayerName"
      text={profile?.name ?? player.name}/>
    <HomeStaticText ui={ui} layout={layout} suffix={SUFFIX} name="txtPlayerStatus"
      text={player.online ? player.inRoom ? '房间中' : '在线' : '离线'}/>
    {profile?.level !== undefined && <span className="player-info-level" data-player-info-summary-level="">
      等级 {profile.level}
    </span>}
    {fields.map(({source, label, top, value}) => <Fragment key={source}>
      <span className="home-profile-label" style={{left: 51, top, width: 62, height: 20}}>{label}</span>
      <HomeStaticText ui={ui} layout={layout} suffix={SUFFIX} name={source}
        style={{top, height: 20}} text={value === undefined ? '' : String(value)}/>
    </Fragment>)}
    <div className="home-player-model-preview player-info-model-preview" data-player-info-model-preview=""
      style={{clipPath: `path("${HOME_PLAYER_MODEL_CLIP}")`}}>
      {models ? <HomePlayerModels key={modelKey} {...models} scale={scale}/>
        : !preview && <span className="home-player-model-message" role="status">
          {loading ? '载入角色…' : error ? '角色资料暂时无法显示'
            : profile ? '角色模型资料暂时无法显示' : '暂无角色资料'}
        </span>}
    </div>
    {preview && !models && <SourceImageScale value={1}>
      <SourceStaticImage ui={ui} layout={layout} suffix={SUFFIX} name="picTankIcon"
        reference={waitingTankReference(preview.tankId)}
        className="player-info-tank" style={{left: 245, top: 88, width: 112, height: 50}} aria-hidden="true"/>
    </SourceImageScale>}
  </>;
}
