import {EffectModelBackend, EffectModelControl, EffectModelNodeState} from '../models/effect-model-node';
import {EffectRuntimeRetainedState, EffectRuntimeStatePool} from './effect-runtime-state-pool';
import {EffectBoltNodeState} from '../bolts/effect-bolt-node';
import {EffectBoltConfig} from '../bolts/effect-bolt-segments';
import {EffectTargetProvider} from './effect-target-provider';
import {EffectOverlayControl, EffectOverlayNodeState} from '../overlays/effect-overlay-node';
import {EffectScreenBackend, EffectScreenConfig, EffectScreenNodeState} from './effect-screen-node';
import {EffectLifecycleHooks, EffectNodeLifecycle} from './effect-lifecycle';
import {EffectSpriteNodeState, EffectSpriteController} from '../sprites/effect-sprite-node';
import {EffectParticleNodeState, EffectParticleController} from '../particles/effect-particle-node';
import {EffectStripNodeState, EffectStripController} from '../strips/effect-strip-node';
import {EffectSoundNodeState, EffectSoundBackend, EffectSoundStore} from './effect-sound-node';
import {EffectNativeMatrix} from '../common/effect-native-space';
import {EFFECT_IDENTITY} from '../common/effect-render-transform';
import {EffectTimelineConfig} from './effect-timeline';
import {EffectVec3} from '../common/types';
import {createEffectTree} from './effect-tree-create';

const ignoreReleasedNode = (): void => {};

export interface EffectRuntimeDefinition {index: number; id: number; type: number; children: number[]; name: string;}
interface NodeControl {node: number;}
const nodeControlTables = new WeakMap<readonly NodeControl[], Map<number, readonly NodeControl[]>>();
const firstNodeControlTables = new WeakMap<readonly NodeControl[], Map<number, NodeControl>>();

/** Single-record consumers retain the first source row without a grouping array. */
function firstControlForNode<T extends NodeControl>(controls: readonly T[], node: number): T {
  let table = firstNodeControlTables.get(controls);
  if (!table) {
    table = new Map();
    for (const control of controls) if (!table.has(control.node)) table.set(control.node, control);
    firstNodeControlTables.set(controls, table);
  }
  return table.get(node) as T;
}

/** Loaded control arrays are immutable; keep source order and the first match. */
function controlsForNode<T extends NodeControl>(controls: readonly T[], node: number): readonly T[] {
  let table = nodeControlTables.get(controls);
  if (!table) {
    const grouped = new Map<number, NodeControl[]>();
    for (const control of controls) {
      let rows = grouped.get(control.node);
      if (!rows) {rows = []; grouped.set(control.node, rows);}
      rows.push(control);
    }
    table = grouped;
    nodeControlTables.set(controls, table);
  }
  return (table.get(node) ?? []) as readonly T[];
}

const definitionTables = new WeakMap<EffectRuntimeLibrary, Map<number, EffectRuntimeDefinition>>();

function definitionsForLibrary(library: EffectRuntimeLibrary): Map<number, EffectRuntimeDefinition> {
  let table = definitionTables.get(library);
  if (!table) {
    table = new Map();
    for (const definition of library.nodes) {
      if (definition.id !== 0 && !table.has(definition.id)) table.set(definition.id, definition);
    }
    definitionTables.set(library, table);
  }
  return table;
}
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
  releaseState(): void;
}

/** Instance state doubles as lifecycle hooks; methods are shared across nodes. */
class RuntimeNodeState implements EffectRuntimeNode, EffectLifecycleHooks {
  readonly lifecycle: EffectNodeLifecycle;
  sprite?: EffectSpriteNodeState;
  particle?: EffectParticleNodeState;
  strip?: EffectStripNodeState;
  sound?: EffectSoundNodeState<number>;
  bolt?: EffectBoltNodeState;
  overlay?: EffectOverlayNodeState;
  screen?: EffectScreenNodeState;
  model?: EffectModelNodeState;
  private retained?: EffectRuntimeRetainedState;
  private stateActive = true;

  constructor(readonly definition: EffectRuntimeDefinition, timing: EffectTimelineConfig,
    retainWhenEnded: boolean, private readonly origin: EffectVec3,
    private readonly released: (node: number) => void, private readonly pool?: EffectRuntimeStatePool) {
    this.lifecycle = new EffectNodeLifecycle(timing, this, retainWhenEnded);
  }

  takeRetainedState(): void {
    this.retained = this.pool?.take(this.definition.type);
    if (this.retained && this.strip) this.strip.scroll = this.retained.stripScroll;
  }

  start(): void {
    this.sprite?.start(this.origin);
    if (this.sprite && this.retained && !this.sprite.controls[0].trailEnabled) {
      this.sprite.history.elapsed = this.retained.trailElapsed;
    }
    this.particle?.start(this.origin);
    this.strip?.start(this.origin);
    this.sound?.start();
    this.bolt?.start(this.origin);
    this.overlay?.start();
    this.model?.start(this.origin);
  }

  activate(node: EffectNodeLifecycle): void {this.screen?.activate(node.timing.lifetime);}

  reset(_node: EffectNodeLifecycle, index: number): void {
    this.sprite?.reset(index);
    this.particle?.reset(index);
    this.strip?.reset(index);
    this.overlay?.reset(index);
    this.model?.reset(index);
  }

  update(node: EffectNodeLifecycle, delta: number): void {
    this.sprite?.update(node.elapsed, delta);
    this.particle?.update(node.elapsed, delta);
    this.strip?.update(node.elapsed, delta);
    this.sound?.update();
    this.bolt?.update(delta);
    this.overlay?.update(delta);
    this.model?.update(node.elapsed, delta);
  }

  end(): void {
    this.particle?.end();
    this.sound?.end();
    this.screen?.end();
  }

  additionalEnd(_node: EffectNodeLifecycle, ended: boolean): boolean {
    return this.sound?.additionalEnd(ended) ?? false;
  }

  release(): void {
    this.releaseState();
    this.released(this.definition.index);
  }

  releaseState(): void {
    if (!this.stateActive) return;
    this.stateActive = false;
    this.bolt?.target.bind();
    if (this.retained) {
      this.retained.trailElapsed = this.sprite?.history?.elapsed ?? this.retained.trailElapsed;
      this.retained.stripScroll = this.strip?.scroll ?? this.retained.stripScroll;
      this.pool!.release(this.retained);
    }
  }
}

/** Original source-tree composition for containers, sprites, bolts, sounds, particles, strips and overlays. */
export class EffectRuntimeTree {
  readonly root: EffectRuntimeNode;
  readonly nodes: EffectRuntimeNode[] = [];
  readonly origin: EffectVec3;
  constructor(library: EffectRuntimeLibrary, identifier: number, origin: EffectVec3,
    readonly parentMatrix: EffectNativeMatrix | undefined, random: () => number,
    soundBackend: EffectSoundBackend<number>, soundShared: EffectSoundStore<number>,
    released: (node: number) => void = ignoreReleasedNode, pool?: EffectRuntimeStatePool, screenBackend?: EffectScreenBackend,
    modelBackend?: (definition: EffectRuntimeDefinition) => EffectModelBackend,
    globalMatrix: EffectNativeMatrix = EFFECT_IDENTITY,
    targetProvider?: EffectTargetProvider, retain = false, visualDensity = 1) {
    this.origin = parentMatrix ? [0, 0, 0] : [...origin];
    const definitions = definitionsForLibrary(library);
    const root = createEffectTree(identifier, retain, {
      lookup: id => definitions.get(id),
      create: (definition, retainWhenEnded): EffectRuntimeNode => {
        const timing = firstControlForNode(library.nodeTimings, definition.index);
        const node = new RuntimeNodeState(definition, timing, retainWhenEnded, this.origin, released, pool);
        if (definition.type === 1) {
          const controls = controlsForNode(library.spriteControls, definition.index);
          node.sprite = new EffectSpriteNodeState(controls, random, EFFECT_IDENTITY, parentMatrix, false, undefined, visualDensity);
        } else if (definition.type === 6) {
          const controls = controlsForNode(library.particleControls, definition.index);
          node.particle = new EffectParticleNodeState(controls,
            controls.map(() => ({position: [0, 0, 0], orbitOffset: [0, 0, 0]})),
            undefined, controls[0].capacity, random, EFFECT_IDENTITY, parentMatrix, visualDensity);
        } else if (definition.type === 7) {
          const controls = controlsForNode(library.stripControls, definition.index);
          const grid = firstControlForNode(library.textureGrids, definition.index);
          node.strip = new EffectStripNodeState(controls, grid.uvFrames, random, EFFECT_IDENTITY, parentMatrix);
        } else if (definition.type === 2) {
          node.bolt = new EffectBoltNodeState(firstControlForNode(library.boltControls, definition.index), random, parentMatrix, targetProvider);
        } else if (definition.type === 8) {
          node.overlay = new EffectOverlayNodeState(controlsForNode(library.overlayControls, definition.index), random);
        } else if ((definition.type === 10 || definition.type === 11) && screenBackend) {
          node.screen = new EffectScreenNodeState(firstControlForNode(library.screenControls, definition.index), screenBackend);
        } else if (definition.type === 5 && modelBackend) {
          node.model = new EffectModelNodeState(controlsForNode(library.modelControls, definition.index),
            globalMatrix, !!parentMatrix, modelBackend(definition));
        } else if (definition.type === 4) {
          const control = firstControlForNode(library.soundControls, definition.index);
          node.sound = new EffectSoundNodeState(control.reference, control.parameter, control.stopPrevious, soundBackend, soundShared);
        } else if (definition.type !== 0) {
          throw new Error(`Unsupported battle effect source type ${definition.type}`);
        }
        node.takeRetainedState();
        this.nodes.push(node);
        return node;
      },
      attach: (parent, child) => parent.lifecycle.attach(child.lifecycle),
    });
    if (!root) throw new Error(`Missing original battle effect ${identifier}`);
    this.root = root;
  }

  dispose(): void {
    for (const node of this.nodes) {
      if (node.lifecycle.phase !== 0) node.sound?.end();
      node.screen?.end();
      node.releaseState();
    }
  }

  start(): void {this.root.lifecycle.start();}
  stop(): void {this.root.lifecycle.stop();}
  update(deltaSeconds: number): void {this.root.lifecycle.tick(deltaSeconds);}
  get ended(): boolean {return this.root.lifecycle.phase === 0;}

  /** Empty source containers remain native-active; reclaim their Web render resources. */
  get quiescent(): boolean {
    for (const node of this.nodes) {
      if (node.definition.type === 0) {
        if (node.lifecycle.phase === 1) return false;
      } else if (node.lifecycle.phase !== 0 && !this.webExhaustedParticle(node)) return false;
    }
    return true;
  }

  /** Final zero-rate or completed burst emitters cannot refill an empty particle pool. */
  private webExhaustedParticle(node: EffectRuntimeNode): boolean {
    if (node.definition.type !== 6 || node.lifecycle.phase !== 2) {
      return false;
    }
    const particle = node.particle;
    const controls = particle?.controls;
    const controller = node.lifecycle.controller;
    if (!particle || !controls || controls.length === 0 || controller !== controls.length - 1 ||
        particle.controller !== controller) {
      return false;
    }
    const emitter = controls[controller].emitter;
    return particle.pool.particles.length === 0 &&
      (emitter.countRange[1] <= 0 || (emitter.burst && particle.emitter.burstEmitted));
  }
}
