import type {EffectRuntime} from '../../render/effects/runtime/effect-runtime';
import type {EffectNativeMatrix} from '../../render/effects/common/effect-native-space';
import type {EffectVec3} from '../../render/effects/common/types';
import {SceneCastleState, type CastleDamageResult, type CastleRestoreResult,
  type CastleEffectTarget, type CastlePresentationCommand} from './scene-castle-state';

/** Matrices are live original world matrices; tag indices mean tag_spout1 through5. */
export interface CastlePresentationView {
  position: EffectVec3;
  matrix(target: CastleEffectTarget): EffectNativeMatrix;
  action(name: 'c2' | 'c3' | 'n1' | 'n2', mode: 0 | 4, elapsedSeconds?: number): void;
  seekDestroyed(elapsedSeconds: number): void;
  damageText(delta: number): void;
  destroyCallback(): void;
}

/** Original Castle transaction consumer; the battle owner supplies accepted HP results. */
export class SceneCastlePresentation {
  private readonly state = new SceneCastleState();
  private readonly effects = new Set<number>();
  private readonly sounds = new Set<number>();
  private readonly effectSlots = new Map<number, number>();
  private readonly soundSlots = new Map<number, number>();

  constructor(private readonly view: CastlePresentationView,
    private readonly runtime: Pick<EffectRuntime,
      'spawnCastleEffect' | 'stopEffect' | 'playSceneSound' | 'stopSkillSound'>) {}

  damage(result: CastleDamageResult): void {
    this.apply(this.state.damage(result));
  }

  /** Restore steady presentation; the owner derives elapsed from destroyedAt/serverTime. */
  restore(result: CastleRestoreResult, destroyedElapsedSeconds: number): void {
    const alreadyDestroyed = this.state.snapshot().stage === 0 && result.currentHP === 0;
    this.apply(this.state.restore(result), destroyedElapsedSeconds);
    if (alreadyDestroyed) this.view.seekDestroyed(destroyedElapsedSeconds);
  }

  private apply(commands: CastlePresentationCommand[], destroyedElapsedSeconds = 0): void {
    for (const command of commands) {
      switch (command.kind) {
        case 'action': this.view.action(command.name, command.mode,
          command.name === 'c3' ? destroyedElapsedSeconds : 0); break;
        case 'destroyCallback': this.view.destroyCallback(); break;
        case 'damageText': this.view.damageText(command.delta); break;
        case 'effect': {
          const handle = this.runtime.spawnCastleEffect(command.name, this.view.matrix(command.target));
          if (handle) this.effects.add(handle);
          if (command.slot !== undefined) this.effectSlots.set(command.slot, handle);
          break;
        }
        case 'sound': {
          const matrix = command.target === 'position' ? undefined : this.view.matrix(command.target);
          const position = matrix ? [matrix[12], matrix[13], matrix[14]] as EffectVec3 : this.view.position;
          const handle = this.runtime.playSceneSound(command.name, position, command.selector);
          if (handle) this.sounds.add(handle);
          if (command.slot !== undefined) this.soundSlots.set(command.slot, handle);
          break;
        }
        case 'stopEffect': {
          const handle = this.effectSlots.get(command.slot);
          if (handle) {
            this.runtime.stopEffect(handle);
            this.effects.delete(handle);
          }
          this.effectSlots.delete(command.slot);
          break;
        }
        case 'stopSound': {
          const handle = this.soundSlots.get(command.slot);
          if (handle) {
            this.runtime.stopSkillSound(handle);
            this.sounds.delete(handle);
          }
          this.soundSlots.delete(command.slot);
          break;
        }
      }
    }
  }

  /** Owner removal ends this Castle's effects and sounds; shared runtime remains owned by Battle. */
  dispose(): void {
    this.effects.forEach(handle => this.runtime.stopEffect(handle));
    this.sounds.forEach(handle => this.runtime.stopSkillSound(handle));
    this.effects.clear();
    this.sounds.clear();
    this.effectSlots.clear();
    this.soundSlots.clear();
  }
}
