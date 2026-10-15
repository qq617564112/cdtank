import {Mesh, Scene, Texture} from '@babylonjs/core';
import {EffectModelAnimation, EffectModelAnimationNode} from './effect-model-animation';
import {EffectModelDraw} from './effect-model-draw';
import {effectModelMaterialSelection} from './effect-material-combo-sol';
import {effectModelAmbientColor, EffectModelGraphicsState} from './effect-model-material';
import {EffectModelMesh, type EffectModelDeviceState} from './effect-model-mesh';
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
interface PartDraw {node: number; part: ModelPart; ambient: number[]; script?: string; renderer?: EffectModelMesh;}

const transformSamplers = new WeakMap<EffectModelAnimationNode, AnimationTransformSampler>();
const modelDeviceStates = new WeakMap<EffectModelLibrary['scripts'], Map<string, Readonly<EffectModelDeviceState>>>();

/** Shared source scripts resolve fixed state; materials retain their own uniforms. */
function modelDeviceState(scripts: EffectModelLibrary['scripts'], script: string): Readonly<EffectModelDeviceState> {
  let variants = modelDeviceStates.get(scripts);
  if (!variants) {
    variants = new Map();
    modelDeviceStates.set(scripts, variants);
  }
  const cached = variants.get(script);
  if (cached) return cached;
  const resolved: EffectModelDeviceState = {cull: 'CW', depthWrite: true, depthTest: true, blend: false, alphaTest: false};
  // default.gbf supplies inherited values; the selected GBF overrides only its keys.
  for (let pass = 0; pass < 2; pass++) {
    const name = pass === 0 ? 'default' : script;
    let definition: EffectModelLibrary['scripts'][number] | undefined;
    for (const candidate of scripts) {
      if (candidate.name === name) {definition = candidate; break;}
    }
    for (const state of definition!.states) {
      const value = state.value;
      switch (state.name) {
        case 'CullMode': resolved.cull = value === 'CW' || value === 'CCW' || value === 'NONE' ? value : 'CW'; break;
        case 'ZWriteEnable': resolved.depthWrite = value === 'TRUE'; break;
        case 'ZEnable': resolved.depthTest = value === 'TRUE'; break;
        case 'AlphaBlendEnable': resolved.blend = value === 'TRUE'; break;
        case 'AlphaTestEnable': resolved.alphaTest = value === 'TRUE'; break;
      }
    }
  }
  variants.set(script, resolved);
  return resolved;
}

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
    // Empty components ensure the first draw computes every part's RGB.
    this.graphics = {ambient: [], emissive: library.graphics.emissive};
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
    const sourceAmbient = color.equalsFloats(0, 0, 0);
    let ambientChanged = false;
    for (let axis = 0; axis < 3; axis++) {
      const value = sourceAmbient ? this.library.graphics.ambient[axis]
        : axis === 0 ? color.r : axis === 1 ? color.g : color.b;
      ambientChanged ||= !Object.is(ambient[axis], value);
      ambient[axis] = value;
    }
    // Finish all RGB updates before mesh creation, which can fail and retry.
    if (ambientChanged) {
      for (const draw of this.draws) effectModelAmbientColor(draw.part.properties, graphics, draw.ambient);
    }
    for (let index = 0; index < this.draws.length; index++) {
      const draw = this.draws[index];
      const node = this.resource.nodes[draw.node];
      const vertices = this.vertices[draw.node] ??=
        new EffectModelVertices(this.scene, node.vertexData!, !!node.animation);
      vertices.setTime(this.animations[draw.node]?.time ?? 0);
      // AttachSelf retains its first choice, including when material creation must retry.
      const script = draw.script ??= effectModelMaterialSelection(node.fvf, draw.part.kind, state.blend).script;
      if (!draw.renderer) {
        const deviceState = modelDeviceState(this.library.scripts, script);
        const texture = this.textures.get(draw.part.asset!)!;
        draw.renderer = new EffectModelMesh(this.scene, texture, deviceState, vertices, draw.part.indices);
        draw.renderer.mesh.metadata = {originalEffect: this.name, sourceNode: this.sourceNode,
          sourceModel: this.resource.reference, sourceModelNode: draw.node};
        this.renderedMeshes[index] = draw.renderer.mesh;
      }
      setSceneModelPriority(draw.renderer!.mesh, state.priority);
      draw.renderer!.mesh.setEnabled(true);
      draw.ambient[3] = Math.fround(Math.fround(state.alpha) * draw.part.properties[3]);
      draw.renderer!.update(matrices[draw.node], draw.ambient);
    }
  }
  get meshes(): Mesh[] {return this.renderedMeshes;}
  dispose(): void {
    this.draws.forEach(draw => draw.renderer?.dispose());
    this.vertices.forEach(vertices => vertices?.dispose());
    this.renderedMeshes.length = 0;
  }
}
