import {mkdirSync, readdirSync, writeFileSync} from 'node:fs';
import {basename, resolve} from 'node:path';
import {preprocessGlb} from './glb.mjs';
import {preprocessCvd} from './cvd.mjs';

const args = process.argv.slice(2);
if (args.length !== 2 || !['--models', '--cvd', '--all'].includes(args[0])) {
  throw new Error('Usage: node scripts/geometry/preprocess.mjs --models|--cvd|--all <asset root>');
}
const root = resolve(args[1]);
const stats = {};
function add(row) {
  for (const [key, value] of Object.entries(row ?? {})) stats[key] = (stats[key] ?? 0) + value;
}
for (const entry of readdirSync(root, {recursive: true, withFileTypes: true})) {
  if (!entry.isFile()) continue;
  const path = resolve(entry.parentPath, entry.name);
  if (args[0] !== '--cvd' && entry.name.endsWith('.glb')) add(preprocessGlb(path));
  if (args[0] !== '--models' && entry.name.endsWith('.json') && entry.parentPath.endsWith('-models')) {
    add(preprocessCvd(path, root));
  }
}
if (Object.keys(stats).length) {
  const reports = new URL('../../output/geometry/', import.meta.url);
  mkdirSync(reports, {recursive: true});
  writeFileSync(new URL(`${basename(root)}-${args[0].slice(2)}.json`, reports),
    JSON.stringify({layout: 1, ...stats}, null, 2) + '\n');
}
console.log(JSON.stringify({phase: 'geometry-wasm', root, ...stats}));
