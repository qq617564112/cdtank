import './battle-player-labels.css';
import {ArcRotateCamera, Frustum, Matrix, Scene, Vector3, Viewport} from '@babylonjs/core';
import type {PlayerSnapshot} from '../../../shared/protocols/MsgRoomSnapshot';
import {isHiddenByOpticalCamouflage} from '../../../shared/combat/optical-camouflage';
import type {TankView} from '../assets/tanks/tank-view';

interface LabelEntry {
  root: HTMLDivElement;
  title: HTMLSpanElement;
  name: HTMLSpanElement;
  vip: HTMLSpanElement;
  fill: HTMLSpanElement;
  health: HTMLSpanElement;
  view?: TankView;
  headOffset?: number;
}

const SOURCE_WIDTH = 800;
const SOURCE_HEIGHT = 600;
const HEAD_OFFSET = 8;
const FALLBACK_HEAD_Y = 55;
/** Original title table ID 1 is the requested fallback for players without a worn title. */
const DEFAULT_PLAYER_TITLE = '嗷嗷待哺';

/** Non-interactive DOM nameplates for all visible alive battle tanks. */
export class BattlePlayerLabels {
  private readonly entries = new Map<string, LabelEntry>();
  private layer?: HTMLDivElement;
  private players: readonly PlayerSnapshot[] = [];
  private localPlayerId?: string;
  private mode = 1;
  private playing = true;

  constructor(private readonly scene: Scene, private readonly camera: ArcRotateCamera,
              private readonly hiddenByDisguise: (id: string) => boolean) {
  }

  reconcile(players: readonly PlayerSnapshot[], localPlayerId: string | undefined,
            mode: number, playing: boolean): void {
    this.players = players;
    this.localPlayerId = localPlayerId;
    this.mode = mode;
    this.playing = playing;
    if (!playing) {
      this.hideAll();
      return;
    }
    if (!this.layer) return;
    const present = new Set(players.map(player => player.id));
    for (const [id, entry] of this.entries) {
      if (present.has(id)) continue;
      entry.root.remove();
      this.entries.delete(id);
    }
  }

  render(views: ReadonlyMap<string, TankView>, localPlayerId: string | undefined, playing: boolean): void {
    this.localPlayerId = localPlayerId;
    if (this.playing !== playing) {
      this.playing = playing;
      if (!playing) {
        this.hideAll();
        return;
      }
    }
    if (!playing || this.players.length === 0) {
      this.hideAll();
      return;
    }
    const engine = this.scene.getEngine();
    const canvas = engine.getRenderingCanvas();
    if (!canvas || typeof document === 'undefined') {
      this.hideAll();
      return;
    }
    this.mountLayer();
    const renderWidth = engine.getRenderWidth();
    const renderHeight = engine.getRenderHeight();
    const rect = canvas.getBoundingClientRect();
    if (!rect || renderWidth <= 0 || renderHeight <= 0 || rect.width <= 0 || rect.height <= 0) {
      this.hideAll();
      return;
    }
    const scale = Math.min(rect.width / SOURCE_WIDTH, rect.height / SOURCE_HEIGHT);
    const observer = this.localPlayerId
      ? this.players.find(value => value.id === this.localPlayerId)
      : undefined;
    const viewport = new Viewport(0, 0, renderWidth, renderHeight);
    const planes = Frustum.GetPlanes(this.camera.getTransformationMatrix());
    const transformation = this.camera.getTransformationMatrix();
    const observerView = this.localPlayerId ? views.get(this.localPlayerId) : undefined;
    const referenceDistance = observerView
      ? Vector3.Distance(this.camera.globalPosition, observerView.root.position) : this.camera.radius;
    const present = new Set<string>();

    for (const player of this.players) {
      present.add(player.id);
      const entry = this.entry(player.id);
      this.updateText(entry, player);
      const view = views.get(player.id);
      const visible = player.alive && view?.root.isEnabled()
        && !this.hiddenByDisguise(player.id)
        && !isHiddenByOpticalCamouflage(player, observer, this.mode);
      if (!visible || !view) {
        entry.root.hidden = true;
        continue;
      }
      if (entry.view !== view) {
        entry.view = view;
        entry.headOffset = this.headOffset(view);
      }
      const head = new Vector3(view.root.position.x, view.root.position.y + (entry.headOffset ?? FALLBACK_HEAD_Y), view.root.position.z);
      if (planes.some(plane => plane.dotCoordinate(head) <= 0)) {
        entry.root.hidden = true;
        continue;
      }
      const point = Vector3.Project(head, Matrix.Identity(), transformation, viewport);
      if (point.x < 0 || point.x > renderWidth || point.y < 0 || point.y > renderHeight) {
        entry.root.hidden = true;
        continue;
      }
      entry.root.hidden = false;
      entry.root.dataset.relation = this.relation(player, observer);
      const distance = Vector3.Distance(this.camera.globalPosition, head);
      const distanceScale = player.id === this.localPlayerId ? 1
        : Math.max(.82, Math.min(1.1, Math.sqrt(referenceDistance / Math.max(1, distance))));
      const labelScale = scale * distanceScale;
      const halfWidth = 56 * labelScale;
      const screenX = rect.left + point.x * rect.width / renderWidth;
      const screenY = rect.top + point.y * rect.height / renderHeight - 5 * scale;
      entry.root.style.left = `${Math.max(rect.left + halfWidth, Math.min(rect.right - halfWidth, screenX))}px`;
      entry.root.style.top = `${Math.max(rect.top + 44 * labelScale, screenY)}px`;
      entry.root.style.transform = `translate(-50%, -100%) scale(${labelScale})`;
      const fraction = player.maxHp > 0 ? Math.max(0, Math.min(1, player.hp / player.maxHp)) : 0;
      entry.fill.style.width = `${fraction * 100}%`;
    }
    for (const [id, entry] of this.entries) {
      if (present.has(id)) continue;
      entry.root.remove();
      this.entries.delete(id);
    }
  }

  resetRound(): void {
    this.clear();
  }

  clear(): void {
    this.entries.forEach(entry => {entry.root.remove();});
    this.entries.clear();
    this.players = [];
    this.localPlayerId = undefined;
  }

  dispose(): void {
    this.clear();
    this.layer?.remove();
    this.layer = undefined;
  }

  private entry(id: string): LabelEntry {
    const existing = this.entries.get(id);
    if (existing) return existing;
    const root = document.createElement('div');
    root.className = 'battle-player-label';
    root.dataset.playerId = id;
    root.dataset.sourceTitleBinding = 'default-title-1';
    const title = document.createElement('span');
    title.className = 'battle-player-label-title';
    title.textContent = DEFAULT_PLAYER_TITLE;
    const name = document.createElement('span');
    name.className = 'battle-player-label-name';
    const vip = document.createElement('span');
    vip.className = 'battle-player-label-vip';
    vip.dataset.sourceAsset = 'ui/regions/77/136.png';
    vip.hidden = true;
    const nameRow = document.createElement('span');
    nameRow.className = 'battle-player-label-name-row';
    nameRow.append(vip, name);
    const bar = document.createElement('span');
    bar.className = 'battle-player-label-bar';
    bar.dataset.sourceAsset = 'ui/regions/77/127.png';
    const fill = document.createElement('span');
    fill.className = 'battle-player-label-fill';
    fill.dataset.sourceAsset = 'ui/regions/77/128.png';
    const health = document.createElement('span');
    health.className = 'battle-player-label-health';
    bar.append(fill, health);
    root.append(title, nameRow, bar);
    this.mountLayer().append(root);
    const entry = {root, title, name, vip, fill, health};
    this.entries.set(id, entry);
    return entry;
  }

  private updateText(entry: LabelEntry, player: PlayerSnapshot): void {
    const title = player.title?.name || DEFAULT_PLAYER_TITLE;
    if (entry.title.textContent !== title) entry.title.textContent = title;
    entry.root.dataset.sourceTitleBinding = player.title?.name ? 'equipped-title' : 'default-title-1';
    entry.vip.hidden = this.mode !== 3 || !player.isVIP;
    if (entry.name.textContent !== player.name) entry.name.textContent = player.name;
    const health = `${player.hp}/${player.maxHp}`;
    if (entry.health.textContent !== health) entry.health.textContent = health;
  }

  private relation(player: PlayerSnapshot, observer: PlayerSnapshot | undefined): 'friend' | 'enemy' {
    if (player.id === this.localPlayerId) return 'friend';
    return this.mode <= 3 && observer && player.team === observer.team ? 'friend' : 'enemy';
  }

  private headOffset(view: TankView): number {
    if (typeof view.root.getHierarchyBoundingVectors !== 'function') return FALLBACK_HEAD_Y;
    const bounds = view.root.getHierarchyBoundingVectors();
    return Number.isFinite(bounds.max.y) ? bounds.max.y - view.root.position.y + HEAD_OFFSET : FALLBACK_HEAD_Y;
  }

  private hideAll(): void {
    this.entries.forEach(entry => {entry.root.hidden = true;});
  }

  private mountLayer(): HTMLDivElement {
    if (this.layer) return this.layer;
    const layer = document.createElement('div');
    layer.className = 'battle-player-labels-layer';
    layer.setAttribute('aria-hidden', 'true');
    document.body.append(layer);
    this.layer = layer;
    return layer;
  }
}
