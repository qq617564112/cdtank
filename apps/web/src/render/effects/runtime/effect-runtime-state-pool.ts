import {EffectObjectPool} from './effect-object-pool';

export interface EffectRuntimeRetainedState {type: number; trailElapsed: number; stripScroll: number;}

/** Type-specific fields survive native unbind and rebind for battle sprite/strip nodes. */
export class EffectRuntimeStatePool {
  private readonly pools = new Map<number, EffectObjectPool<EffectRuntimeRetainedState>>();

  take(type: number): EffectRuntimeRetainedState | undefined {
    if (type !== 1 && type !== 7) return undefined;
    let pool = this.pools.get(type);
    if (!pool) {
      pool = new EffectObjectPool(() => ({type, trailElapsed: 0, stripScroll: 0}), () => {});
      this.pools.set(type, pool);
    }
    return pool.take();
  }

  release(state: EffectRuntimeRetainedState): void {this.pools.get(state.type)!.release(state);}
}
