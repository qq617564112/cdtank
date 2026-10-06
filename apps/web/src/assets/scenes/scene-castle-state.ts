/** Accepted Castle transaction values supplied by the authoritative battle owner. */
export interface CastleDamageResult {
  currentHP: number;
  maxHP: number;
  delta: number;
}

export type CastleRestoreResult = Pick<CastleDamageResult, 'currentHP' | 'maxHP'>;

export type CastleEffectTarget = 'root' | 0 | 1 | 2 | 3 | 4;
export type CastlePresentationCommand =
  {kind: 'sound'; name: 'GA48' | 'se07' | 'se03'; target: 'position' | 0 | 3;
    selector: 1 | -1; slot?: number} |
  {kind: 'action'; name: 'c2' | 'c3' | 'n1' | 'n2'; mode: 0 | 4} |
  {kind: 'effect'; name: '039' | '040' | '041'; target: CastleEffectTarget;
    slot?: number} |
  {kind: 'stopEffect' | 'stopSound'; slot: number} |
  {kind: 'destroyCallback'} |
  {kind: 'damageText'; delta: number};

/** Original45d16f action stage and five once-entered effect bits, independent of damage rules. */
export class SceneCastleState {
  private stage = 2;
  private mask = 0;

  /** Consume one accepted transaction, never a repeated render snapshot. */
  damage(result: CastleDamageResult): CastlePresentationCommand[] {
    const {currentHP: hp, maxHP, delta} = result;
    if (delta < 0) return this.repair(hp, maxHP);
    const commands: CastlePresentationCommand[] = [
      {kind: 'sound', name: 'GA48', target: 'position', selector: 1},
    ];
    if (hp === 0 && this.stage !== 0) {
      this.stage = 0;
      commands.push({kind: 'destroyCallback'}, {kind: 'action', name: 'c3', mode: 0});
      for (const target of [0, 1, 2, 3, 4] as const) {
        commands.push({kind: 'effect', name: '041', target});
      }
      commands.push({kind: 'sound', name: 'se07', target: 0, selector: 1});
      this.stopSounds(commands);
    } else if (hp > 0 && hp < Math.trunc(maxHP / 3) && this.stage !== 1) {
      this.stage = 1;
      commands.push({kind: 'action', name: 'c2', mode: 0},
        {kind: 'effect', name: '041', target: 'root'},
        {kind: 'sound', name: 'se07', target: 0, selector: 1});
    } else if (this.stage === 1 || this.stage === 2) {
      commands.push({kind: 'action', name: this.stage === 1 ? 'n2' : 'n1', mode: 4});
    }
    commands.push({kind: 'damageText', delta});
    this.updateSpouts(hp, maxHP, commands);
    return commands;
  }

  /**
   * Accepted building-tool restoration. Server prohibits destroyed resurrection, so only a
   * living positive HP result reaches the steady n1/n2 stage; obsolete fifth-stage cues are
   * released and their once-entered bits cleared so a later hit re-runs that source stage.
   */
  private repair(hp: number, maxHP: number): CastlePresentationCommand[] {
    const commands: CastlePresentationCommand[] = [];
    if (hp <= 0 || this.stage === 0) return commands;
    const stage = this.stageFor(hp, maxHP);
    this.stage = stage;
    commands.push(this.stageAction(stage));
    this.releaseObsoleteSpouts(hp, maxHP, commands);
    return commands;
  }

  /** Recover current authority without replaying missed hit or collapse transactions. */
  restore({currentHP: hp, maxHP}: CastleRestoreResult): CastlePresentationCommand[] {
    const commands: CastlePresentationCommand[] = [];
    const stage = this.stageFor(hp, maxHP);
    if (stage !== this.stage) {
      this.stage = stage;
      commands.push(this.stageAction(stage));
    }
    this.updateSpouts(hp, maxHP, commands);
    return commands;
  }

  private stageFor(hp: number, maxHP: number): 0 | 1 | 2 {
    return hp === 0 ? 0 : hp < Math.trunc(maxHP / 3) ? 1 : 2;
  }

  private stageAction(stage: 0 | 1 | 2): CastlePresentationCommand {
    return {kind: 'action', name: stage === 0 ? 'c3' : stage === 1 ? 'n2' : 'n1',
      mode: stage === 0 ? 0 : 4};
  }

  private damageSlot(hp: number, maxHP: number): 0 | 1 | 2 | 3 | undefined {
    const fifth = Math.trunc(maxHP / 5);
    return hp > 0 && hp <= fifth ? 3 :
      hp > fifth && hp <= 2 * fifth ? 2 :
      hp > 2 * fifth && hp <= 3 * fifth ? 1 :
      hp > 3 * fifth && hp <= 4 * fifth ? 0 : undefined;
  }

  private releaseObsoleteSpouts(hp: number, maxHP: number,
    commands: CastlePresentationCommand[]): void {
    const slot = this.damageSlot(hp, maxHP);
    for (let index = 0; index < 4; index++) {
      if (!(this.mask & (1 << index))) continue;
      if (slot !== undefined && index <= slot) continue;
      this.mask &= ~(1 << index);
      commands.push({kind: 'stopEffect', slot: index}, {kind: 'stopSound', slot: index});
    }
  }

  private updateSpouts(hp: number, maxHP: number, commands: CastlePresentationCommand[]): void {
    const fifth = Math.trunc(maxHP / 5);
    if (hp === 0 && !(this.mask & 16)) {
      this.mask |= 16;
      for (let slot = 0; slot < 5; slot++) commands.push({kind: 'stopEffect', slot});
      for (const target of [0, 1, 2, 3, 4] as const) {
        commands.push({kind: 'effect', name: '039', target, slot: target});
      }
      this.stopSounds(commands);
    } else {
      const slot = this.damageSlot(hp, maxHP);
      if (slot !== undefined && !(this.mask & (1 << slot))) {
        this.mask |= 1 << slot;
        commands.push({kind: 'effect', name: '040', target: slot, slot},
          {kind: 'stopSound', slot},
          {kind: 'sound', name: 'se03', target: 3, selector: -1, slot});
      }
    }
  }

  snapshot(): {stage: number; mask: number} {return {stage: this.stage, mask: this.mask};}

  private stopSounds(commands: CastlePresentationCommand[]): void {
    for (let slot = 0; slot < 5; slot++) commands.push({kind: 'stopSound', slot});
  }
}
