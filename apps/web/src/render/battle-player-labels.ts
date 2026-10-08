import {ArcRotateCamera, DynamicTexture, Frustum, Matrix, Scene, Texture, Vector3, Viewport} from '@babylonjs/core';
import type {UtilityLayerRenderer} from '@babylonjs/core';
import type {PlayerSnapshot} from '../../../shared/protocols/MsgRoomSnapshot';
import {isHiddenByOpticalCamouflage} from '../../../shared/combat/optical-camouflage';
import type {TankView} from '../assets/tanks/tank-view';
import {BattleScreenQuads, createBattleScreenLayer, loadBattleOverlayImage, type ScreenUv} from './battle-screen-quads';

interface LabelEntry {
  slot: number;
  text?: string;
  health?: string;
  vipX: number;
  view?: TankView;
  headOffset?: number;
}

const SOURCE_WIDTH = 800;
const SOURCE_HEIGHT = 600;
const LABEL_WIDTH = 112;
const LABEL_HEIGHT = 44;
const HEAD_OFFSET = 8;
const FALLBACK_HEAD_Y = 55;
const TEXT_SCALE = 4;
const TILE_WIDTH = 512;
const TILE_HEIGHT = 256;
const ATLAS_WIDTH = TILE_WIDTH * 4;
const ATLAS_HEIGHT = TILE_HEIGHT * 4;
const HEALTH_TILE_HEIGHT = 64;
const HEALTH_ATLAS_HEIGHT = HEALTH_TILE_HEIGHT * 4;
const DEFAULT_PLAYER_TITLE = '嗷嗷待哺';
const FONT = "'CDTank-Xiangjiao', sans-serif";
const BAR_BACKGROUND: ScreenUv = [0, 0, 96 / 256, 4 / 32];
const BAR_FILL: ScreenUv = [0, 8 / 32, 96 / 256, 12 / 32];
const VIP: ScreenUv = [112 / 256, 0, 134 / 256, 12 / 32];

/** GPU nameplates use the rendered tank positions and cache source-font text. */
export class BattlePlayerLabels {
  private readonly entries = new Map<string, LabelEntry>();
  private readonly layer: UtilityLayerRenderer;
  private readonly canvas = document.createElement('canvas');
  private readonly context: CanvasRenderingContext2D;
  private readonly atlas: DynamicTexture;
  private readonly icons: DynamicTexture;
  private readonly healthCanvas = document.createElement('canvas');
  private readonly healthContext: CanvasRenderingContext2D;
  private readonly healthAtlas: DynamicTexture;
  private readonly textQuads: BattleScreenQuads;
  private readonly iconQuads: BattleScreenQuads;
  private readonly healthQuads: BattleScreenQuads;
  private players: readonly PlayerSnapshot[] = [];
  private localPlayerId?: string;
  private mode = 1;
  private freeSlots = Array.from({length: 16}, (_, index) => 15 - index);
  private dirty = false;
  private healthDirty = false;
  private ready = false;
  private disposed = false;
  private loading?: Promise<void>;

  constructor(private readonly scene: Scene, private readonly camera: ArcRotateCamera,
    private readonly hiddenByDisguise: (id: string) => boolean) {
    this.layer = createBattleScreenLayer(scene);
    this.canvas.width = ATLAS_WIDTH;
    this.canvas.height = ATLAS_HEIGHT;
    this.context = this.canvas.getContext('2d')!;
    this.healthCanvas.width = ATLAS_WIDTH;
    this.healthCanvas.height = HEALTH_ATLAS_HEIGHT;
    this.healthContext = this.healthCanvas.getContext('2d')!;
    this.atlas = new DynamicTexture('player-label-text', this.canvas, this.layer.utilityLayerScene, false, Texture.BILINEAR_SAMPLINGMODE);
    this.icons = new DynamicTexture('player-label-icons', {width: 256, height: 32}, this.layer.utilityLayerScene, false, Texture.BILINEAR_SAMPLINGMODE);
    this.healthAtlas = new DynamicTexture('player-label-health', this.healthCanvas, this.layer.utilityLayerScene, false, Texture.BILINEAR_SAMPLINGMODE);
    this.atlas.hasAlpha = this.icons.hasAlpha = this.healthAtlas.hasAlpha = true;
    this.textQuads = new BattleScreenQuads(this.layer.utilityLayerScene, 'player-label-text', this.atlas, 1);
    this.iconQuads = new BattleScreenQuads(this.layer.utilityLayerScene, 'player-label-bars', this.icons, 0);
    this.healthQuads = new BattleScreenQuads(this.layer.utilityLayerScene, 'player-label-health', this.healthAtlas, 2);
  }

  load(): Promise<void> {
    if (this.ready) return Promise.resolve();
    this.loading ??= (async () => {
      const [, background, fill, vip] = await Promise.all([
        document.fonts.load(`13px ${FONT}`),
        loadBattleOverlayImage('ui/regions/77/127.png'),
        loadBattleOverlayImage('ui/regions/77/128.png'),
        loadBattleOverlayImage('ui/regions/77/136.png'),
      ]);
      if (this.disposed) return;
      const context = this.icons.getContext();
      context.clearRect(0, 0, 256, 32);
      context.drawImage(background, 0, 0, 96, 4);
      context.drawImage(fill, 0, 8, 96, 4);
      context.drawImage(vip, 112, 0, 22, 12);
      this.icons.update(false);
      this.ready = true;
      this.updateTexts();
    })().finally(() => {this.loading = undefined;});
    return this.loading;
  }

  reconcile(players: readonly PlayerSnapshot[], localPlayerId: string | undefined,
    mode: number, playing: boolean): void {
    this.players = players;
    this.localPlayerId = localPlayerId;
    this.mode = mode;
    const present = new Set(players.filter(player => player.id !== localPlayerId).map(player => player.id));
    for (const [id, entry] of this.entries) {
      if (present.has(id)) continue;
      this.freeSlots.push(entry.slot);
      this.entries.delete(id);
    }
    this.updateTexts();
    if (!playing) this.layer.shouldRender = false;
  }

  render(views: ReadonlyMap<string, TankView>, localPlayerId: string | undefined, playing: boolean): void {
    this.localPlayerId = localPlayerId;
    this.layer.shouldRender = playing && this.ready && this.players.length > 0;
    if (!this.layer.shouldRender) return;
    const engine = this.scene.getEngine();
    const width = engine.getRenderWidth(), height = engine.getRenderHeight();
    const scale = Math.min(width / SOURCE_WIDTH, height / SOURCE_HEIGHT);
    const viewport = new Viewport(0, 0, width, height);
    const transformation = this.camera.getTransformationMatrix();
    const planes = Frustum.GetPlanes(transformation);
    const observer = this.players.find(player => player.id === localPlayerId);
    const observerView = localPlayerId ? views.get(localPlayerId) : undefined;
    const referenceDistance = observerView
      ? Vector3.Distance(this.camera.globalPosition, observerView.root.position) : this.camera.radius;
    this.textQuads.begin(width, height);
    this.iconQuads.begin(width, height);
    this.healthQuads.begin(width, height);
    for (const player of this.players) {
      if (player.id === localPlayerId) continue;
      const view = views.get(player.id), entry = this.entries.get(player.id);
      if (!entry || !player.alive || !view?.root.isEnabled() || this.hiddenByDisguise(player.id)
        || isHiddenByOpticalCamouflage(player, observer, this.mode)) continue;
      if (entry.view !== view) {
        entry.view = view;
        const bounds = view.root.getHierarchyBoundingVectors();
        entry.headOffset = Number.isFinite(bounds.max.y)
          ? bounds.max.y - view.root.position.y + HEAD_OFFSET : FALLBACK_HEAD_Y;
      }
      const head = new Vector3(view.root.position.x,
        view.root.position.y + entry.headOffset!, view.root.position.z);
      if (planes.some(plane => plane.dotCoordinate(head) <= 0)) continue;
      const point = Vector3.Project(head, Matrix.Identity(), transformation, viewport);
      if (point.x < 0 || point.x > width || point.y < 0 || point.y > height) continue;
      const distance = Vector3.Distance(this.camera.globalPosition, head);
      const labelScale = scale * Math.max(.82, Math.min(1.1, Math.sqrt(referenceDistance / Math.max(1, distance))));
      const labelWidth = LABEL_WIDTH * labelScale, labelHeight = LABEL_HEIGHT * labelScale;
      const x = Math.max(labelWidth / 2, Math.min(width - labelWidth / 2, point.x)) - labelWidth / 2;
      const y = Math.max(labelHeight, point.y - 5 * scale) - labelHeight;
      const tileX = entry.slot % 4 * TILE_WIDTH, tileY = Math.floor(entry.slot / 4) * TILE_HEIGHT;
      this.textQuads.quad(x, y, labelWidth, labelHeight,
        [tileX / ATLAS_WIDTH, tileY / ATLAS_HEIGHT,
          (tileX + LABEL_WIDTH * TEXT_SCALE) / ATLAS_WIDTH, (tileY + LABEL_HEIGHT * TEXT_SCALE) / ATLAS_HEIGHT]);
      const healthY = Math.floor(entry.slot / 4) * HEALTH_TILE_HEIGHT;
      this.healthQuads.quad(x, y + 33 * labelScale, labelWidth, 11 * labelScale,
        [tileX / ATLAS_WIDTH, healthY / HEALTH_ATLAS_HEIGHT,
          (tileX + LABEL_WIDTH * TEXT_SCALE) / ATLAS_WIDTH, (healthY + 11 * TEXT_SCALE) / HEALTH_ATLAS_HEIGHT]);
      this.iconQuads.quad(x + 8 * labelScale, y + 28 * labelScale, 96 * labelScale, 4 * labelScale, BAR_BACKGROUND);
      const fraction = player.maxHp > 0 ? Math.max(0, Math.min(1, player.hp / player.maxHp)) : 0;
      if (fraction > 0) {
        const friendly = this.isFriendly(player, observer);
        this.iconQuads.quad(x + 8 * labelScale, y + 28 * labelScale, 96 * labelScale * fraction, 4 * labelScale,
          [BAR_FILL[0], BAR_FILL[1], BAR_FILL[2] * fraction, BAR_FILL[3]],
          friendly ? [.298, 1, .298, 1] : [1, .298, .247, 1], true);
      }
      if (this.mode === 3 && player.isVIP) {
        this.iconQuads.quad(x + entry.vipX * labelScale,
          y + 15 * labelScale, 22 * labelScale, 12 * labelScale, VIP);
      }
    }
    if (this.dirty) {
      this.atlas.update(false);
      this.dirty = false;
    }
    if (this.healthDirty) {
      this.healthAtlas.update(false);
      this.healthDirty = false;
    }
    this.iconQuads.end();
    this.textQuads.end();
    this.healthQuads.end();
  }

  resetRound(): void {this.clear();}

  clear(): void {
    this.layer.shouldRender = false;
    this.textQuads.clear();
    this.iconQuads.clear();
    this.healthQuads.clear();
    this.entries.clear();
    this.freeSlots = Array.from({length: 16}, (_, index) => 15 - index);
    this.players = [];
    this.localPlayerId = undefined;
    this.context.clearRect(0, 0, ATLAS_WIDTH, ATLAS_HEIGHT);
    this.healthContext.clearRect(0, 0, ATLAS_WIDTH, HEALTH_ATLAS_HEIGHT);
    this.dirty = true;
    this.healthDirty = true;
  }

  dispose(): void {
    this.clear();
    this.disposed = true;
    this.textQuads.dispose();
    this.iconQuads.dispose();
    this.healthQuads.dispose();
    this.atlas.dispose();
    this.icons.dispose();
    this.healthAtlas.dispose();
    this.layer.dispose();
  }

  private updateTexts(): void {
    if (!this.ready) return;
    const observer = this.players.find(player => player.id === this.localPlayerId);
    for (const player of this.players) {
      if (player.id === this.localPlayerId) continue;
      let entry = this.entries.get(player.id);
      if (!entry) {
        entry = {slot: this.freeSlots.pop()!, vipX: 0};
        this.entries.set(player.id, entry);
      }
      const title = player.title?.name || DEFAULT_PLAYER_TITLE;
      const friendly = this.isFriendly(player, observer), vip = this.mode === 3 && player.isVIP;
      const health = `${player.hp}/${player.maxHp}`;
      if (health !== entry.health) {
        entry.health = health;
        const context = this.healthContext;
        const x = entry.slot % 4 * TILE_WIDTH, y = Math.floor(entry.slot / 4) * HEALTH_TILE_HEIGHT;
        context.clearRect(x, y, TILE_WIDTH, HEALTH_TILE_HEIGHT);
        context.save();
        context.translate(x, y);
        context.scale(TEXT_SCALE, TEXT_SCALE);
        context.font = `10px ${FONT}`;
        context.textBaseline = 'top';
        context.fillStyle = '#fff';
        context.shadowColor = '#000';
        context.shadowBlur = 2;
        context.shadowOffsetY = 1;
        const healthX = (LABEL_WIDTH - context.measureText(health).width) / 2;
        context.strokeStyle = '#000';
        context.lineWidth = .8;
        context.strokeText(health, healthX, 0);
        context.fillText(health, healthX, 0);
        context.restore();
        this.healthDirty = true;
      }
      const text = JSON.stringify([title, player.name, friendly, vip]);
      if (text === entry.text) continue;
      entry.text = text;
      const context = this.context;
      const x = entry.slot % 4 * TILE_WIDTH, y = Math.floor(entry.slot / 4) * TILE_HEIGHT;
      context.clearRect(x, y, TILE_WIDTH, TILE_HEIGHT);
      context.save();
      context.translate(x, y);
      context.scale(TEXT_SCALE, TEXT_SCALE);
      context.textBaseline = 'top';
      context.shadowColor = '#000';
      context.shadowBlur = 2;
      context.shadowOffsetY = 1;
      context.strokeStyle = '#000';
      context.font = `12px ${FONT}`;
      context.lineWidth = .96;
      context.fillStyle = '#ffe17a';
      const titleText = this.fitText(title, LABEL_WIDTH - 4);
      const titleX = (LABEL_WIDTH - context.measureText(titleText).width) / 2;
      context.strokeText(titleText, titleX, 0);
      context.fillText(titleText, titleX, 0);
      context.font = `13px ${FONT}`;
      context.lineWidth = 1.04;
      context.fillStyle = friendly ? '#eaffdc' : '#ffe2d8';
      const name = this.fitText(player.name, LABEL_WIDTH - (vip ? 29 : 4));
      const nameX = (LABEL_WIDTH - context.measureText(name).width + (vip ? 25 : 0)) / 2;
      entry.vipX = nameX - 25;
      context.strokeText(name, nameX, 14);
      context.fillText(name, nameX, 14);
      context.restore();
      this.dirty = true;
    }
  }

  private fitText(text: string, width: number): string {
    if (this.context.measureText(text).width <= width) return text;
    const characters = Array.from(text);
    while (characters.length && this.context.measureText(`${characters.join('')}…`).width > width) characters.pop();
    return `${characters.join('')}…`;
  }

  private isFriendly(player: PlayerSnapshot, observer: PlayerSnapshot | undefined): boolean {
    return this.mode <= 3 && observer !== undefined && player.team === observer.team;
  }
}
