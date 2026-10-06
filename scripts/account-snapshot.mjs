import {DatabaseSync, backup} from 'node:sqlite';
import {access, mkdir} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';

const [operation, source, destination, ...extra] = process.argv.slice(2);
try {
  if (!['backup', 'restore'].includes(operation) || !source || !destination || extra.length) {
    throw new Error('Usage: npm run accounts:backup|accounts:restore -- <source.sqlite> <new-destination.sqlite>');
  }
  const input = resolve(source), output = resolve(destination);
  await access(input);
  let exists = false;
  try {await access(output); exists = true;} catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if (exists) throw new Error('Destination already exists; choose a new database path');
  await mkdir(dirname(output), {recursive: true});
  const database = new DatabaseSync(input, {readOnly: true});
  try {
    const pages = await backup(database, output);
    console.log(`${operation === 'backup' ? 'Backup' : 'Restore'} complete: ${output} (${pages} pages)`);
  } finally {database.close();}
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
