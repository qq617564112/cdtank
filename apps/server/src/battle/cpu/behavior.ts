export type BotSkill = 'LOW' | 'MEDIUM' | 'HIGH';

interface BotBehavior {
  readonly reactionMs: readonly [number, number];
  readonly triggerMs: readonly [number, number];
  readonly movementMs: readonly [number, number];
  readonly aimTolerance: number;
}

export const BOT_BEHAVIORS: Readonly<Record<BotSkill, BotBehavior>> = {
  HIGH: {reactionMs: [160, 320], triggerMs: [80, 170], movementMs: [250, 550], aimTolerance: .035},
  MEDIUM: {reactionMs: [280, 550], triggerMs: [130, 280], movementMs: [600, 1100], aimTolerance: .045},
  LOW: {reactionMs: [450, 950], triggerMs: [220, 480], movementMs: [900, 1700], aimTolerance: .055},
};

/** Two or more CPUs always include both levels; odd rounds randomize the extra level. */
export function randomBotSkills(count: number): BotSkill[] {
  const first = Math.random() < .5 ? 'HIGH' : 'LOW';
  const second = first === 'HIGH' ? 'LOW' : 'HIGH';
  const skills: BotSkill[] = Array.from({length: count}, (_, index) => index % 2 === 0 ? first : second);
  for (let index = skills.length - 1; index > 0; index--) {
    const other = Math.floor(Math.random() * (index + 1));
    [skills[index], skills[other]] = [skills[other], skills[index]];
  }
  return skills;
}

export function randomBotDelay(range: readonly [number, number]): number {
  return range[0] + Math.random() * (range[1] - range[0]);
}
