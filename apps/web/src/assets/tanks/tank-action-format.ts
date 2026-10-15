import type {EffectActionEvent} from './effect-action-events';

/** One source time followed by all sixteen original attachment values. */
export const TANK_TAG_FRAME_SIZE = 17;
export const TANK_DECORATION_TAGS = ['tag_iteye', 'tag_itwing', 'tag_ithat', 'tag_itside'] as const;

export interface TankTagRange {readonly offset: number; readonly length: number;}
export interface TankActionDefinition {
  fields: {name: string; file: string};
  model: string;
  duration: number;
  events: EffectActionEvent[];
  primaryTags: {name: string; frames: TankTagRange}[];
  turretPivot: number[] | null;
  turretPivotFrames: TankTagRange | null;
  trackFile: string;
}
export interface TankComponentDefinition {part: string; actions: TankActionDefinition[];}

export interface TankTagTrack {readonly data: Float32Array; readonly length: number;}
export interface TankActionData extends Omit<TankActionDefinition, 'primaryTags' | 'turretPivotFrames'> {
  primaryTags: {name: string; frames: TankTagTrack}[];
  turretPivotFrames: TankTagTrack | null;
}
export interface TankComponentAction {part: string; action: TankActionData;}
