import {Vector2} from '@babylonjs/core';
import type {Scene} from '@babylonjs/core';
import type {CombatCatalog} from '../../../shared/combat/catalog';
import type {ResInventory} from '../../../shared/protocols/PtlInventory';
import {decodeImage} from '../assets/image-resources';
import type {BattleHud, SourceWindow} from '../interface/battle/battle-hud';
import {hudItemSlots} from '../interface/battle/hud-item-slots';
import {absoluteRect} from '../interface/battle/hud-source-controls';
import {lifeProgress} from '../interface/battle/life-progress';
import {BattleScreenVector, type BattleVectorShape, type VectorRectangle} from './battle-screen-vectors';

interface ScreenRect {left: number; top: number; width: number; height: number;}
interface Projection {
  viewport: Vector2;
  scale: number;
  ratioX: number;
  ratioY: number;
  canvasLeft: number;
  canvasTop: number;
}

/** Shortcut icons, magazine and local life bar share the source HUD bindings. */
export class BattleHudVectorRenderer {
  private readonly draws = new Map<string, BattleScreenVector>();
  private geometry?: Readonly<Record<string, BattleVectorShape>>;
  private notices?: Readonly<Record<string, BattleVectorShape>>;

  constructor(private readonly scene: Scene) {
    scene.onDisposeObservable.addOnce(() => {this.dispose();});
  }

  async load(): Promise<void> {
    if (this.geometry && this.notices) return;
    const [hud, notices] = await Promise.all([
      import('./battle-hud-vector-geometry'), import('./battle-notice-vector-geometry'),
    ]);
    await Promise.all([...Object.values(hud.BATTLE_HUD_VECTORS), ...Object.values(notices.BATTLE_NOTICE_VECTORS)]
      .map(shape => decodeImage(`/${shape.asset}`)));
    this.geometry = hud.BATTLE_HUD_VECTORS;
    this.notices = notices.BATTLE_NOTICE_VECTORS;
  }

  render(hud: BattleHud, catalog: CombatCatalog | undefined, inventory: ResInventory | undefined,
    selectedItemSlot: number | undefined, serverNow: number): void {
    this.clear();
    const state = hud.getSnapshot(), combat = hud.getCombatSnapshot(), vectors = this.geometry;
    if (!state.visible || !state.data || !vectors || !catalog) return;
    const windows = state.data.layouts.find(layout => layout.path === 'ui/layouts/game_main.xml')?.windows;
    const canvas = this.scene.getEngine().getRenderingCanvas();
    if (!windows || !canvas) return;
    const bounds = canvas.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return;
    const engine = this.scene.getEngine(), scale = Math.min(innerWidth / 800, innerHeight / 600);
    const originX = (innerWidth - 800 * scale) / 2, originY = (innerHeight - 600 * scale) / 2;
    const projection: Projection = {
      viewport: new Vector2(engine.getRenderWidth(), engine.getRenderHeight()), scale,
      ratioX: engine.getRenderWidth() / bounds.width, ratioY: engine.getRenderHeight() / bounds.height,
      canvasLeft: bounds.left, canvasTop: bounds.top,
    };
    const rect = (control: SourceWindow, leftAnchored = false): ScreenRect => {
      const source = absoluteRect(control);
      return {left: (leftAnchored ? 0 : originX) + source.left * scale, top: originY + source.top * scale,
        width: source.width * scale, height: source.height * scale};
    };
    const bar = windows.find(control => control.name === 'daojulan');
    if (bar && combat.visible) {
      const barRect = rect(bar, true);
      this.draw('shortcut-bar', vectors.bar, barRect, projection, 0);
      for (const slot of hudItemSlots(combat, catalog, inventory, selectedItemSlot,
        hud.getReloadSnapshot().fraction, serverNow)) {
        const frame = windows.find(control => control.name === `picItem${slot.slot - 1}`);
        if (!frame) continue;
        const frameRect = absoluteRect(frame);
        const childRect = (control: SourceWindow): ScreenRect => {
          const child = absoluteRect(control);
          return {left: barRect.left + (frameRect.left + child.left) * scale,
            top: barRect.top + (frameRect.top + child.top) * scale,
            width: child.width * scale, height: child.height * scale};
        };
        const icon = windows.find(control => control.name === `daoju${slot.slot}`);
        const shape = slot.item?.iconId === undefined ? undefined : vectors[`icon${slot.item.iconId}`];
        if (icon && shape) this.draw(`shortcut-icon-${slot.slot}`, shape, childRect(icon), projection, 1);
        const count = windows.find(control => control.name === `txtItemCount${slot.slot - 1}`);
        if (slot.infinite && count) {
          const countRect = childRect(count);
          this.draw('shortcut-infinite', vectors.infinite, {
            left: countRect.left + countRect.width - 18 * scale,
            top: countRect.top + countRect.height - 15 * scale,
            width: 15 * scale, height: 14 * scale,
          }, projection, 2);
        }
        const cooldown = windows.find(control => control.name === `lengque${slot.slot}`);
        if (cooldown && slot.cooldownFraction !== undefined) {
          const cooldownRect = childRect(cooldown);
          const extent = Math.floor(Math.fround(cooldownRect.height) * slot.cooldownFraction + .5);
          this.draw(`shortcut-cooldown-${slot.slot}`, vectors.cooldown, cooldownRect, projection, 3,
            [0, (cooldownRect.height - extent) * vectors.cooldown.height / cooldownRect.height,
              vectors.cooldown.width, vectors.cooldown.height]);
        }
      }
    }
    const bullet = windows.find(control => control.name === 'prgBullet'), magazine = combat.magazine;
    if (bullet && combat.visible && magazine && magazine.capacity > 0) {
      const bulletRect = rect(bullet, true);
      bulletRect.width = Math.fround(magazine.capacity * 15) * scale;
      const fraction = Math.fround(Math.max(0, Math.min(1, magazine.remaining / magazine.capacity)));
      const progress = lifeProgress(fraction, 1, Math.fround(bulletRect.width));
      this.tiles('magazine-background', vectors.magazineBackground, bulletRect, projection, bulletRect.width, 0);
      this.tiles('magazine-fill', vectors.magazineFill, bulletRect, projection, progress.extent, 1);
    }
    const life = windows.find(control => control.name === 'prgLife'), health = state.localHealth;
    if (life && health && !hud.spectator.getSnapshot().active) {
      const lifeRect = rect(life), progress = lifeProgress(health.hp, health.maxHp, Math.fround(lifeRect.width));
      const colour = life.properties[['ProgressLowBoundColour', 'ProgressMediumColour', 'ProgressHighBoundColour'][progress.band]];
      const tint: VectorRectangle = [parseInt(colour.slice(2, 4), 16) / 255,
        parseInt(colour.slice(4, 6), 16) / 255, parseInt(colour.slice(6, 8), 16) / 255, 1];
      this.tiles('life-background', vectors.lifeBackground, lifeRect, projection, lifeRect.width, 0);
      this.tiles('life-fill', vectors.lifeFill, lifeRect, projection, progress.extent, 1, tint);
    }
    if (this.notices && state.introStage !== 'hidden') {
      const modeControl = ['picTeamMode', 'picConquerMode', 'picVIPMode', 'picMeleeMode', 'picDestroyMode'][state.mode - 1];
      const names = state.introStage === 'fight' ? ['picFight'] : ['picModeSplash', modeControl];
      for (const [index, name] of names.entries()) {
        const control = windows.find(control => control.name === name), shape = this.notices[name];
        if (!control || !shape) continue;
        const parentRect = rect(control);
        this.draw(`notice-${name}`, shape, parentRect, projection, 10 + index);
        for (const [titleIndex, title] of windows.filter(child => child.parent === name).entries()) {
          const titleShape = this.notices[title.name];
          if (!titleShape) continue;
          const titleRect = absoluteRect(title);
          this.draw(`notice-${title.name}`, titleShape, {
            left: parentRect.left + titleRect.left * scale,
            top: parentRect.top + titleRect.top * scale,
            width: titleRect.width * scale, height: titleRect.height * scale,
          }, projection, 12 + titleIndex);
        }
      }
    }
  }

  clear(): void {
    for (const vector of this.draws.values()) vector.clear();
  }

  private draw(name: string, shape: BattleVectorShape, rect: ScreenRect, projection: Projection, order: number,
    clip?: VectorRectangle, tint?: VectorRectangle): void {
    let vector = this.draws.get(name);
    if (!vector) {
      vector = new BattleScreenVector(this.scene, name, order);
      this.draws.set(name, vector);
    }
    vector.draw(shape, projection.viewport, [
      (rect.left - projection.canvasLeft) * projection.ratioX,
      (rect.top - projection.canvasTop) * projection.ratioY,
      rect.width * projection.ratioX, rect.height * projection.ratioY,
    ], clip, tint);
  }

  /** Source progress images repeat at their rounded AutoScaled dimensions. */
  private tiles(name: string, shape: BattleVectorShape, rect: ScreenRect, projection: Projection,
    extent: number, order: number, tint?: VectorRectangle): void {
    const width = Math.round(Math.fround(shape.width * Math.fround(projection.scale)));
    const height = Math.round(Math.fround(shape.height * Math.fround(projection.scale)));
    if (width <= 0 || height <= 0 || extent <= 0) return;
    const columns = Math.trunc((rect.width + width - 1) / width), rows = Math.trunc((rect.height + height - 1) / height);
    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        const right = Math.min(rect.width, extent) - column * width, bottom = rect.height - row * height;
        if (right <= 0 || bottom <= 0) continue;
        this.draw(`${name}-${row}-${column}`, shape, {
          left: rect.left + column * width, top: rect.top + row * height, width, height,
        }, projection, order, [0, 0, Math.min(shape.width, right * shape.width / width),
          Math.min(shape.height, bottom * shape.height / height)], tint);
      }
    }
  }

  private dispose(): void {
    this.clear();
    for (const vector of this.draws.values()) vector.dispose();
    this.draws.clear();
  }
}
