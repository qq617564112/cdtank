import './hud-minimap-view.css';
import {useSyncExternalStore} from 'react';
import {hudMinimapBounds, hudMinimapPosition} from './hud-minimap-bounds';
import {sourceAsset} from './hud-source-controls';
import type {BattleHud, SourceUi} from './battle-hud';

const BOUND_FRAME = ['TopLeftFrameImage', 'TopRightFrameImage', 'BottomLeftFrameImage', 'BottomRightFrameImage',
  'TopFrameImage', 'BottomFrameImage', 'LeftFrameImage', 'RightFrameImage'] as const;

/**
 * Source picMiniMap(608,408,192,192) with the loaded scene's top-down image.
 * Image and authoritative markers share each map's fixed world-coordinate bounds.
 * Markers render from the authoritative snapshot as soon as the map bounds are
 * known, so received world positions and objectives are never withheld while the
 * top-down capture is still pending. The original picMiniMap Alpha 0.5 still
 * dims the whole source control, captured scene and markers together.
 */
export function HudMinimapView({hud, data}: {hud: BattleHud; data: SourceUi}) {
  const snapshot = useSyncExternalStore(hud.subscribeMinimap, hud.getMinimapSnapshot);
  if (!snapshot.visible) return null;
  const mapImage = snapshot.imageUrl;
  const bounds = snapshot.mapId === undefined ? undefined : hudMinimapBounds(snapshot.mapId);
  const local = snapshot.players.find(player => player.id === snapshot.localPlayerId);
  const teamMode = snapshot.mode <= 3;
  const tankAsset = sourceAsset(data, 'set:zhandou00 image:data\\ui\\zhandou\\wotanke.tga');
  const actorAsset = sourceAsset(data, 'set:zhandou00 image:data\\ui\\zhandou\\danke.tga');
  const objectiveAsset = sourceAsset(data, 'set:zhandou00 image:data\\ui\\zhandou\\diaobao.tga');
  const vipAsset = sourceAsset(data, 'set:zhandou00 image:data\\ui\\zhandou\\viptanke.tga');
  const project = (x: number, z: number) => {
    if (!bounds) return undefined;
    return hudMinimapPosition(bounds, x, z);
  };
  const layout = data.layouts.find(value => value.path === 'ui/layouts/game_main.xml');
  const bound = layout?.windows.find(value => value.name === 'picMiniMapBound');
  const frame = bound ? BOUND_FRAME.map(name => ({name, asset: sourceAsset(data, bound.properties[name])})) : [];
  return <div className="hud-minimap"
    data-minimap-map-id={snapshot.mapId} data-minimap-mode={snapshot.mode}
    role="img" aria-label="小地图">
    <div className="hud-minimap-content" data-source-control="picMiniMap" data-source-layout="ui/layouts/game_main.xml"
      style={{opacity: .5}}>
    {mapImage && <div className="hud-minimap-image" data-map-image-source="original-scene-top-down"
      style={{backgroundImage: `url('${mapImage}')`}} />}
    {bounds && snapshot.objectives.map(objective => {
      const position = project(objective.x, objective.z);
      if (!position) return null;
      const contested = objective.contested;
      const destroyed = objective.hp <= 0;
      const side = objectiveSide(objective.ownerTeam, local?.team, teamMode);
      return <span key={objective.id} className="hud-minimap-objective"
        data-source-asset={objectiveAsset}
        data-objective-kind={objective.kind} data-objective-team={objective.ownerTeam} data-objective-side={side}
        data-objective-contested={contested ? '' : undefined} data-objective-destroyed={destroyed ? '' : undefined}
        style={{left: position.left, top: position.top,
          backgroundImage: objectiveAsset ? `url('/${objectiveAsset}')` : undefined}}
        title={`${objective.kind === 'CAPTURE' ? '占领点' : '破坏目标'} ${objective.hp}/${objective.maxHp}`} />;
    })}
    {bounds && snapshot.players.filter(player => player.alive).map(player => {
      const position = project(player.x, player.z);
      if (!position) return null;
      const vip = snapshot.mode === 3 && player.isVIP && vipAsset
        ? <img className="hud-minimap-vip" data-source-asset={vipAsset} src={`/${vipAsset}`} alt="" /> : null;
      if (player.id === snapshot.localPlayerId) {
        return <span key={player.id} className="hud-minimap-local" data-player-id={player.id}
          style={{left: position.left, top: position.top, transform: 'translate(-50%, -50%)'}}>
          {tankAsset && <span className="hud-minimap-local-image" data-source-asset={tankAsset}
            style={{maskImage: `url('/${tankAsset}')`, transform: `rotate(${player.yaw}rad)`}} />}
          {vip}
        </span>;
      }
      const friendly = teamMode && !!local && player.team === local.team;
      return <span key={player.id} className="hud-minimap-actor" data-player-id={player.id}
        data-actor-side={friendly ? 'friend' : 'enemy'}
        data-vip={snapshot.mode === 3 && player.isVIP ? '' : undefined}
        style={{left: position.left, top: position.top, transform: 'translate(-50%, -50%)'}}>
        {actorAsset && <span className="hud-minimap-actor-image" data-source-asset={actorAsset}
          style={{maskImage: `url('/${actorAsset}')`, transform: `rotate(${player.yaw}rad)`}} />}
        {vip}
      </span>;
    })}
    </div>
    <div className="hud-minimap-bound" data-source-control="picMiniMapBound" data-source-layout="ui/layouts/game_main.xml">
      {frame.map(({name, asset}) => asset && <img key={name} className={`hud-minimap-frame ${frameClass(name)}`}
        src={`/${asset}`} alt="" aria-hidden="true" />)}
    </div>
  </div>;
}

function frameClass(name: typeof BOUND_FRAME[number]): string {
  return `hud-minimap-frame-${name.replace('FrameImage', '').toLowerCase()}`;
}

/** Original capture ownership reads as own team vs the local team; neutral stays unowned. */
function objectiveSide(ownerTeam: number, localTeam: number | undefined, teamMode: boolean):
'friend' | 'enemy' | 'neutral' {
  if (ownerTeam < 0 || !teamMode || localTeam === undefined) return 'neutral';
  return ownerTeam === localTeam ? 'friend' : 'enemy';
}
