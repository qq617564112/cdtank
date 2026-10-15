import {drawImageRegion} from '../assets/image-resources';
import {ArcRotateCamera, DynamicTexture, Scene, Texture, Vector2, Vector4} from '@babylonjs/core';
import type {UtilityLayerRenderer} from '@babylonjs/core';
import type {MsgRoomSnapshot} from '../../../shared/protocols/MsgRoomSnapshot';
import {isHiddenFromOpponent} from '../../../shared/combat/optical-camouflage';
import {canObserveRadarMarker} from '../../../shared/combat/radar-observation';
import type {TankView} from '../assets/tanks/tank-view';
import {decodeImageRegion} from '../assets/image-resources';
import {tankMinimapIcons, type TankMinimapSide} from '../assets/tanks/minimap-icons';
import {activeBattleQuality} from '../assets/battle-artwork';
import {isMobileDevice} from '../platform/device';
import type {SourceUi} from '../interface/battle/battle-hud';
import {sourceAsset} from '../interface/battle/hud-source-controls';
import {HUD_MINIMAP_SCALE, HUD_MINIMAP_SIZE,
  hudMinimapBounds, hudMinimapLocalPositionToRef, type HudMinimapCamera} from '../interface/battle/hud-minimap-bounds';
import {BattleScreenQuads, createBattleScreenLayer, loadBattleOverlayImage, WHITE, type ScreenColour, type ScreenUv} from './battle-screen-quads';

const MARKERS = [
  {name: 'diaobao', x: 0, width: 13, height: 13},
] as const;
const VIP_MARKER = {x: 32, width: 26, height: 14};
const FONT = "'CDTank-Xiangjiao', sans-serif";
const FRAME_PADDING = 8;
const FRAME_SIZE = HUD_MINIMAP_SIZE + FRAME_PADDING * 2;
const TANK_ICON_SIZE = 64;
const TANK_ICON_CELL = 72;
const TANK_ICON_COLUMNS = 14;
const TANK_SIDES: readonly TankMinimapSide[] = ['self', 'enemy', 'friend'];
const MOBILE_ARROWS = [
  {x: 80, colour: '#49bbff'},
  {x: 112, colour: '#ff6054'},
] as const;
const MOBILE_ARROW_SIZE = 24;
const FRIEND: ScreenColour = [.502, .675, .969, 1];
const ENEMY: ScreenColour = [.961, .494, .471, 1];
const DESTROYED: ScreenColour = [.4, .4, .4, 1];
const FULL_UV: ScreenUv = [0, 0, 1, 1];

export interface MobileMinimapBounds {left: number; top: number; size: number;}

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
  vec3 colour = vec3(0.0784, 0.1451, 0.1098);
  vec2 offset = (vUv - 0.5) * worldSize;
  vec2 world = cameraCentre + cameraAxes.xy * offset.x - cameraAxes.zw * offset.y;
  vec2 mapUv = vec2((world.x - mapBounds.x) / (mapBounds.y - mapBounds.x),
    (mapBounds.w - world.y) / (mapBounds.w - mapBounds.z));
  // Implicit-LOD sampling requires uniform control flow in WebGPU.
  vec4 terrain = texture2D(image, mapUv);
  if (distance >= 90.0) discard;
  if (hasMap > 0.5 && mapUv.x >= 0.0 && mapUv.x <= 1.0 && mapUv.y >= 0.0 && mapUv.y <= 1.0) {
    colour = mix(colour, terrain.rgb, terrain.a);
  }
  gl_FragColor = vec4(colour, 1.0 - smoothstep(89.5, 90.0, distance));
}`;

/** Circular radar draws terrain, its rotating frame, then unobstructed markers. */
export class BattleMinimapRenderer {
  private readonly mobile = isMobileDevice();
  private readonly density = this.mobile || activeBattleQuality() === 'original' ? 1 : 4;
  private readonly atlasWidth = (this.mobile ? 144 : 1024) * this.density;
  private readonly atlasHeight = (this.mobile ? 32 : 512) * this.density;
  private readonly frameTextureSize = FRAME_SIZE * this.density;
  private readonly objectiveUv: ScreenUv = [0, 0,
    13 * this.density / this.atlasWidth, 13 * this.density / this.atlasHeight];
  private readonly vipUv: ScreenUv = [VIP_MARKER.x * this.density / this.atlasWidth, 0,
    (VIP_MARKER.x + VIP_MARKER.width) * this.density / this.atlasWidth,
    VIP_MARKER.height * this.density / this.atlasHeight];
  private readonly arrowUvs: readonly ScreenUv[] = MOBILE_ARROWS.map((arrow): ScreenUv => [
    arrow.x * this.density / this.atlasWidth, 0,
    (arrow.x + MOBILE_ARROW_SIZE) * this.density / this.atlasWidth,
    MOBILE_ARROW_SIZE * this.density / this.atlasHeight,
  ]);
  private mobileBounds?: MobileMinimapBounds;

  setMobileBounds(bounds: MobileMinimapBounds | undefined): void {this.mobileBounds = bounds;}
  private readonly layer: UtilityLayerRenderer;
  private readonly icons: DynamicTexture;
  private readonly terrain: BattleScreenQuads;
  private readonly frameTexture: DynamicTexture;
  private readonly frame: BattleScreenQuads;
  private readonly markers: BattleScreenQuads;
  private readonly tankUvs = new Map<string, ScreenUv>();
  private readonly cameraCentre = new Vector2();
  private readonly cameraAxes = new Vector4();
  private readonly mapBounds = new Vector4();
  private readonly axes: HudMinimapCamera = {x: 0, z: 0, forwardX: 0, forwardZ: 0, rightX: 0, rightZ: 0};
  private readonly markerPosition = {left: 0, top: 0, atEdge: false};
  private image?: Texture;
  private mapId?: number;
  private ready = false;
  private disposed = false;
  private loading?: Promise<void>;

  constructor(private readonly scene: Scene, private readonly camera: ArcRotateCamera,
    private readonly viewFor: (id: string) => TankView | undefined) {
    this.layer = createBattleScreenLayer(scene);
    this.icons = new DynamicTexture('minimap-markers', {width: this.atlasWidth, height: this.atlasHeight}, this.layer.utilityLayerScene, false, Texture.BILINEAR_SAMPLINGMODE);
    this.icons.hasAlpha = true;
    this.icons.wrapU = this.icons.wrapV = Texture.CLAMP_ADDRESSMODE;
    this.markers = new BattleScreenQuads(this.layer.utilityLayerScene, 'minimap-markers', this.icons, 2);
    this.terrain = new BattleScreenQuads(this.layer.utilityLayerScene, 'minimap-terrain', this.icons, 0, TERRAIN_FRAGMENT,
      ['cameraCentre', 'cameraAxes', 'mapBounds', 'worldSize', 'hasMap']);
    this.terrain.material.setFloat('worldSize', HUD_MINIMAP_SIZE / HUD_MINIMAP_SCALE);
    this.frameTexture = new DynamicTexture('minimap-frame', {width: this.frameTextureSize, height: this.frameTextureSize},
      this.layer.utilityLayerScene, false, Texture.BILINEAR_SAMPLINGMODE);
    this.frameTexture.hasAlpha = true;
    this.frameTexture.wrapU = this.frameTexture.wrapV = Texture.CLAMP_ADDRESSMODE;
    this.frame = new BattleScreenQuads(this.layer.utilityLayerScene, 'minimap-frame', this.frameTexture, 1);
    scene.onDisposeObservable.addOnce(() => {this.dispose();});
  }

  load(data: SourceUi): Promise<void> {
    if (this.ready) return Promise.resolve();
    this.loading ??= (async () => {
      const [images, tanks, frameImage] = await Promise.all([
        Promise.all(MARKERS.map(marker => {
          const asset = sourceAsset(data, `set:zhandou00 image:data\\ui\\zhandou\\${marker.name}.tga`);
          if (!asset) throw new Error(`小地图标记资源缺失：${marker.name}`);
          return loadBattleOverlayImage(asset);
        })),
        Promise.all((this.mobile ? [] : Object.entries(tankMinimapIcons)).flatMap(([tankId, variants]) =>
          TANK_SIDES.map(async side => ({key: `${tankId}:${side}`, image: await decodeImageRegion(variants[side])})))),
        loadBattleOverlayImage('ui/battle/minimap-frame.webp'),
        document.fonts.load(`12px ${FONT}`, 'VIP'),
      ]);
      if (this.disposed) return;
      const context = this.icons.getContext() as CanvasRenderingContext2D;
      context.clearRect(0, 0, this.atlasWidth, this.atlasHeight);
      MARKERS.forEach((marker, index) => {
        drawImageRegion(context, images[index], marker.x * this.density, 0,
          marker.width * this.density, marker.height * this.density);
      });
      context.save();
      context.scale(this.density, this.density);
      context.font = `12px ${FONT}`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillStyle = '#ffe17a';
      context.strokeStyle = '#000';
      context.lineWidth = 1;
      context.lineJoin = 'round';
      const vipX = VIP_MARKER.x + VIP_MARKER.width / 2;
      const vipY = VIP_MARKER.height / 2;
      context.strokeText('VIP', vipX, vipY, VIP_MARKER.width - 2);
      context.fillText('VIP', vipX, vipY, VIP_MARKER.width - 2);
      for (const arrow of MOBILE_ARROWS) {
        context.beginPath();
        context.moveTo(arrow.x + 12, 2);
        context.lineTo(arrow.x + 22, 21);
        context.lineTo(arrow.x + 12, 16);
        context.lineTo(arrow.x + 2, 21);
        context.closePath();
        context.fillStyle = arrow.colour;
        context.strokeStyle = '#14291f';
        context.lineWidth = 1.5;
        context.fill();
        context.stroke();
      }
      context.restore();
      tanks.forEach((tank, index) => {
        const left = (index % TANK_ICON_COLUMNS * TANK_ICON_CELL + 4) * this.density;
        const top = (32 + Math.floor(index / TANK_ICON_COLUMNS) * TANK_ICON_CELL + 4) * this.density;
        const size = TANK_ICON_SIZE * this.density;
        drawImageRegion(context, tank.image, left, top, size, size);
        this.tankUvs.set(tank.key, [left / this.atlasWidth, top / this.atlasHeight,
          (left + size) / this.atlasWidth, (top + size) / this.atlasHeight]);
      });
      this.icons.update(false);
      const frameCanvas = document.createElement('canvas');
      frameCanvas.width = frameCanvas.height = HUD_MINIMAP_SIZE * this.density;
      const frameContext = frameCanvas.getContext('2d');
      if (!frameContext) throw new Error('小地图边框画布创建失败');
      frameContext.filter = 'grayscale(1) sepia(1) saturate(2) brightness(1.02)';
      drawImageRegion(frameContext, frameImage, 0, 0, frameCanvas.width, frameCanvas.height);
      const frameAtlas = this.frameTexture.getContext();
      frameAtlas.clearRect(0, 0, this.frameTextureSize, this.frameTextureSize);
      frameAtlas.shadowColor = 'rgba(25, 26, 13, 0.45)';
      frameAtlas.shadowOffsetY = 2 * this.density;
      frameAtlas.shadowBlur = 4 * this.density;
      frameAtlas.drawImage(frameCanvas, FRAME_PADDING * this.density, FRAME_PADDING * this.density);
      this.frameTexture.update(false);
      this.ready = true;
    })().finally(() => {this.loading = undefined;});
    return this.loading;
  }

  hasMap(mapId: number): boolean {return this.mapId === mapId && this.image !== undefined;}

  async setMap(mapId: number, imageUrl: string): Promise<void> {
    this.image?.dispose();
    this.mapId = mapId;
    await new Promise<void>((resolve, reject) => {
      const image = new Texture(imageUrl, this.layer.utilityLayerScene, false, false, Texture.BILINEAR_SAMPLINGMODE,
        () => resolve(), (_message, error) => {image.dispose(); reject(error ?? new Error('小地图图片载入失败'));});
      this.image = image;
      image.wrapU = image.wrapV = Texture.CLAMP_ADDRESSMODE;
      this.terrain.material.setTexture('image', image);
    });
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
    const mobile = this.mobileBounds;
    let scale: number, x: number, y: number;
    if (mobile) {
      const canvas = engine.getRenderingCanvas()!.getBoundingClientRect();
      scale = mobile.size / HUD_MINIMAP_SIZE * width / canvas.width;
      x = (mobile.left - canvas.left) * width / canvas.width;
      y = (mobile.top - canvas.top) * height / canvas.height;
    } else {
      scale = Math.min(width / 800, height / 600);
      x = width - HUD_MINIMAP_SIZE * scale;
      y = (height - 600 * scale) / 2 + 408 * scale;
    }
    const target = this.camera.getTarget();
    const forwardX = this.camera.position.x - target.x, forwardZ = target.z - this.camera.position.z;
    const length = Math.hypot(forwardX, forwardZ);
    const rightSign = this.scene.useRightHandedSystem ? 1 : -1;
    const axes = this.axes;
    axes.x = -view.root.position.x; axes.z = view.root.position.z;
    axes.forwardX = forwardX / length; axes.forwardZ = forwardZ / length;
    axes.rightX = rightSign * forwardZ / length; axes.rightZ = -rightSign * forwardX / length;
    this.terrain.begin(width, height);
    this.cameraCentre.set(axes.x, axes.z);
    this.cameraAxes.set(axes.rightX, axes.rightZ, axes.forwardX, axes.forwardZ);
    this.mapBounds.set(bounds.minX, bounds.maxX, bounds.minZ, bounds.maxZ);
    this.terrain.material.setVector2('cameraCentre', this.cameraCentre);
    this.terrain.material.setVector4('cameraAxes', this.cameraAxes);
    this.terrain.material.setVector4('mapBounds', this.mapBounds);
    this.terrain.material.setFloat('hasMap', this.image?.isReady() ? 1 : 0);
    this.terrain.quad(x, y, HUD_MINIMAP_SIZE * scale, HUD_MINIMAP_SIZE * scale, FULL_UV);
    this.terrain.end();
    this.frame.begin(width, height);
    this.frame.quad(x - FRAME_PADDING * scale, y - FRAME_PADDING * scale,
      FRAME_SIZE * scale, FRAME_SIZE * scale, FULL_UV, WHITE, false,
      Math.atan2(axes.rightZ, axes.forwardZ));
    this.frame.end();
    this.markers.begin(width, height);
    const position = this.markerPosition;
    for (const objective of snapshot.match?.objectives ?? []) {
      hudMinimapLocalPositionToRef(axes, objective.x, objective.z, position);
      const markerX = x + position.left * scale, markerY = y + position.top * scale;
      const colour: ScreenColour = objective.hp <= 0 ? DESTROYED
        : objective.contested || objective.ownerTeam < 0 || snapshot.mode > 3 ? WHITE
        : objective.ownerTeam === local.team ? FRIEND : ENEMY;
      this.markers.quad(markerX - 6.5 * scale, markerY - 6.5 * scale, 13 * scale, 13 * scale, this.objectiveUv, colour, true);
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
      const icon = this.mobile ? this.arrowUvs[side === 'enemy' ? 1 : 0]
        : this.tankUvs.get(`${actor?.tankId ?? player.tankId}:${side}`);
      if (!icon) continue;
      const iconSize = isLocal ? 26 : 24;
      if (isLocal) {
        position.left = position.top = HUD_MINIMAP_SIZE / 2;
        position.atEdge = false;
      } else hudMinimapLocalPositionToRef(axes, worldX, worldZ, position);
      const markerX = x + position.left * scale, markerY = y + position.top * scale;
      const yaw = actor ? -actor.root.rotation.y : player.bodyYaw ?? player.yaw;
      const angle = Math.atan2(Math.sin(yaw) * axes.rightX + Math.cos(yaw) * axes.rightZ,
        Math.sin(yaw) * axes.forwardX + Math.cos(yaw) * axes.forwardZ);
      this.markers.quad(markerX - iconSize / 2 * scale, markerY - iconSize / 2 * scale,
        iconSize * scale, iconSize * scale, icon, WHITE, false, angle);
      if (vip) this.markers.quad(markerX - VIP_MARKER.width / 2 * scale,
        markerY - (iconSize / 2 + VIP_MARKER.height + 2) * scale,
        VIP_MARKER.width * scale, VIP_MARKER.height * scale, this.vipUv);
    }
    this.markers.end();
  }

  clear(): void {
    this.layer.shouldRender = false;
    this.terrain.clear();
    this.frame.clear();
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
    this.frame.dispose();
    this.frameTexture.dispose();
    this.markers.dispose();
    this.icons.dispose();
    this.layer.dispose();
  }
}
