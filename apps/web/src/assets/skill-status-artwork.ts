export interface SkillStatusArtwork {
  effectId: number;
  label: string;
  asset: string;
  durationSeconds: number;
}

/** Original status sprites and their one-shot source animation lengths. */
const definitions = [
  {effectId: 101, label: '幸运', durationSeconds: 1.6},
  {effectId: 102, label: '暴击提升', durationSeconds: 1.6},
  {effectId: 103, label: '暴击降低', durationSeconds: .8},
  {effectId: 104, label: '幸运提升', durationSeconds: 1.6},
  {effectId: 105, label: '幸运降低', durationSeconds: .8},
  {effectId: 106, label: '攻击提升', durationSeconds: 1.6},
  {effectId: 107, label: '攻击降低', durationSeconds: .8},
  {effectId: 108, label: '防御提升', durationSeconds: 1.6},
  {effectId: 109, label: '防御降低', durationSeconds: .8},
  {effectId: 110, label: '速度提升', durationSeconds: 1.6},
  {effectId: 111, label: '速度降低', durationSeconds: .8},
  {effectId: 112, label: '不能移动', durationSeconds: .8},
  {effectId: 113, label: '回旋提升', durationSeconds: 1.6},
  {effectId: 114, label: '回旋降低', durationSeconds: .8},
  {effectId: 115, label: '不能转向', durationSeconds: .8},
  {effectId: 116, label: '射速提升', durationSeconds: 1.6},
  {effectId: 117, label: '射速降低', durationSeconds: .8},
  {effectId: 118, label: '不能射击', durationSeconds: .8},
];

export const SKILL_STATUS_ARTWORK: ReadonlyMap<number, SkillStatusArtwork> = new Map(definitions
  .map(status => [status.effectId, {...status, asset: `Data/effect/xy/${status.effectId}.png`}]));

const statusAssets = new Set([...SKILL_STATUS_ARTWORK.values()].map(status => status.asset));

export function isSkillStatusAsset(asset: string): boolean {return statusAssets.has(asset);}
