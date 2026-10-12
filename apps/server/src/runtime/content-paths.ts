import {resolve} from 'node:path';

/** Runtime data inputs; explicit absolute roots allow running a compiled service elsewhere. */
export function webAssetPath(filename: string): string {
  return resolve(process.env.WEB_ASSETS ?? 'apps/web/public', filename);
}

export function serverAssetPath(filename: string): string {
  return resolve(process.env.SERVER_ASSETS ?? 'apps/server/resources/assets', filename);
}

export function sourceTablePath(name: string): string {
  return resolve(process.env.CONTENT_TABLES ?? 'apps/server/resources/tables', `${name}.json`);
}
