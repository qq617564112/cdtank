import {readdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import validator from 'gltf-validator';

async function models(directory) {
  const result = [];
  for (const entry of await readdir(directory, {withFileTypes: true})) {
    const current = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      result.push(...await models(current));
    } else if (entry.name.endsWith('.glb')) {
      result.push(current);
    }
  }
  return result;
}

const results = [];
for (const file of await models('recovery/output/web-assets')) {
  const report = await validator.validateBytes(new Uint8Array(await readFile(file)), {maxIssues: 20});
  results.push({file, errors: report.issues.numErrors, warnings: report.issues.numWarnings,
    messages: report.issues.messages});
}
await writeFile('recovery/output/web-assets/validation.json', JSON.stringify(results, null, 2));
const failures = results.filter(result => result.errors);
console.log(`${results.length} GLB validated, ${failures.length} files with errors`);
if (failures.length) {
  console.error(JSON.stringify(failures.slice(0, 3), null, 2));
  process.exitCode = 1;
}
