import {EffectModelBackend, EffectModelControl, EffectModelNodeState} from '../models/effect-model-node';
import {EffectRuntimeStatePool} from './effect-runtime-state-pool';
import {EffectBoltNodeState} from '../bolts/effect-bolt-node';
import {EffectBoltConfig} from '../bolts/effect-bolt-segments';
import {EffectTargetProvider} from './effect-target-provider';
import {EffectOverlayControl, EffectOverlayNodeState} from '../overlays/effect-overlay-node';
import {EffectScreenBackend, EffectScreenConfig, EffectScreenNodeState} from './effect-screen-node';
import {EffectNodeLifecycle} from './effect-lifecycle';
import {EffectSpriteNodeState, EffectSpriteController} from '../sprites/effect-sprite-node';
import {EffectParticleNodeState, EffectParticleController} from '../particles/effect-particle-node';
import {EffectStripNodeState, EffectStripController} from '../strips/effect-strip-node';
import {EffectSoundNodeState, EffectSoundBackend, EffectSoundStore} from './effect-sound-node';
import {EffectNativeMatrix} from '../common/effect-native-space';
import {EffectTimelineConfig} from './effect-timeline';
import {EffectVec3} from '../common/types';
import {createEffectTree, findEffectDefinition} from './effect-tree-create';

export interface EffectRuntimeDefinition {index: number; id: number; type: number; children: number[]; name: string;}
interface NodeControl {node: number;}
export interface EffectRuntimeGrid {node: number; asset: string; resolution: string; uvFrames: [number, number, number, number][];}
export interface EffectRuntimeLibrary {
  nodes: EffectRuntimeDefinition[];
  nodeTimings: (EffectTimelineConfig & NodeControl)[];
  spriteControls: (EffectSpriteController & NodeControl)[];
  particleControls: (EffectParticleController & NodeControl & {capacity: number})[];
  stripControls: (EffectStripController & NodeControl)[];
  soundControls: (NodeControl & {reference: string; parameter: number; stopPrevious: boolean})[];
  textureGrids: EffectRuntimeGrid[];
  boltControls: (EffectBoltConfig & NodeControl & {interval: number; width: number; color: number; flag: boolean})[];
  boltTextures: EffectRuntimeGrid[];
  overlayControls: (EffectOverlayControl & NodeControl & {textured: boolean})[];
  screenControls: (EffectScreenConfig & NodeControl)[];
  modelControls: (EffectModelControl & NodeControl)[];
}
export interface EffectRuntimeNode {
  definition: EffectRuntimeDefinition;
  lifecycle: EffectNodeLifecycle;
  sprite?: EffectSpriteNodeState;
  particle?: EffectParticleNodeState;
  strip?: EffectStripNodeState;
  sound?: EffectSoundNodeState<number>;
  bolt?: EffectBoltNodeState;
  overlay?: EffectOverlayNodeState;
  screen?: EffectScreenNodeState;
  model?: EffectModelNodeState;
  children: EffectRuntimeNode[];
  releaseState(): void;
}

/** Original source-tree composition for containers, sprites, bolts, sounds, particles, strips and overlays. */
export class EffectRuntimeTree {
  readonly root: EffectRuntimeNode;
  readonly nodes: EffectRuntimeNode[] = [];
  readonly origin: EffectVec3;
  constructor(library: EffectRuntimeLibrary, identifier: number, origin: EffectVec3,
    readonly parentMatrix: EffectNativeMatrix | undefined, random: () => number,
    soundBackend: EffectSoundBackend<number>, soundShared: EffectSoundStore<number>,
    released: (node: number) => void = () => {}, pool?: EffectRuntimeStatePool, screenBackend?: EffectScreenBackend,
    modelBackend?: (definition: EffectRuntimeDefinition) => EffectModelBackend,
    globalMatrix: EffectNativeMatrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
    targetProvider?: EffectTargetProvider, retain = false) {
    this.origin = parentMatrix ? [0, 0, 0] : [...origin];
    const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    const root = createEffectTree(identifier, retain, {
      lookup: id => findEffectDefinition(library.nodes, id),
      create: (definition, retainWhenEnded): EffectRuntimeNode => {
        const timing = library.nodeTimings.find(row => row.node === definition.index)!;
        let sprite: EffectSpriteNodeState | undefined;
        let particle: EffectParticleNodeState | undefined;
        let strip: EffectStripNodeState | undefined;
        let sound: EffectSoundNodeState<number> | undefined;
        let bolt: EffectBoltNodeState | undefined;
        let overlay: EffectOverlayNodeState | undefined;
        let screen: EffectScreenNodeState | undefined;
        let model: EffectModelNodeState | undefined;
        if (definition.type === 1) {
          const controls = library.spriteControls.filter(row => row.node === definition.index);
          sprite = new EffectSpriteNodeState(controls, random, identity, parentMatrix);
        } else if (definition.type === 6) {
          const controls = library.particleControls.filter(row => row.node === definition.index);
          particle = new EffectParticleNodeState(controls,
            controls.map(() => ({position: [0, 0, 0], orbitOffset: [0, 0, 0]})),
            controls.map(() => undefined), controls[0].capacity, random, identity, parentMatrix);
        } else if (definition.type === 7) {
          const controls = library.stripControls.filter(row => row.node === definition.index);
          const grid = library.textureGrids.find(row => row.node === definition.index)!;
          strip = new EffectStripNodeState(controls, grid.uvFrames, random, identity, parentMatrix);
        } else if (definition.type === 2) {
          bolt = new EffectBoltNodeState(library.boltControls.find(row => row.node === definition.index)!, random, parentMatrix, targetProvider);
        } else if (definition.type === 8) {
          overlay = new EffectOverlayNodeState(library.overlayControls.filter(row => row.node === definition.index), random);
        } else if ((definition.type === 10 || definition.type === 11) && screenBackend) {
          screen = new EffectScreenNodeState(library.screenControls.find(row => row.node === definition.index)!, screenBackend);
        } else if (definition.type === 5 && modelBackend) {
          model = new EffectModelNodeState(library.modelControls.filter(row => row.node === definition.index),
            globalMatrix, !!parentMatrix, modelBackend(definition));
        } else if (definition.type === 4) {
          const control = library.soundControls.find(row => row.node === definition.index)!;
          sound = new EffectSoundNodeState(control.reference, control.parameter, control.stopPrevious, soundBackend, soundShared);
        } else if (definition.type !== 0) {
          throw new Error(`Unsupported battle effect source type ${definition.type}`);
        }
        const retained = pool?.take(definition.type);
        let stateActive = true;
        if (retained && strip) strip.scroll = retained.stripScroll;
        const releaseState = (): void => {
          if (!stateActive) return;
          stateActive = false;
          bolt?.target.bind();
          if (retained) {
            retained.trailElapsed = sprite?.history?.elapsed ?? retained.trailElapsed;
            retained.stripScroll = strip?.scroll ?? retained.stripScroll;
            pool!.release(retained);
          }
        };
        const lifecycle = new EffectNodeLifecycle(timing, {
          start: () => {sprite?.start(this.origin); if (sprite && retained && !sprite.controls[0].trailEnabled) sprite.history.elapsed = retained.trailElapsed; particle?.start(this.origin); strip?.start(this.origin); sound?.start(); bolt?.start(this.origin); overlay?.start(); model?.start(this.origin);},
          activate: () => {screen?.activate(timing.lifetime);}, reset: (_, index) => {sprite?.reset(index); particle?.reset(index); strip?.reset(index); overlay?.reset(index); model?.reset(index);},
          update: (node, delta) => {sprite?.update(node.elapsed, delta); particle?.update(node.elapsed, delta); strip?.update(node.elapsed, delta); sound?.update(); bolt?.update(delta); overlay?.update(delta); model?.update(node.elapsed, delta);},
          end: () => {particle?.end(); sound?.end(); screen?.end();}, additionalEnd: (_, ended) => sound?.additionalEnd(ended) ?? false,
          release: () => {releaseState(); released(definition.index);},
        }, retainWhenEnded);
        const node = {definition, lifecycle, sprite, particle, strip, sound, bolt, overlay, screen, model, children: [], releaseState};
        this.nodes.push(node);
        return node;
      },
      attach: (parent, child) => {parent.children.push(child); parent.lifecycle.attach(child.lifecycle);},
    });
    if (!root) throw new Error(`Missing original battle effect ${identifier}`);
    this.root = root;
  }

  dispose(): void {
    for (const node of this.nodes) {
      if (node.lifecycle.phase !== 0) node.sound?.end();
      node.releaseState();
    }
  }

  start(): void {this.root.lifecycle.start();}
  stop(): void {this.root.lifecycle.stop();}
  update(deltaSeconds: number): void {this.root.lifecycle.tick(deltaSeconds);}
  get ended(): boolean {return this.root.lifecycle.phase === 0;}

  /** Empty source containers remain native-active; reclaim their Web render resources. */
  get quiescent(): boolean {
    return this.nodes.every(node => node.definition.type === 0 ? node.lifecycle.phase !== 1 : node.lifecycle.phase === 0);
  }
}
