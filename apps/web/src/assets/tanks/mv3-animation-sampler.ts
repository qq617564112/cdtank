import type {Animation, AnimationGroup, AssetContainer, MorphTarget} from '@babylonjs/core';

interface MorphTrack {animation: Animation; target: MorphTarget;}

/** convert_mv3.py exports linear, one-hot weights on a shared key timeline. */
class Mv3AnimationSampler {
  private readonly frames: number[];
  private readonly intervals: MorphTrack[][];
  private previous: readonly MorphTrack[] = [];
  readonly maxInfluencers: number;

  constructor(private readonly group: AnimationGroup) {
    const tracks: MorphTrack[] = group.targetedAnimations.map(track => ({
      animation: track.animation, target: track.target as MorphTarget,
    }));
    this.frames = tracks[0].animation.getKeys().map(key => key.frame);
    this.intervals = this.frames.map((_, index) => tracks.filter(track => {
      const keys = track.animation.getKeys();
      return keys[index].value !== 0 || (keys[index + 1]?.value ?? 0) !== 0;
    }));
    this.maxInfluencers = Math.max(...this.intervals.map(tracks => tracks.length));
  }

  sample(milliseconds: number): void {
    const frame = Math.max(this.frames[0], Math.min(this.frames[this.frames.length - 1],
      milliseconds / 1000 * this.group.targetedAnimations[0].animation.framePerSecond));
    let low = 0, high = this.frames.length - 1;
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      if (this.frames[middle] <= frame) low = middle;
      else high = middle - 1;
    }
    const active = this.intervals[low];
    for (const track of this.previous) {
      if (!active.includes(track)) track.target.influence = 0;
    }
    for (const track of active) track.target.influence = track.animation.evaluate(frame) as number;
    this.previous = active;
  }
}

/** Keep interpolation exact while sampling only the adjacent source poses. */
export function createMv3AnimationSampler(assets: AssetContainer): (milliseconds: number) => void {
  const samplers = assets.animationGroups.map(group => new Mv3AnimationSampler(group));
  const fixedManagers = new Set<AssetContainer['morphTargetManagers'][number]>();
  for (let index = 0; index < samplers.length; ++index) {
    const targets = new Set(assets.animationGroups[index].targetedAnimations.map(track => track.target));
    for (const manager of assets.morphTargetManagers) {
      if (!manager.isUsingTextureForTargets || !targets.has(manager.getTarget(0))) continue;
      manager.optimizeInfluencers = true;
      manager.numMaxInfluencers = samplers[index].maxInfluencers;
      fixedManagers.add(manager);
    }
  }
  return milliseconds => {
    for (const sampler of samplers) sampler.sample(milliseconds);
    // The fixed texture shader updates weights without recompiling on zero crossings.
    // Babylon otherwise scans every scene mesh to dirty the unchanged attributes.
    for (const manager of fixedManagers) Reflect.set(manager, '_needUpdateInfluences', false);
  };
}
