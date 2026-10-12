import {loadStaticBinary, withResourceTimeout} from '../assets/static-resources';

const decodedSounds = new Map<string, Promise<AudioBuffer>>();

/** AudioBuffers can be shared by the battle, effect and result audio contexts. */
export function loadAudioBuffer(url: string, context: AudioContext): Promise<AudioBuffer> {
  const key = new URL(url, location.href).href;
  const cached = decodedSounds.get(key);
  if (cached) return cached;
  const loading = (async () => {
    const bytes = await loadStaticBinary(key);
    // decodeAudioData takes ownership of its input; preserve the downloaded body.
    return await withResourceTimeout(context.decodeAudioData(bytes.slice(0)), url);
  })().catch(error => {decodedSounds.delete(key); throw error;});
  decodedSounds.set(key, loading);
  return loading;
}
