import type {EffectTagFrame} from './effect-tag-sampler';
import {TANK_TAG_FRAME_SIZE, type TankTagTrack} from './tank-action-format';

export interface SourceMv3Extras {
  mv3Duration?: number;
  attachmentTracks?: {name: string; frames: EffectTagFrame[]}[];
}
export interface SourceMv3Material {
  readonly properties: readonly number[];
  readonly textures: readonly string[];
  readonly opacity?: number;
}
export interface Mv3AttachmentTrack {readonly name: string; readonly frames: TankTagTrack;}
export interface Mv3ModelExtras {
  readonly mv3Duration: number | undefined;
  readonly attachmentTracks: readonly Mv3AttachmentTrack[];
}

/** Keep requested attachments in one buffer; release the parsed frame objects. */
export function compactMv3Extras(source: SourceMv3Extras | undefined,
  attachmentNames: readonly string[]): Mv3ModelExtras {
  const tracks = (source?.attachmentTracks ?? []).filter(track => attachmentNames.includes(track.name));
  const frameCount = tracks.reduce((count, track) => count + track.frames.length, 0);
  const values = new Float32Array(frameCount * TANK_TAG_FRAME_SIZE);
  let offset = 0;
  const attachmentTracks = tracks.map(track => {
    const start = offset;
    for (const frame of track.frames) {
      values[offset++] = frame.time;
      for (let index = 0; index < TANK_TAG_FRAME_SIZE - 1; index++) values[offset++] = frame.matrix[index];
    }
    return {name: track.name, frames: {length: track.frames.length, data: values.subarray(start, offset)}};
  });
  return {mv3Duration: source?.mv3Duration, attachmentTracks};
}
