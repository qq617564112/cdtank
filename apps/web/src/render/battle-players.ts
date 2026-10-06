import {ArcRotateCamera, Matrix, Scene, Vector3, Viewport} from '@babylonjs/core';
import {TankDamageText} from '../assets/tanks/tank-damage-text';
import {TankBenefitText} from '../assets/tanks/tank-benefit-text';
import {TankBenefitTextRenderer} from './tank-benefit-text-renderer';
import {TankCriticalTextRenderer, type CriticalTextImage} from './tank-critical-text-renderer';
import {TankDamageTextRenderer, type TankDamageTextFont} from './tank-damage-text-renderer';
import {effectModelEngineDelta} from './effects/models/effect-model-animation';
import type {PlayerSnapshot} from '../../../shared/protocols/MsgRoomSnapshot';
import type {ClientTankPose} from '../../../shared/protocols/MsgPlayerInput';
import type {CombatCatalog} from '../../../shared/combat/catalog';
import {isHiddenByOpticalCamouflage} from '../../../shared/combat/optical-camouflage';
import {followBattleCamera} from './battle-camera';
import {TankView} from '../assets/tanks/tank-view';
import {BattleRoleDisguises} from './battle-role-disguises';
import {BattlePlayerLabels} from './battle-player-labels';

interface PlayerEffects {
  attach(view: TankView): void;
  detach(view: TankView): void;
  remove(id: string): void;
  revive(id: string): void;
  queuedParts(id: string, skills: readonly number[], active: boolean): boolean;
  petDeath(view: TankView, petType: number, localView?: TankView): void;
}

/** Owns tank resources and presentation of authoritative player snapshots. */
export class BattlePlayers {
  private readonly players = new Map<string, TankView>();
  private readonly damageTexts = new Map<string, TankDamageText>();
  private readonly benefitTexts = new Map<string, TankBenefitText>();
  private readonly previousHp = new Map<string, number>();
  private benefitTextRenderer?: TankBenefitTextRenderer;
  private damageTextRenderer?: TankDamageTextRenderer;
  private criticalTextRenderer?: TankCriticalTextRenderer;
  private damageTextLoading?: Promise<void>;
  private readonly loading = new Set<string>();
  private readonly previousPositions = new Map<string, {x: number; z: number; alive: boolean}>();
  private readonly presentedLife = new Map<string, boolean>();
  private readonly moving = new Set<string>();
  private snapshot?: readonly PlayerSnapshot[];
  private localPlayerId?: string;
  private mode = 1;
  private playing = true;
  private generation = 0;
  private error = '';
  private ammoCatalog?: CombatCatalog;
  private ammoCatalogLoading?: Promise<CombatCatalog>;
  private readonly disguises: BattleRoleDisguises;
  private readonly labels: BattlePlayerLabels;

  constructor(private readonly scene: Scene, private readonly camera: ArcRotateCamera,
              private readonly effects: PlayerEffects) {
    this.disguises = new BattleRoleDisguises(scene);
    this.labels = new BattlePlayerLabels(scene, camera, id => this.disguises.hidesActor(id));
    this.scene.onDisposeObservable.addOnce(() => {this.clear(); this.labels.dispose();});
  }

  get(id: string): TankView | undefined {return this.players.get(id);}

  get size(): number {return this.players.size;}

  get actions(): Array<{id: string; action: string}> {
    return [...this.players].map(([id, view]) => ({id, action: view.activeAction}));
  }

  get resourcesReady(): boolean {
    return this.snapshot !== undefined && this.snapshot.every(player => this.players.has(player.id));
  }

  get loadingError(): string {return this.disguises.loadingError || this.error;}

  resetRound(players: readonly PlayerSnapshot[]): void {
    this.labels.resetRound();
    this.disguises.clear();
    this.previousPositions.clear();
    this.presentedLife.clear();
    this.moving.clear();
    this.damageTexts.forEach(queue => queue.clear());
    this.benefitTexts.forEach(queue => queue.clear());
    this.previousHp.clear();
    for (const player of players) {
      this.players.get(player.id)?.position(player.x, player.y, player.z);
    }
  }

  reconcile(players: readonly PlayerSnapshot[], localPlayerId?: string, mode = 1): void {
    this.snapshot = players;
    this.localPlayerId = localPlayerId;
    this.mode = mode;
    this.disguises.reconcile(players, this.playing);
    this.labels.reconcile(players, localPlayerId, mode, this.playing);
    const present = new Set(players.map(player => player.id));
    for (const id of this.previousHp.keys()) {
      if (!present.has(id)) this.previousHp.delete(id);
    }
    for (const [id, view] of this.players) {
      if (!present.has(id)) {
        this.effects.remove(id);
        this.effects.detach(view);
        view.dispose();
        this.damageTexts.get(id)?.dispose();
        this.damageTexts.delete(id);
        this.benefitTexts.get(id)?.dispose();
        this.benefitTexts.delete(id);
        this.players.delete(id);
        this.previousPositions.delete(id);
        this.presentedLife.delete(id);
        this.moving.delete(id);
      }
    }
    for (const player of players) {
      const loaded = this.players.get(player.id);
      if (loaded && !this.sameSelection(loaded, player)) {
        this.effects.remove(player.id);
        this.effects.detach(loaded);
        loaded.dispose();
        this.damageTexts.get(player.id)?.dispose();
        this.damageTexts.delete(player.id);
        this.benefitTexts.get(player.id)?.dispose();
        this.benefitTexts.delete(player.id);
        this.previousHp.delete(player.id);
        this.players.delete(player.id);
        this.presentedLife.delete(player.id);
      }
      const previousHp = this.previousHp.get(player.id);
      this.previousHp.set(player.id, player.hp);
      if (previousHp !== undefined && previousHp !== 0 && player.hp > previousHp) {
        this.benefit(player.id, player.hp - previousHp, player.id === localPlayerId);
      }
      const view = this.players.get(player.id);
      if (view) {
        this.applyAmmoEffect(view, player);
        this.applyVisibility(view, player);
      }
      const previous = this.previousPositions.get(player.id);
      if (view && previous?.alive && !player.alive) {
        const petType = this.ammoCatalog?.petTypes?.find(pet => pet.petId === player.petId)?.petType;
        if (petType !== undefined) this.effects.petDeath(view, petType,
          localPlayerId ? this.players.get(localPlayerId) : undefined);
      }
      if (player.alive && previous?.alive && Math.hypot(previous.x - player.x, previous.z - player.z) > 0.01) {
        this.moving.add(player.id);
      } else {
        this.moving.delete(player.id);
      }
      this.previousPositions.set(player.id, {x: player.x, z: player.z, alive: player.alive});
      if (!this.players.has(player.id) && !this.loading.has(player.id)) {
        void this.loadPlayer(player);
      }
    }
  }

  private async loadDamageText(generation: number): Promise<void> {
    this.damageTextLoading ??= (async () => {
      const response = await fetch('/ui-fonts.json');
      if (!response.ok) throw new Error('原字体目录载入失败');
      const fonts = await response.json() as {fonts: TankDamageTextFont[]};
      if (generation !== this.generation) return;
      const font = fonts.fonts.find(value => value.name === 'Damage' && value.attributes.Type === 'Static');
      if (!font?.glyphs?.length) throw new Error('原Damage字体定义缺失');
      const renderer = new TankDamageTextRenderer(this.scene, font);
      this.damageTextRenderer = renderer;
      await renderer.load();
      if (generation !== this.generation) {renderer.dispose(); return;}
      const benefitFont = fonts.fonts.find(value => value.name === 'Benefit' && value.attributes.Type === 'Static');
      if (!benefitFont?.glyphs?.length) throw new Error('原Benefit字体定义缺失');
      const benefitRenderer = new TankBenefitTextRenderer(this.scene, benefitFont);
      this.benefitTextRenderer = benefitRenderer;
      await benefitRenderer.load();
      if (generation !== this.generation) {benefitRenderer.dispose(); return;}
      const criticalFont = fonts.fonts.find(value => value.name === 'Critical' && value.attributes.Type === 'Static');
      if (!criticalFont?.glyphs?.length) throw new Error('原Critical字体定义缺失');
      const uiResponse = await fetch('/ui.json');
      if (!uiResponse.ok) throw new Error('原Critical附图目录载入失败');
      const ui = await uiResponse.json() as {imagesets: {path: string; attributes: Record<string, string>;
        images: (Omit<CriticalTextImage, 'attributes'> & {Name: string})[]}[]};
      if (generation !== this.generation) return;
      const imageset = ui.imagesets.find(value => value.path === 'ui/imagesets/zhandou0_0.imageset');
      const image = imageset?.images.find(value => value.Name === 'data\\ui\\zhandou\\1_baojishuziditu.tga');
      if (!imageset || !image?.asset) throw new Error('原Critical附图缺失');
      const criticalRenderer = new TankCriticalTextRenderer(this.scene, criticalFont,
        {...image, attributes: imageset.attributes});
      this.criticalTextRenderer = criticalRenderer;
      await criticalRenderer.load();
      if (generation !== this.generation) criticalRenderer.dispose();
    })();
    await this.damageTextLoading;
  }

  /** Original hit text is queued before the separate hurt-action eligibility gate. */
  damage(id: string, value: number, isLocal: boolean, critical = false): void {
    const view = this.players.get(id);
    const queue = this.damageTexts.get(id);
    if (!view || !queue) return;
    const engine = this.scene.getEngine();
    const point = Vector3.Project(view.root.position, Matrix.Identity(),
      this.camera.getTransformationMatrix(), new Viewport(0, 0, engine.getRenderWidth(), engine.getRenderHeight()));
    queue.show(Math.trunc(point.x), Math.trunc(point.y), value, isLocal, critical);
  }

  /** Original HP observer emits only an increase after a nonzero cached value. */
  benefit(id: string, increase: number, isLocal: boolean): void {
    const view = this.players.get(id);
    const queue = this.benefitTexts.get(id);
    if (!view || !queue) return;
    const engine = this.scene.getEngine();
    const point = Vector3.Project(view.root.position, Matrix.Identity(),
      this.camera.getTransformationMatrix(), new Viewport(0, 0, engine.getRenderWidth(), engine.getRenderHeight()));
    queue.show(Math.trunc(point.x), Math.trunc(point.y), increase, isLocal);
  }

  private sameSelection(view: Pick<PlayerSnapshot, 'tankId' | 'tankTextures'>,
                        player: PlayerSnapshot): boolean {
    return view.tankId === player.tankId &&
      JSON.stringify(view.tankTextures) === JSON.stringify(player.tankTextures);
  }

  private async loadPlayer(player: PlayerSnapshot): Promise<void> {
    const generation = this.generation;
    this.loading.add(player.id);
    try {
      await this.loadDamageText(generation);
      this.ammoCatalogLoading ??= fetch('/combat-catalog.json').then(async response => {
        if (!response.ok) throw new Error(`Combat catalog ${response.status}`);
        this.ammoCatalog = await response.json() as CombatCatalog;
        return this.ammoCatalog;
      });
      await this.ammoCatalogLoading;
      const view = await TankView.load(this.scene, `player-${player.id}`, player.tankId, player.tankTextures);
      const current = this.snapshot?.find(value => value.id === player.id);
      if (generation !== this.generation || !current || !this.sameSelection(player, current)) {
        view.dispose();
        return;
      }
      view.position(player.x, player.y, player.z);
      this.applyAmmoEffect(view, current);
      this.applyVisibility(view, current);
      this.players.set(player.id, view);
      if (this.damageTextRenderer) {
        this.damageTexts.set(player.id, new TankDamageText(this.damageTextRenderer, this.criticalTextRenderer));
      }
      if (this.benefitTextRenderer) {
        this.benefitTexts.set(player.id, new TankBenefitText(this.benefitTextRenderer));
      }
      this.effects.attach(view);
    } catch (error) {
      const current = this.snapshot?.find(value => value.id === player.id);
      if (generation === this.generation && current && this.sameSelection(player, current)) {
        this.error = `战车载入失败：${String(error)}`;
      }
    } finally {
      if (generation === this.generation) {
        this.loading.delete(player.id);
      }
    }
  }

  /** Confirmed item+74 is the source virtual+a4 muzzle-effect argument. */
  private applyAmmoEffect(view: TankView, player: PlayerSnapshot): void {
    const effect = this.ammoCatalog?.items.find(item => item.itemTableId === (player.ammoItemId ?? 2001))?.effects?.[0];
    if (effect) view.setAmmoAttackEffect(effect.effectId);
  }

  /** Hostile observers hide the alive skill9 actor root; self, teammates and non-playing phases show it.
   * Disguise hides the alive actor root for every observer while its prop is presented.
   */
  private applyVisibility(view: TankView, player: PlayerSnapshot): void {
    const observer = this.localPlayerId ? this.snapshot?.find(value => value.id === this.localPlayerId) : undefined;
    const hiddenByDisguise = this.disguises.hidesActor(player.id);
    view.root.setEnabled(!this.playing
      || (!hiddenByDisguise && !isHiddenByOpticalCamouflage(player, observer, this.mode)));
  }

  /** Source4173 identity; spawns only when the current authoritative snapshot already carries it. */
  changeRoleStyle(roleId: number, style: 1 | 2): void {
    const player = this.snapshot?.find(value => value.id === `P${roleId}`);
    const disguise = player?.roleDisguise;
    if (!disguise || disguise.style !== style || (disguise.skillId !== 10 && disguise.skillId !== 11)) return;
    this.refreshDisguises();
  }

  /** Source4174 identity; restores only after the authoritative snapshot drops the disguise. */
  restoreRoleStyle(roleId: number): void {
    const player = this.snapshot?.find(value => value.id === `P${roleId}`);
    if (player?.roleDisguise) return;
    this.refreshDisguises();
  }

  private refreshDisguises(): void {
    this.disguises.reconcile(this.snapshot ?? [], this.playing);
  }

  private actionError(id: string, view: TankView, error: unknown): void {
    if (this.players.get(id) === view) {
      this.error = `战车动作载入失败：${String(error)}`;
    }
  }

  fire(id: string): boolean {
    const view = this.players.get(id);
    if (view?.acceptsBattleActions) {
      void view.fire().catch(error => {this.actionError(id, view, error);});
      return view.usesThreePartActor;
    }
    return false;
  }

  hurt(id: string, selector: number): boolean {
    const view = this.players.get(id);
    const player = this.snapshot?.find(value => value.id === id);
    if (view && player?.alive && Number.isInteger(selector) && selector >= 1 && selector <= 4) {
      void view.hurt(selector).catch(error => {this.actionError(id, view, error);});
      return view.usesThreePartActor;
    }
    return false;
  }

  render(alpha: number, localPlayerId?: string, playing = true,
      localPose?: ClientTankPose, localMoving = false): void {
    this.localPlayerId = localPlayerId;
    this.playing = playing;
    this.disguises.reconcile(this.snapshot ?? [], playing);
    for (const player of this.snapshot ?? []) {
      const view = this.players.get(player.id);
      if (!view) continue;
      this.applyVisibility(view, player);
      void view.life(player.alive).catch(error => {this.actionError(player.id, view, error);});
      const queueStarted = this.effects.queuedParts(player.id, player.queuedPartSkillIds ?? [], playing && player.alive);
      const revived = player.alive && this.presentedLife.get(player.id) === false;
      if (revived && !queueStarted) this.effects.revive(player.id);
      this.presentedLife.set(player.id, player.alive);
      const previousTurretYaw = view.turretYaw;
      const manual = player.id === localPlayerId && !player.isAutopilot && localPose !== undefined;
      const pose = manual ? localPose : player;
      const poseAlpha = revived || manual ? 1 : alpha;
      if (revived) view.position(pose.x, pose.y, pose.z);
      view.trackMovementTarget(pose.x, pose.z);
      view.root.position = Vector3.Lerp(view.root.position, new Vector3(-pose.x, pose.y, pose.z), poseAlpha);
      const bodyYaw = pose.bodyYaw ?? pose.yaw;
      const delta = Math.atan2(Math.sin(-bodyYaw - view.root.rotation.y), Math.cos(-bodyYaw - view.root.rotation.y));
      view.root.rotation.y += delta * poseAlpha;
      const turretDelta = Math.atan2(Math.sin(pose.yaw + pose.aim - previousTurretYaw),
        Math.cos(pose.yaw + pose.aim - previousTurretYaw));
      const turretYaw = previousTurretYaw + turretDelta * poseAlpha;
      view.aim(turretYaw + view.root.rotation.y);
      void view.motion(player.alive && (manual ? localMoving : this.moving.has(player.id))).catch(error => {
        this.actionError(player.id, view, error);
      });
      if (player.id === localPlayerId) {
        followBattleCamera(this.camera, view.root.position, view.turretYaw);
      }
    }
    this.labels.render(this.players, localPlayerId, playing);
    const engine = this.scene.getEngine();
    const delta = Math.fround(effectModelEngineDelta(engine.getDeltaTime() / 1000));
    const viewport = {width: engine.getRenderWidth(), height: engine.getRenderHeight()};
    for (const [id, queue] of [...this.damageTexts, ...this.benefitTexts]) {
      const view = this.players.get(id);
      if (!view) continue;
      const viewZ = Vector3.TransformCoordinates(view.root.position, this.camera.getViewMatrix()).z;
      queue.advance(delta, viewZ);
      queue.draw(viewport);
    }
  }

  clear(): void {
    this.generation++;
    this.disguises.clear();
    this.labels.clear();
    this.snapshot = undefined;
    this.localPlayerId = undefined;
    this.mode = 1;
    this.playing = true;
    this.players.forEach(view => {this.effects.detach(view); view.dispose();});
    this.players.clear();
    this.damageTexts.forEach(queue => queue.dispose());
    this.damageTexts.clear();
    this.benefitTexts.forEach(queue => queue.dispose());
    this.benefitTexts.clear();
    this.previousHp.clear();
    this.benefitTextRenderer?.dispose();
    this.benefitTextRenderer = undefined;
    this.damageTextRenderer?.dispose();
    this.damageTextRenderer = undefined;
    this.criticalTextRenderer?.dispose();
    this.criticalTextRenderer = undefined;
    this.damageTextLoading = undefined;
    this.loading.clear();
    this.previousPositions.clear();
    this.presentedLife.clear();
    this.moving.clear();
    this.error = '';
  }
}
