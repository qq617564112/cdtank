import {withResourceTimeout} from '../assets/static-resources';
import {loadStaticResourceBlob} from '../assets/static-resource-cache';

const decodedSounds = new Map<string, Promise<AudioBuffer>>();

/** AudioBuffers can be shared by the battle, effect and result audio contexts. */
export function loadAudioBuffer(url: string, context: AudioContext): Promise<AudioBuffer> {
  const key = new URL(url, location.href).href;
  const cached = decodedSounds.get(key);
  if (cached) return cached;
  const loading = (async () => {
    const blob = await loadStaticResourceBlob(key);
    // Each decoder owns its input; the complete file remains in IndexedDB.
    const bytes = await blob.arrayBuffer();
    return await withResourceTimeout(context.decodeAudioData(bytes), url);
  })().catch(error => {
    if (decodedSounds.get(key) === loading) decodedSounds.delete(key);
    throw error;
  });
  decodedSounds.set(key, loading);
  return loading;
}

/** Map loops keep their PCM only while that map owns the audio sources. */
export function releaseAudioBuffer(url: string): void {
  decodedSounds.delete(new URL(url, location.href).href);
}
