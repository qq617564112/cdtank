import {readFileSync, readdirSync, statSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import type {TankDefinition} from '../shared/content/types';
import type {EffectTagFrame} from './src/assets/tanks/effect-tag-sampler';
import {TANK_TAG_FRAME_SIZE, type TankActionDefinition, type TankTagRange} from './src/assets/tanks/tank-action-format';

interface SourceAction extends Omit<TankActionDefinition, 'primaryTags' | 'turretPivotFrames' | 'trackFile'> {
  primaryTags: {name: string; frames: EffectTagFrame[]}[];
  turretPivotFrames: EffectTagFrame[] | null;
}
export interface PublishedContentAsset {path: string; source: Buffer; modifiedAt: number;}

/** The packing recipe participates in the browser's existing mtime cache version. */
function packingModifiedAt(): number {
  return Math.max(statSync(fileURLToPath(import.meta.url)).mtimeMs,
    statSync(fileURLToPath(new URL('./src/assets/tanks/tank-action-format.ts', import.meta.url))).mtimeMs);
}

/** Preserve server definitions; publish browser attachment data per tank/action. */
function readDefinition(root: string, filename: string): PublishedContentAsset[] {
  const path = resolve(root, filename);
  const source = readFileSync(path);
  const sourceTime = statSync(path).mtimeMs;
  if (!filename.startsWith('tanks/')) return [{path: filename, source, modifiedAt: sourceTime}];
  const definition = JSON.parse(source.toString('utf8')) as TankDefinition;
  const data = new Map<string, number[]>();
  const trackDirectory = filename.replace(/\.json$/, '.tracks');
  const components = definition.resources.components.map(component => ({...component,
    actions: (component.actions as SourceAction[]).map(action => {
      const values = data.get(action.fields.name) ?? [];
      data.set(action.fields.name, values);
      const pack = (frames: readonly EffectTagFrame[]): TankTagRange => {
        const offset = values.length;
        for (const frame of frames) {
          if (frame.matrix.length !== TANK_TAG_FRAME_SIZE - 1) throw new Error(`战车挂点矩阵长度错误：${filename}`);
          values.push(frame.time, ...frame.matrix);
        }
        return {offset, length: frames.length};
      };
      return {...action,
        trackFile: `/content/${trackDirectory}/${action.fields.name}.bin`,
        primaryTags: action.primaryTags.map(track => ({...track, frames: pack(track.frames)})),
        turretPivotFrames: action.turretPivotFrames ? pack(action.turretPivotFrames) : null,
      };
    }),
  }));
  const modifiedAt = Math.max(sourceTime, packingModifiedAt());
  const assets = [{path: filename, source: Buffer.from(JSON.stringify({...definition,
    resources: {...definition.resources, components}})), modifiedAt}];
  for (const [name, values] of data) {
    const binary = Buffer.alloc(values.length * Float32Array.BYTES_PER_ELEMENT);
    for (let index = 0; index < values.length; index++) binary.writeFloatLE(values[index], index * 4);
    assets.push({path: `${trackDirectory}/${name}.bin`, source: binary, modifiedAt});
  }
  return assets;
}

/** Enumerate the exact bodies used by dev responses, production and the cache directory. */
export function* contentAssets(root: string): Generator<PublishedContentAsset> {
  yield* readDefinition(root, 'index.json');
  for (const directory of readdirSync(root, {withFileTypes: true})) {
    if (!directory.isDirectory()) continue;
    for (const filename of readdirSync(resolve(root, directory.name))) {
      if (filename.endsWith('.json')) yield* readDefinition(root, `${directory.name}/${filename}`);
    }
  }
}

export function readContentAsset(root: string, filename: string): PublishedContentAsset | undefined {
  const track = /^tanks\/([^/]+)\.tracks\/([^/]+)\.bin$/.exec(filename);
  const definition = track ? `tanks/${track[1]}.json` : filename;
  if (!definition.endsWith('.json')) return undefined;
  return readDefinition(root, definition).find(asset => asset.path === filename);
}
