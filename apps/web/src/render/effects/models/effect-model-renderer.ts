import {Mesh, Scene, Texture} from '@babylonjs/core';
import {EffectModelAnimation, EffectModelAnimationNode} from './effect-model-animation';
import {EffectModelDraw} from './effect-model-draw';
import {EffectAttachMaterialCache} from './effect-attach-material-sol';
import {effectModelAmbient, EffectModelGraphicsState} from './effect-model-material';
import {EffectModelMesh} from './effect-model-mesh';
import {EffectModelBackend} from './effect-model-node';
import {EFFECT_IDENTITY, multiplyEffectMatricesToRef} from '../common/effect-render-transform';
import {setSceneModelPriority} from '../../scene-model-order';
import {EffectModelVertices, type EffectModelVertexData} from './effect-model-vertices';
import {AnimationTransformSampler} from '../../../../../shared/movement/animation-sampling';

interface ModelPart {kind: number; properties: number[]; asset: string | null; indices: number[];}
interface ModelNode {
  fvf: number; parent?: number | null; vertexData?: EffectModelVertexData;
  animation?: EffectModelAnimationNode; duration?: number; times?: number[];
  parts: ModelPart[];
}
export interface EffectModelResource {reference: string; resolution: string; nodes: ModelNode[];}
export interface EffectModelLibrary {
  resources: EffectModelResource[];
  graphics: EffectModelGraphicsState;
  scripts: {name: string; states: {name: string; value: string}[]}[];
}
interface PartDraw {node: number; part: ModelPart; ambient: number[]; material?: EffectAttachMaterialCache; script?: string; renderer?: EffectModelMesh;}

const transformSamplers = new WeakMap<EffectModelAnimationNode, AnimationTransformSampler>();

/** Type5 source geometry and gbGeomNode animation behind the production tree. */
export class EffectModelRenderer implements EffectModelBackend {
  private readonly animations: (EffectModelAnimation | undefined)[];
  private readonly draws: PartDraw[];
  private readonly vertices: (EffectModelVertices | undefined)[] = [];
  private readonly matrices: number[][];
  private readonly graphics: EffectModelGraphicsState;
  private readonly renderedMeshes: Mesh[] = [];
  constructor(private readonly scene: Scene, private readonly resource: EffectModelResource,
    private readonly library: EffectModelLibrary, private readonly textures: ReadonlyMap<string, Texture>,
    private readonly delta: () => number, private readonly sourceNode: number, private readonly name: string) {
    if (resource.resolution !== 'published') throw new Error(`Missing original model ${resource.reference}`);
    this.animations = resource.nodes.map(node => {
      if (!node.animation) return undefined;
      let sampler = transformSamplers.get(node.animation);
      if (!sampler) {
        sampler = new AnimationTransformSampler(node.animation);
        transformSamplers.set(node.animation, sampler);
      }
      return new EffectModelAnimation(node.animation, node.duration!, sampler);
    });
    this.matrices = resource.nodes.map(() => new Array<number>(16).fill(0));
    this.graphics = {ambient: [0, 0, 0], emissive: library.graphics.emissive};
    this.draws = resource.nodes.flatMap((node, index) => node.parts.map(part => ({node: index, part, ambient: [0, 0, 0, 0]})));
    for (const draw of this.draws) if (!draw.part.asset) throw new Error(`Missing original model texture ${resource.reference}`);
  }
  setTime(time: number): void {
    for (const animation of this.animations) animation?.setTime(time);
  }
  setRate(rate: number): void {
    for (const animation of this.animations) animation?.setRate(rate);
  }
  update(): void {
    for (const animation of this.animations) animation?.update(this.delta());
  }

  draw(state: EffectModelDraw | undefined): void {
    if (!state) {
      for (const draw of this.draws) draw.renderer?.mesh.setEnabled(false);
      return;
    }
    const matrices = this.matrices;
    for (let index = 0; index < this.resource.nodes.length; index++) {
      const node = this.resource.nodes[index];
      const local = this.animations[index]?.matrix ?? EFFECT_IDENTITY;
      multiplyEffectMatricesToRef(node.parent == null ? state.matrix : matrices[node.parent], local, matrices[index]);
    }
    const graphics = this.graphics;
    const ambient = graphics.ambient as number[];
    const color = this.scene.ambientColor;
    for (let axis = 0; axis < 3; axis++) ambient[axis] = color.equalsFloats(0, 0, 0)
      ? this.library.graphics.ambient[axis] : axis === 0 ? color.r : axis === 1 ? color.g : color.b;
    for (let index = 0; index < this.draws.length; index++) {
      const draw = this.draws[index];
      const node = this.resource.nodes[draw.node];
      const vertices = this.vertices[draw.node] ??=
        new EffectModelVertices(this.scene, node.vertexData!, !!node.animation);
      vertices.setTime(this.animations[draw.node]?.time ?? 0);
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
        }, vertices, draw.part.indices);
        draw.renderer.mesh.metadata = {originalEffect: this.name, sourceNode: this.sourceNode,
          sourceModel: this.resource.reference, sourceModelNode: draw.node};
        this.renderedMeshes[index] = draw.renderer.mesh;
        draw.script = script;
      }
      setSceneModelPriority(draw.renderer!.mesh, state.priority);
      draw.renderer!.mesh.setEnabled(true);
      draw.renderer!.update(matrices[draw.node], effectModelAmbient(draw.part.properties, state.alpha, graphics, draw.ambient));
    }
  }
  get meshes(): Mesh[] {return this.renderedMeshes;}
  dispose(): void {
    this.draws.forEach(draw => draw.renderer?.dispose());
    this.vertices.forEach(vertices => vertices?.dispose());
    this.renderedMeshes.length = 0;
  }
}
