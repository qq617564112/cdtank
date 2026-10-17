import {readFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {LearnedCpuPolicy} from './cpu-policy';
import type {SerializedActorPolicy} from './policy';

/** Load the operator's per-mode model manifest once in each room process. */
export function loadCpuPolicies(filename?: string) {
  if (!filename) return undefined;
  const manifestPath = resolve(filename);
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
    models: {mode: number; model: string}[];
  };
  const policies = new Map<number, LearnedCpuPolicy>();
  for (const entry of manifest.models) {
    if (!Number.isInteger(entry.mode) || entry.mode < 1 || entry.mode > 5 || policies.has(entry.mode)) {
      throw new Error('CPU model manifest requires one entry per selected mode');
    }
    const model = JSON.parse(readFileSync(resolve(dirname(manifestPath), entry.model), 'utf8')) as SerializedActorPolicy;
    policies.set(entry.mode, new LearnedCpuPolicy(model));
  }
  return (mode: number) => policies.get(mode);
}
