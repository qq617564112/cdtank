import {ArcRotateCamera, DynamicTexture, Scene, Texture, Vector2, Vector4} from '@babylonjs/core';
import type {UtilityLayerRenderer} from '@babylonjs/core';
import type {MsgRoomSnapshot} from '../../../shared/protocols/MsgRoomSnapshot';
import {isHiddenFromOpponent} from '../../../shared/combat/optical-camouflage';
import {canObserveRadarMarker} from '../../../shared/combat/radar-observation';
import type {TankView} from '../assets/tanks/tank-view';
import {decodeImage} from '../assets/image-resources';
import {tankMinimapIcons, type TankMinimapSide} from '../assets/tanks/minimap-icons';
import type {SourceUi} from '../interface/battle/battle-hud';
import {sourceAsset} from '../interface/battle/hud-source-controls';
import {HUD_MINIMAP_SCALE, HUD_MINIMAP_SIZE,
  hudMinimapBounds, hudMinimapLocalPosition} from '../interface/battle/hud-minimap-bounds';
import {BattleScreenQuads, createBattleScreenLayer, loadBattleOverlayImage, type ScreenColour, type ScreenUv} from './battle-screen-quads';

const MARKERS = [
  {name: 'diaobao', x: 0, width: 13, height: 13},
  {name: 'viptanke', x: 32, width: 19, height: 8},
] as const;
const ATLAS_DENSITY = 4;
const ATLAS_WIDTH = 1024 * ATLAS_DENSITY;
const ATLAS_HEIGHT = 512 * ATLAS_DENSITY;
const TANK_ICON_SIZE = 64;
const TANK_ICON_CELL = 72;
const TANK_ICON_COLUMNS = 14;
const TANK_SIDES: readonly TankMinimapSide[] = ['self', 'enemy', 'friend'];
const OBJECTIVE: ScreenUv = [0, 0, 13 * ATLAS_DENSITY / ATLAS_WIDTH, 13 * ATLAS_DENSITY / ATLAS_HEIGHT];
const VIP: ScreenUv = [32 * ATLAS_DENSITY / ATLAS_WIDTH, 0,
  51 * ATLAS_DENSITY / ATLAS_WIDTH, 8 * ATLAS_DENSITY / ATLAS_HEIGHT];
const FRIEND: ScreenColour = [.502, .675, .969, 1];
const ENEMY: ScreenColour = [.961, .494, .471, 1];

const TERRAIN_FRAGMENT = `
precision highp float;
uniform sampler2D image;
uniform vec2 cameraCentre;
uniform vec4 cameraAxes;
uniform vec4 mapBounds;
uniform float worldSize;
uniform float hasMap;
varying vec2 vUv;
void main() {
  float distance = length(vUv - 0.5) * 192.0;
  if (distance >= 96.0) discard;
  vec3 colour = vec3(0.0784, 0.1451, 0.1098);
  vec2 offset = (vUv - 0.5) * worldSize;
  vec2 world = cameraCentre + cameraAxes.xy * offset.x - cameraAxes.zw * offset.y;
  vec2 mapUv = vec2((world.x - mapBounds.x) / (mapBounds.y - mapBounds.x),
    (mapBounds.w - world.y) / (mapBounds.w - mapBounds.z));
  if (hasMap > 0.5 && mapUv.x >= 0.0 && mapUv.x <= 1.0 && mapUv.y >= 0.0 && mapUv.y <= 1.0) {
    vec4 terrain = texture2D(image, mapUv);
    colour = mix(colour, terrain.rgb, terrain.a);
  }
  if (distance >= 90.0) colour = vec3(0.0667);
  else if (distance >= 89.0) colour = vec3(0.706, 0.710, 0.639);
  gl_FragColor = vec4(colour, 1.0 - smoothstep(95.5, 96.0, distance));
}`;

/** Circular radar draws its terrain and all markers in two GPU batches. */
export class BattleMinimapRenderer {
  private readonly layer: UtilityLayerRenderer;
  private readonly icons: DynamicTexture;
  private readonly terrain: BattleScreenQuads;
  private readonly markers: BattleScreenQuads;
  private readonly tankUvs = new Map<string, ScreenUv>();
  private image?: Texture;
  private mapId?: number;
  private ready = false;
  private disposed = false;
  private loading?: Promise<void>;

  constructor(private readonly scene: Scene, private readonly camera: ArcRotateCamera,
    private readonly viewFor: (id: string) => TankView | undefined) {
    this.layer = createBattleScreenLayer(scene);
    this.icons = new DynamicTexture('minimap-markers', {width: ATLAS_WIDTH, height: ATLAS_HEIGHT}, this.layer.utilityLayerScene, false, Texture.BILINEAR_SAMPLINGMODE);
    this.icons.hasAlpha = true;
    this.markers = new BattleScreenQuads(this.layer.utilityLayerScene, 'minimap-markers', this.icons, 1);
    this.terrain = new BattleScreenQuads(this.layer.utilityLayerScene, 'minimap-terrain', this.icons, 0, TERRAIN_FRAGMENT,
      ['cameraCentre', 'cameraAxes', 'mapBounds', 'worldSize', 'hasMap']);
    this.terrain.material.setFloat('worldSize', HUD_MINIMAP_SIZE / HUD_MINIMAP_SCALE);
    scene.onDisposeObservable.addOnce(() => {this.dispose();});
  }

  load(data: SourceUi): Promise<void> {
    if (this.ready) return Promise.resolve();
    this.loading ??= (async () => {
      const [images, tanks] = await Promise.all([
        Promise.all(MARKERS.map(marker => {
          const asset = sourceAsset(data, `set:zhandou00 image:data\\ui\\zhandou\\${marker.name}.tga`);
          if (!asset) throw new Error(`小地图标记资源缺失：${marker.name}`);
          return loadBattleOverlayImage(asset);
        })),
        Promise.all(Object.entries(tankMinimapIcons).flatMap(([tankId, variants]) =>
          TANK_SIDES.map(async side => ({key: `${tankId}:${side}`, image: await decodeImage(variants[side])})))),
      ]);
      if (this.disposed) return;
      const context = this.icons.getContext();
      context.clearRect(0, 0, ATLAS_WIDTH, ATLAS_HEIGHT);
      MARKERS.forEach((marker, index) => {
        context.drawImage(images[index], marker.x * ATLAS_DENSITY, 0,
          marker.width * ATLAS_DENSITY, marker.height * ATLAS_DENSITY);
      });
      tanks.forEach((tank, index) => {
        const left = (index % TANK_ICON_COLUMNS * TANK_ICON_CELL + 4) * ATLAS_DENSITY;
        const top = (32 + Math.floor(index / TANK_ICON_COLUMNS) * TANK_ICON_CELL + 4) * ATLAS_DENSITY;
        const size = TANK_ICON_SIZE * ATLAS_DENSITY;
        context.drawImage(tank.image, left, top, size, size);
        this.tankUvs.set(tank.key, [left / ATLAS_WIDTH, top / ATLAS_HEIGHT,
          (left + size) / ATLAS_WIDTH, (top + size) / ATLAS_HEIGHT]);
      });
      this.icons.update(false);
      this.ready = true;
    })().finally(() => {this.loading = undefined;});
    return this.loading;
  }

  hasMap(mapId: number): boolean {return this.mapId === mapId && this.image !== undefined;}

  setMap(mapId: number, imageUrl: string): void {
    this.image?.dispose();
    this.mapId = mapId;
    this.image = new Texture(imageUrl, this.layer.utilityLayerScene, false, false, Texture.BILINEAR_SAMPLINGMODE);
    this.image.wrapU = this.image.wrapV = Texture.CLAMP_ADDRESSMODE;
    this.terrain.material.setTexture('image', this.image);
  }

  render(snapshot: MsgRoomSnapshot, playerId: string): void {
    const local = snapshot.players.find(player => player.id === playerId);
    const view = this.viewFor(playerId);
    const bounds = this.mapId === undefined ? undefined : hudMinimapBounds(this.mapId);
    this.layer.shouldRender = this.ready && !!bounds && !!view && !!local
      && (snapshot.phase === 'PLAYING' || snapshot.phase === 'FINISHED');
    if (!this.layer.shouldRender || !bounds || !view || !local) return;
    const engine = this.scene.getEngine();
    const width = engine.getRenderWidth(), height = engine.getRenderHeight();
    const scale = Math.min(width / 800, height / 600);
    const x = width - HUD_MINIMAP_SIZE * scale;
    const y = (height - 600 * scale) / 2 + 408 * scale;
    const target = this.camera.getTarget();
    const forwardX = this.camera.position.x - target.x, forwardZ = target.z - this.camera.position.z;
    const length = Math.hypot(forwardX, forwardZ);
    const rightSign = this.scene.useRightHandedSystem ? 1 : -1;
    const axes = {x: -view.root.position.x, z: view.root.position.z,
      forwardX: forwardX / length, forwardZ: forwardZ / length,
      rightX: rightSign * forwardZ / length, rightZ: -rightSign * forwardX / length};
    this.terrain.begin(width, height);
    this.terrain.material.setVector2('cameraCentre', new Vector2(axes.x, axes.z));
    this.terrain.material.setVector4('cameraAxes', new Vector4(axes.rightX, axes.rightZ, axes.forwardX, axes.forwardZ));
    this.terrain.material.setVector4('mapBounds', new Vector4(bounds.minX, bounds.maxX, bounds.minZ, bounds.maxZ));
    this.terrain.material.setFloat('hasMap', this.image?.isReady() ? 1 : 0);
    this.terrain.quad(x, y, HUD_MINIMAP_SIZE * scale, HUD_MINIMAP_SIZE * scale, [0, 0, 1, 1]);
    this.terrain.end();
    this.markers.begin(width, height);
    const place = (worldX: number, worldZ: number) => {
      const position = hudMinimapLocalPosition(axes, worldX, worldZ);
      return {x: x + position.left * scale, y: y + position.top * scale};
    };
    for (const objective of snapshot.match?.objectives ?? []) {
      const position = place(objective.x, objective.z);
      const colour: ScreenColour = objective.hp <= 0 ? [.4, .4, .4, 1]
        : objective.contested || objective.ownerTeam < 0 || snapshot.mode > 3 ? [1, 1, 1, 1]
        : objective.ownerTeam === local.team ? FRIEND : ENEMY;
      this.markers.quad(position.x - 6.5 * scale, position.y - 6.5 * scale, 13 * scale, 13 * scale, OBJECTIVE, colour, true);
    }
    for (const player of snapshot.players) {
      if ((!player.alive && player.id !== playerId) || isHiddenFromOpponent(player, local, snapshot.mode)) continue;
      if (!canObserveRadarMarker(local, player, snapshot.mode)) continue;
      const actor = this.viewFor(player.id);
      const worldX = actor ? -actor.root.position.x : player.x;
      const worldZ = actor?.root.position.z ?? player.z;
      const vip = snapshot.mode === 3 && player.isVIP;
      const isLocal = player.id === playerId;
      const side: TankMinimapSide = isLocal ? 'self'
        : snapshot.mode <= 3 && player.team === local.team ? 'friend' : 'enemy';
      const icon = this.tankUvs.get(`${actor?.tankId ?? player.tankId}:${side}`);
      if (!icon) continue;
      const iconSize = isLocal ? 26 : 24;
      const position = isLocal
        ? {x: x + HUD_MINIMAP_SIZE / 2 * scale, y: y + HUD_MINIMAP_SIZE / 2 * scale}
        : place(worldX, worldZ);
      const yaw = actor ? -actor.root.rotation.y : player.bodyYaw ?? player.yaw;
      const angle = Math.atan2(Math.sin(yaw) * axes.rightX + Math.cos(yaw) * axes.rightZ,
        Math.sin(yaw) * axes.forwardX + Math.cos(yaw) * axes.forwardZ);
      this.markers.quad(position.x - iconSize / 2 * scale, position.y - iconSize / 2 * scale,
        iconSize * scale, iconSize * scale, icon, [1, 1, 1, 1], false, angle);
      if (vip) this.markers.quad(position.x - 9.5 * scale, position.y - (iconSize / 2 + 10) * scale,
        19 * scale, 8 * scale, VIP);
    }
    this.markers.end();
  }

  clear(): void {
    this.layer.shouldRender = false;
    this.terrain.clear();
    this.markers.clear();
    this.terrain.material.setTexture('image', this.icons);
    this.image?.dispose();
    this.image = undefined;
    this.mapId = undefined;
  }

  private dispose(): void {
    this.disposed = true;
    this.clear();
    this.terrain.dispose();
    this.markers.dispose();
    this.icons.dispose();
    this.layer.dispose();
  }
}
