import {Mesh, Scene, Texture} from '@babylonjs/core';
import {EffectModelAnimation, EffectModelAnimationNode, effectModelVertices} from './effect-model-animation';
import {EffectModelDraw} from './effect-model-draw';
import {EffectAttachMaterialCache} from './effect-attach-material-sol';
import {effectModelAmbient, EffectModelGraphicsState} from './effect-model-material';
import {EffectModelMesh} from './effect-model-mesh';
import {EffectModelBackend} from './effect-model-node';
import {EFFECT_IDENTITY, multiplyEffectMatrices} from '../common/effect-render-transform';
import {setSceneModelPriority} from '../../scene-model-order';

interface ModelPart {kind: number; properties: number[]; asset: string | null; indices: number[];}
interface ModelNode {
  fvf: number; parent?: number | null; vertices?: number[][]; colors?: number[][];
  animation?: EffectModelAnimationNode; duration?: number; frames?: number[][][]; times?: number[];
  parts: ModelPart[];
}
export interface EffectModelResource {reference: string; resolution: string; nodes: ModelNode[];}
export interface EffectModelLibrary {
  resources: EffectModelResource[];
  graphics: EffectModelGraphicsState;
  scripts: {name: string; states: {name: string; value: string}[]}[];
}
interface PartDraw {node: number; part: ModelPart; material?: EffectAttachMaterialCache; script?: string; renderer?: EffectModelMesh;}

/** Type5 source geometry and gbGeomNode animation behind the production tree. */
export class EffectModelRenderer implements EffectModelBackend {
  private readonly animations: (EffectModelAnimation | undefined)[];
  private readonly draws: PartDraw[];
  constructor(private readonly scene: Scene, private readonly resource: EffectModelResource,
    private readonly library: EffectModelLibrary, private readonly textures: ReadonlyMap<string, Texture>,
    private readonly delta: () => number, private readonly sourceNode: number, private readonly name: string) {
    if (resource.resolution !== 'published') throw new Error(`Missing original model ${resource.reference}`);
    this.animations = resource.nodes.map(node => node.animation ? new EffectModelAnimation(node.animation, node.duration!) : undefined);
    this.draws = resource.nodes.flatMap((node, index) => node.parts.map(part => ({node: index, part})));
    for (const draw of this.draws) if (!draw.part.asset) throw new Error(`Missing original model texture ${resource.reference}`);
  }
  setTime(time: number): void {this.animations.forEach(animation => animation?.setTime(time));}
  setRate(rate: number): void {this.animations.forEach(animation => animation?.setRate(rate));}
  update(): void {this.animations.forEach(animation => animation?.update(this.delta()));}

  draw(state: EffectModelDraw | undefined): void {
    if (!state) {this.draws.forEach(draw => draw.renderer?.mesh.setEnabled(false)); return;}
    const matrices = this.resource.nodes.map(() => [...EFFECT_IDENTITY]);
    this.resource.nodes.forEach((node, index) => {
      const local = this.animations[index]?.matrix ?? EFFECT_IDENTITY;
      matrices[index] = multiplyEffectMatrices(node.parent == null ? state.matrix : matrices[node.parent], local);
    });
    const graphics: EffectModelGraphicsState = {
      ambient: this.scene.ambientColor.equalsFloats(0, 0, 0)
        ? this.library.graphics.ambient : this.scene.ambientColor.asArray(),
      emissive: this.library.graphics.emissive,
    };
    for (const draw of this.draws) {
      const node = this.resource.nodes[draw.node];
      const script = (draw.material ??= new EffectAttachMaterialCache()).select(node.fvf, draw.part.kind, state.blend).script;
      if (draw.script !== script) {
        draw.renderer?.dispose();
        const states = new Map<string, string>();
        for (const name of ['default', script]) this.library.scripts.find(row => row.name === name)!.states
          .forEach(row => states.set(row.name, row.value));
        const texture = this.textures.get(draw.part.asset!)!;
        // Original device state inheritance: default.gbf is the baseline and
        // the selected section GBF only overrides the keys it names. Missing
        // keys therefore keep the baseline instead of a material-local guess.
        const cullState = states.get('CullMode');
        draw.renderer = new EffectModelMesh(this.scene, texture, {
          cull: cullState === 'CW' || cullState === 'CCW' || cullState === 'NONE' ? cullState : 'CW',
          depthWrite: states.has('ZWriteEnable') ? states.get('ZWriteEnable') === 'TRUE' : true,
          depthTest: states.has('ZEnable') ? states.get('ZEnable') === 'TRUE' : true,
          blend: states.get('AlphaBlendEnable') === 'TRUE',
          alphaTest: states.get('AlphaTestEnable') === 'TRUE',
        });
        draw.renderer.mesh.metadata = {originalEffect: this.name, sourceNode: this.sourceNode,
          sourceModel: this.resource.reference, sourceModelNode: draw.node};
        draw.script = script;
      }
      const animation = this.animations[draw.node];
      const vertices = animation ? effectModelVertices(node.frames!, node.times!, animation.time) : node.vertices!;
      setSceneModelPriority(draw.renderer!.mesh, state.priority);
      draw.renderer!.mesh.setEnabled(true);
      draw.renderer!.update(vertices, draw.part.indices, matrices[draw.node],
        effectModelAmbient(draw.part.properties, state.alpha, graphics), node.colors);
    }
  }
  get meshes(): Mesh[] {return this.draws.flatMap(draw => draw.renderer ? [draw.renderer.mesh] : []);}
  dispose(): void {this.draws.forEach(draw => draw.renderer?.dispose());}
}
