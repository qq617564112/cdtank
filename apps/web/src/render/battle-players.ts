import {gameContent} from '../../../shared/content/catalog';
import {defaultAmmoId} from '../../../shared/content/catalog';
import {loadCombatCatalog} from '../content';
import {ArcRotateCamera, Matrix, Scene, Vector3, Viewport} from '@babylonjs/core';
import {loadStaticJson} from '../assets/static-resources';
import {TankDamageText} from '../assets/tanks/tank-damage-text';
import {TankBenefitText} from '../assets/tanks/tank-benefit-text';
import {TankBenefitTextRenderer} from './tank-benefit-text-renderer';
import {TankCriticalTextRenderer, type CriticalTextImage} from './tank-critical-text-renderer';
import {TankDamageTextRenderer, type TankDamageTextFont} from './tank-damage-text-renderer';
import {effectModelEngineDelta} from './effects/models/effect-model-animation';
import type {PlayerSnapshot} from '../../../shared/protocols/MsgRoomSnapshot';
import type {ClientTankPose} from '../../../shared/protocols/MsgPlayerInput';
import type {CombatCatalog} from '../../../shared/combat/catalog';
import {isHiddenByOpticalCamouflage, isHiddenFromOpponent} from '../../../shared/combat/optical-camouflage';
import {hasFixedTurret} from '../../../shared/combat/tank-turret';
import {followBattleCamera, orbitWreckCamera} from './battle-camera';
import {TankView} from '../assets/tanks/tank-view';
import {BattleRoleDisguises} from './battle-role-disguises';
import {BattlePlayerLabels} from './battle-player-labels';
import {BattleTankDecoration} from './battle-tank-decoration';
import type {NavigationGrid} from '../../../shared/movement/navigation';
import {tankGroundSlope} from './tank-ground-pose';

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
  private comboTextRenderer?: TankCriticalTextRenderer;
  private damageTextLoading?: Promise<void>;
  private readonly loading = new Set<string>();
  private readonly decorations = new Map<string, BattleTankDecoration>();
  private readonly selectedDecoration = new Map<string, number>();
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
    return this.snapshot !== undefined && !this.error
      && this.snapshot.every(player => this.players.has(player.id))
      && [...this.decorations.values()].every(decoration => decoration.ready);
  }

  get loadingError(): string {return this.disguises.loadingError || this.error;}

  loadLabels(): Promise<void> {return this.labels.load();}

  resetRound(players: readonly PlayerSnapshot[]): void {
    this.labels.resetRound();
    this.disguises.clear();
    this.previousPositions.clear();
    this.presentedLife.clear();
    this.moving.clear();
    this.damageTexts.forEach(queue => queue.clear());
    this.benefitTexts.forEach(queue => queue.clear());
    this.previousHp.clear();
    this.decorations.forEach(decoration => decoration.dispose());
    this.decorations.clear();
    this.selectedDecoration.clear();
    for (const player of players) {
      const view = this.players.get(player.id);
      if (!view) continue;
      this.resetPose(view, player);
      this.applyDecoration(player, view);
    }
  }

  private resetPose(view: TankView, player: PlayerSnapshot): void {
    view.root.rotation.x = 0;
    view.root.rotation.y = -(player.bodyYaw ?? player.yaw);
    view.root.rotation.z = 0;
    view.position(player.x, player.y, player.z);
    view.aim(player.yaw + player.aim + view.root.rotation.y);
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
        this.disposeDecoration(id);
        this.players.delete(id);
        this.previousPositions.delete(id);
        this.presentedLife.delete(id);
        this.moving.delete(id);
      }
    }
    for (const player of players) {
      const loaded = this.players.get(player.id);
      if (loaded && !this.sameSelection(loaded, player)) {
        if (this.sameModel(loaded, player)) {
          // Only the confirmed decoration changed; release its owner before loading the replacement.
          this.disposeDecoration(player.id);
        } else {
          this.effects.remove(player.id);
          this.effects.detach(loaded);
          loaded.dispose();
          this.damageTexts.get(player.id)?.dispose();
          this.damageTexts.delete(player.id);
          this.benefitTexts.get(player.id)?.dispose();
          this.benefitTexts.delete(player.id);
          this.disposeDecoration(player.id);
          this.previousHp.delete(player.id);
          this.players.delete(player.id);
          this.presentedLife.delete(player.id);
        }
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
        this.applyDecoration(player, view);
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
      const fonts = await loadStaticJson<{fonts: TankDamageTextFont[]}>('/ui-fonts.json');
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
      const ui = await loadStaticJson<{imagesets: {path: string; attributes: Record<string, string>;
        images: (Omit<CriticalTextImage, 'attributes'> & {Name: string})[]}[]}>('/ui.json');
      if (generation !== this.generation) return;
      const imageset = ui.imagesets.find(value => value.path === 'ui/imagesets/zhandou0_0.imageset');
      const image = imageset?.images.find(value => value.Name === 'data\\ui\\zhandou\\1_baojishuziditu.tga');
      if (!imageset || !image?.asset) throw new Error('原Critical附图缺失');
      const criticalRenderer = new TankCriticalTextRenderer(this.scene, criticalFont,
        {...image, attributes: imageset.attributes});
      this.criticalTextRenderer = criticalRenderer;
      await criticalRenderer.load();
      if (generation !== this.generation) {criticalRenderer.dispose(); return;}
      const comboFont = fonts.fonts.find(value => value.name === 'Combo' && value.attributes.Type === 'Static');
      const comboImage = imageset.images.find(value => value.Name === 'data\\ui\\zhandou\\2_baojixianshidanwei.tga');
      if (!comboFont?.glyphs?.length || !comboImage?.asset) throw new Error('原Combo文字资源缺失');
      const comboRenderer = new TankCriticalTextRenderer(this.scene, comboFont,
        {...comboImage, attributes: imageset.attributes});
      this.comboTextRenderer = comboRenderer;
      await comboRenderer.load();
      if (generation !== this.generation) comboRenderer.dispose();
    })();
    await this.damageTextLoading;
  }

  /** Original hit text is queued before the separate hurt-action eligibility gate. */
  damage(id: string, value: number, isLocal: boolean, critical = false): void {
    const view = this.players.get(id);
    const queue = this.damageTexts.get(id);
    if (!view || !queue || view.hiddenFromObserver) return;
    const engine = this.scene.getEngine();
    const point = Vector3.Project(view.root.position, Matrix.Identity(),
      this.camera.getTransformationMatrix(), new Viewport(0, 0, engine.getRenderWidth(), engine.getRenderHeight()));
    queue.show(Math.trunc(point.x), Math.trunc(point.y), value, isLocal, critical);
  }

  /** Original destroy notification suppresses Combo while the local role is dead. */
  combo(id: string, count: number): void {
    const local = this.snapshot?.find(player => player.id === this.localPlayerId);
    const view = this.players.get(id), queue = this.damageTexts.get(id);
    if (!local?.alive || !view || !queue || view.hiddenFromObserver || count <= 1) return;
    const engine = this.scene.getEngine();
    const point = Vector3.Project(view.root.position, Matrix.Identity(),
      this.camera.getTransformationMatrix(), new Viewport(0, 0, engine.getRenderWidth(), engine.getRenderHeight()));
    queue.combo(Math.trunc(point.x), Math.trunc(point.y), count, id === this.localPlayerId);
  }

  /** Original HP observer emits only an increase after a nonzero cached value. */
  benefit(id: string, increase: number, isLocal: boolean): void {
    const view = this.players.get(id);
    const queue = this.benefitTexts.get(id);
    if (!view || !queue || view.hiddenFromObserver) return;
    const engine = this.scene.getEngine();
    const point = Vector3.Project(view.root.position, Matrix.Identity(),
      this.camera.getTransformationMatrix(), new Viewport(0, 0, engine.getRenderWidth(), engine.getRenderHeight()));
    queue.show(Math.trunc(point.x), Math.trunc(point.y), increase, isLocal);
  }

  /** TankView owns no confirmed decoration field, so the loaded identity is tracked alongside it. */
  private sameSelection(view: Pick<PlayerSnapshot, 'tankId' | 'tankTextures'>,
                        player: PlayerSnapshot): boolean {
    return this.sameModel(view, player)
      && this.selectedDecoration.get(player.id) === player.decoration?.itemTableId;
  }

  private sameModel(view: Pick<PlayerSnapshot, 'tankId' | 'tankTextures'>,
                    player: PlayerSnapshot): boolean {
    return view.tankId === player.tankId &&
      JSON.stringify(view.tankTextures) === JSON.stringify(player.tankTextures);
  }

  private disposeDecoration(id: string): void {
    this.decorations.get(id)?.dispose();
    this.decorations.delete(id);
    this.selectedDecoration.delete(id);
  }

  /** Consumes the authoritative decoration identity once the actor model is present. */
  private applyDecoration(player: PlayerSnapshot, view: TankView): void {
    const itemTableId = player.decoration?.itemTableId;
    if (this.selectedDecoration.get(player.id) === itemTableId) return;
    this.disposeDecoration(player.id);
    if (itemTableId === undefined) return;
    const item = gameContent().items.get(itemTableId);
    if (!item) {
      this.error = `饰品定义缺失：${itemTableId}`;
      return;
    }
    // Record the choice before loading so a later snapshot compares against it.
    this.selectedDecoration.set(player.id, itemTableId);
    if (item.appearanceEffect) return;
    let decoration: BattleTankDecoration;
    try {
      decoration = BattleTankDecoration.create(this.scene, view, item);
    } catch (error) {
      this.error = `饰品载入失败：${String(error)}`;
      return;
    }
    this.decorations.set(player.id, decoration);
    void decoration.load().then(ready => {
      if (!ready && this.decorations.get(player.id) === decoration) this.disposeDecoration(player.id);
    }).catch(error => {
      if (this.decorations.get(player.id) === decoration) {
        this.error = `饰品载入失败：${String(error)}`;
      }
    });
  }

  private async loadPlayer(player: PlayerSnapshot): Promise<void> {
    const generation = this.generation;
    this.loading.add(player.id);
    try {
      await this.loadDamageText(generation);
      if (generation !== this.generation) return;
      this.ammoCatalog = await loadCombatCatalog();
      if (generation !== this.generation) return;
      const view = await TankView.load(this.scene, `player-${player.id}`, player.tankId, player.tankTextures);
      const current = this.snapshot?.find(value => value.id === player.id);
      if (generation !== this.generation || !current || !this.sameModel(player, current)) {
        view.dispose();
        return;
      }
      this.resetPose(view, current);
      this.applyAmmoEffect(view, current);
      this.applyVisibility(view, current);
      this.players.set(player.id, view);
      if (this.damageTextRenderer) {
        this.damageTexts.set(player.id, new TankDamageText(this.damageTextRenderer,
          this.criticalTextRenderer, this.comboTextRenderer));
      }
      if (this.benefitTextRenderer) {
        this.benefitTexts.set(player.id, new TankBenefitText(this.benefitTextRenderer));
      }
      this.effects.attach(view);
      this.applyDecoration(current, view);
    } catch (error) {
      const current = this.snapshot?.find(value => value.id === player.id);
      if (generation === this.generation && current && this.sameModel(player, current)) {
        this.error = `战车载入失败：${String(error)}`;
      }
    } finally {
      if (generation === this.generation) {
        this.loading.delete(player.id);
        const current = this.snapshot?.find(value => value.id === player.id);
        if (current && !this.players.has(player.id) && !this.sameModel(player, current)) {
          void this.loadPlayer(current);
        }
      }
    }
  }

  /** Confirmed item+74 is the source virtual+a4 muzzle-effect argument. */
  private applyAmmoEffect(view: TankView, player: PlayerSnapshot): void {
    const effect = this.ammoCatalog?.items.find(item => item.itemTableId === (player.ammoItemId ?? defaultAmmoId()))?.effects?.[0];
    if (effect) view.setAmmoAttackEffect(effect.effectId);
  }

  /** Hostile observers hide the alive skill9 actor; self and teammates see a translucent tank.
   * Disguise hides the alive actor root for every observer while its prop is presented.
   */
  private applyVisibility(view: TankView, player: PlayerSnapshot): void {
    const observer = this.localPlayerId ? this.snapshot?.find(value => value.id === this.localPlayerId) : undefined;
    const hiddenByDisguise = this.disguises.hidesActor(player.id);
    view.hiddenFromObserver = this.playing && isHiddenFromOpponent(player, observer, this.mode);
    view.setOpticalCamouflage(this.playing && player.alive && player.opticalCamouflage !== undefined);
    if (view.hiddenFromObserver) {
      this.damageTexts.get(player.id)?.clear();
      this.benefitTexts.get(player.id)?.clear();
    }
    view.root.setEnabled(!this.playing
      || (!hiddenByDisguise && !isHiddenByOpticalCamouflage(player, observer, this.mode)));
  }

  /** Source4173 identity; spawns only when the current authoritative snapshot already carries it. */
  changeRoleStyle(roleId: number, style: 1 | 2): void {
    const player = this.snapshot?.find(value => value.id === `P${roleId}`);
    const disguise = player?.roleDisguise;
    if (!disguise || disguise.style !== style || ![...gameContent().items.values()].some(item => item.runtime.use === 'disguise'
      && item.runtime.skillRoles.primary === disguise.skillId)) return;
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
      localPose?: ClientTankPose, localMoving = false, cameraPlayerId = localPlayerId,
      wreckElapsedSeconds?: number, navigation?: NavigationGrid): void {
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
      const poseAlpha = revived || manual || !playing ? 1 : alpha;
      if (revived || !playing) view.position(pose.x, pose.y, pose.z);
      const trackCommand = manual ? localPose.command : (player.movement?.command ?? 0);
      view.trackMovementCommand(this.playing ? trackCommand : 0);
      view.root.position = Vector3.Lerp(view.root.position, new Vector3(-pose.x, pose.y, pose.z), poseAlpha);
      const bodyYaw = pose.bodyYaw ?? pose.yaw;
      const delta = Math.atan2(Math.sin(-bodyYaw - view.root.rotation.y), Math.cos(-bodyYaw - view.root.rotation.y));
      view.root.rotation.y += delta * poseAlpha;
      const slope = playing && player.alive
        ? tankGroundSlope(navigation, -view.root.position.x, view.root.position.y,
          view.root.position.z, -view.root.rotation.y)
        : {pitch: 0, roll: 0};
      view.root.rotation.x = slope.pitch;
      view.root.rotation.z = slope.roll;
      const turretDelta = Math.atan2(Math.sin(pose.yaw + pose.aim - previousTurretYaw),
        Math.cos(pose.yaw + pose.aim - previousTurretYaw));
      const turretYaw = hasFixedTurret(player.tankId) ? -view.root.rotation.y
        : previousTurretYaw + turretDelta * poseAlpha;
      view.aim(turretYaw + view.root.rotation.y);
      void view.motion(playing && player.alive && (manual ? localMoving : this.moving.has(player.id))).catch(error => {
        this.actionError(player.id, view, error);
      });
      if (player.id === cameraPlayerId) {
        if (player.id === localPlayerId && !player.alive && wreckElapsedSeconds !== undefined) {
          orbitWreckCamera(this.camera, view.root.position, view.turretYaw, wreckElapsedSeconds);
        } else {
          followBattleCamera(this.camera, view.root.position, view.turretYaw);
        }
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
      if (!view.hiddenFromObserver) queue.draw(viewport);
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
    this.decorations.forEach(decoration => decoration.dispose());
    this.decorations.clear();
    this.selectedDecoration.clear();
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
    this.comboTextRenderer?.dispose();
    this.comboTextRenderer = undefined;
    this.damageTextLoading = undefined;
    this.loading.clear();
    this.previousPositions.clear();
    this.presentedLife.clear();
    this.moving.clear();
    this.error = '';
  }
}
