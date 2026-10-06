import type {EffectColor} from './types';

/** Native diffuse conversion: f32 channel * 255, truncate, retain low byte. */
export function packEffectColor(color: EffectColor): number {
  const bytes = color.map(channel => Math.trunc(Math.fround(channel) * 255) & 255);
  return ((bytes[3] << 24) | (bytes[0] << 16) | (bytes[1] << 8) | bytes[2]) >>> 0;
}

/** Native 0x481f60 trail alpha: subtract truncated index/count * 255 modulo 256. */
export function applyEffectTrailAlpha(packed: number, index: number, count: number): number {
  if (!Number.isInteger(count) || count < 1 || count > 0xffffffff ||
      !Number.isInteger(index) || index < 0 || index > 0x7fffffff) {
    throw new Error('Invalid original trail color index/count');
  }
  const delta = Math.trunc((1 / count) * index * -255);
  const alpha = ((packed >>> 24) + delta) & 255;
  return ((packed & 0xffffff) | (alpha << 24)) >>> 0;
}

/** Web normalized vertex channels after the native 8-bit quantization. */
export function unpackEffectColor(packed: number): EffectColor {
  return [((packed >>> 16) & 255) / 255, ((packed >>> 8) & 255) / 255,
    (packed & 255) / 255, (packed >>> 24) / 255];
}
