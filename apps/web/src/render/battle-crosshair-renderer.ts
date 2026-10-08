import {Vector2} from '@babylonjs/core';
import type {Scene} from '@babylonjs/core';
import type {HudReloadSnapshot} from '../interface/battle/battle-hud';
import {CROSSHAIR_BACKGROUND, CROSSHAIR_FILL} from './battle-crosshair-geometry';
import {BattleScreenVector, type VectorRectangle} from './battle-screen-vectors';

const WIDTH = 50;
const HEIGHT = 37;

/** Original source images with the original vertical reveal. */
export class BattleCrosshairRenderer {
  private readonly background: BattleScreenVector;
  private readonly foreground: BattleScreenVector;

  constructor(private readonly scene: Scene) {
    this.background = new BattleScreenVector(scene, 'crosshair-background', 4);
    this.foreground = new BattleScreenVector(scene, 'crosshair-fill', 5);
    scene.onDisposeObservable.addOnce(() => {this.dispose();});
  }

  render(state: HudReloadSnapshot): void {
    if (!state.visible) {this.clear(); return;}
    const engine = this.scene.getEngine(), canvas = engine.getRenderingCanvas();
    if (!canvas) {this.clear(); return;}
    const bounds = canvas.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) {this.clear(); return;}
    const width = engine.getRenderWidth(), height = engine.getRenderHeight();
    const scale = Math.min(innerWidth / 800, innerHeight / 600);
    const ratioX = width / bounds.width, ratioY = height / bounds.height;
    const left = (innerWidth - 800 * scale) / 2 + 373 * scale;
    const top = (innerHeight - 600 * scale) / 2 + 234 * scale;
    const imageWidth = Math.round(Math.fround(WIDTH * Math.fround(scale)));
    const imageHeight = Math.round(Math.fround(HEIGHT * Math.fround(scale)));
    const extent = Math.floor(Math.fround(HEIGHT * scale) * state.fraction + .5);
    const viewport = new Vector2(width, height);
    const rectangle: VectorRectangle = [(left - bounds.left) * ratioX, (top - bounds.top) * ratioY,
      imageWidth * ratioX, imageHeight * ratioY];
    const clipRight = WIDTH * WIDTH * scale / imageWidth, clipBottom = HEIGHT * HEIGHT * scale / imageHeight;
    this.background.draw(CROSSHAIR_BACKGROUND, viewport, rectangle, [0, 0, clipRight, clipBottom], [1, 1, 1, .6]);
    this.foreground.draw(CROSSHAIR_FILL, viewport, rectangle,
      [0, (HEIGHT * scale - extent) * HEIGHT / imageHeight, clipRight, clipBottom], [1, 1, 1, .6]);
  }

  clear(): void {
    this.background.clear();
    this.foreground.clear();
  }

  private dispose(): void {
    this.clear();
    this.background.dispose();
    this.foreground.dispose();
  }
}
