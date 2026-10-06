import {resolve} from 'node:path';

/** Runtime data inputs; explicit absolute roots allow running a compiled service elsewhere. */
export function webAssetPath(filename: string): string {
  return resolve(process.env.WEB_ASSETS ?? 'recovery/output/web-assets', filename);
}

export function sourceTablePath(name: string): string {
  return resolve(process.env.CONTENT_TABLES ?? 'recovery/output/verified/tables', `${name}.json`);
}
