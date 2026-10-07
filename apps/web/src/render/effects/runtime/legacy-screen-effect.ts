import {RawTexture, Scene, Texture} from '@babylonjs/core';
import {EffectRenderPass} from '../common/effect-sprite-mesh';
import {EffectOverlayDrawState} from '../overlays/effect-overlay-draw';
import {EffectOverlayMesh} from '../overlays/effect-overlay-mesh';
import {EffectScreenBackend} from './effect-screen-node';

const LEGACY_SCREEN_PASS: EffectRenderPass = {
  states: [
    {name: 'FVF', value: 'XYZRHW|DIFFUSE|TEX1'},
    {name: 'ZEnable', value: 'FALSE'},
    {name: 'ZWriteEnable', value: 'FALSE'},
    {name: 'Lighting', value: 'FALSE'},
    {name: 'AlphaBlendEnable', value: 'TRUE'},
    {name: 'SrcBlend', value: 'SRCALPHA'},
    {name: 'DestBlend', value: 'INVSRCALPHA'},
    {name: 'CullMode', value: 'NONE'},
    {name: 'ColorOp[0]', value: 'MODULATE'},
    {name: 'AlphaOp[0]', value: 'MODULATE'},
    {name: 'ColorArg1[0]', value: 'TEXTURE'},
    {name: 'ColorArg2[0]', value: 'DIFFUSE'},
    {name: 'AlphaArg1[0]', value: 'TEXTURE'},
    {name: 'AlphaArg2[0]', value: 'DIFFUSE'},
    {name: 'MinFilter[0]', value: 'POINT'},
    {name: 'MagFilter[0]', value: 'POINT'},
    {name: 'AddressU[0]', value: 'CLAMP'},
    {name: 'AddressV[0]', value: 'CLAMP'},
  ],
};

interface ActiveLegacyScreen {
  owner: symbol;
  overlay: EffectOverlayMesh;
  rectangle: EffectOverlayDrawState;
}

/** Scene-scoped Web adoption of the original type10 Select(5,0)/Clear lifecycle. */
export class LegacyScreenEffectBackend implements EffectScreenBackend {
  private active?: ActiveLegacyScreen;
  private whiteTexture?: Texture;
  private rectangle?: EffectOverlayDrawState;
  private activeWidth = -1;
  private activeHeight = -1;
  private disposed = false;

  constructor(private readonly scene: Scene) {}

  selectEffect(index: number, parameter: number, owner: symbol): void {
    if (this.disposed) throw new Error('Legacy screen effect backend is disposed');
    if (index !== 5 || parameter !== 0) throw new Error(`Unsupported legacy screen effect selection ${index},${parameter}`);

    this.releaseActive();
    let texture: Texture | undefined;
    let rectangle: EffectOverlayDrawState | undefined;
    let overlay: EffectOverlayMesh | undefined;
    try {
      texture = this.whiteTexture ?? this.createWhiteTexture();
      rectangle = this.rectangle ?? new EffectOverlayDrawState(0, 0);
      this.rectangle = rectangle;
      overlay = new EffectOverlayMesh(this.scene, LEGACY_SCREEN_PASS, texture);
      this.active = {owner, overlay, rectangle};
      this.update();
    } catch (error) {
      overlay?.dispose();
      if (texture && this.whiteTexture === texture) {
        texture.dispose();
        this.whiteTexture = undefined;
      }
      if (this.active?.owner === owner) this.active = undefined;
      throw error;
    }
  }

  clearEffect(owner: symbol): void {
    if (this.active?.owner !== owner) return;
    this.releaseActive();
  }

  shake(): void {}

  update(): void {
    if (!this.active) return;
    const engine = this.scene.getEngine();
    const width = engine.getRenderWidth();
    const height = engine.getRenderHeight();
    if (width === this.activeWidth && height === this.activeHeight) return;
    this.activeWidth = width;
    this.activeHeight = height;
    this.active.rectangle.resize(width, height);
    this.active.overlay.update(this.active.rectangle.draw([0, 0, 0, 0.25], false, [0, 0, 1, 1]));
  }

  clear(): void {
    this.releaseActive();
  }

  dispose(): void {
    if (this.disposed) return;
    this.clear();
    this.whiteTexture?.dispose();
    this.whiteTexture = undefined;
    this.rectangle = undefined;
    this.disposed = true;
  }

  private createWhiteTexture(): Texture {
    const texture = RawTexture.CreateRGBATexture(new Uint8Array([255, 255, 255, 255]), 1, 1,
      this.scene, false, false, Texture.NEAREST_SAMPLINGMODE);
    texture.name = 'legacy-screen-white';
    this.whiteTexture = texture;
    return texture;
  }

  private releaseActive(): void {
    this.active?.overlay.dispose();
    this.active = undefined;
    this.activeWidth = -1;
    this.activeHeight = -1;
  }
}
