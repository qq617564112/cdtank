import {randomBytes, randomUUID, scryptSync, timingSafeEqual} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import type {RoomPassword} from '../../../shared/simulation/resources';
import {serverAssetPath, sourceTablePath} from './content-paths';

/** Server host for synchronous simulation data and room password operations. */
export function readSimulationAsset<T>(name: string): T {
  const override = name === 'battlefields.json' ? process.env.BATTLEFIELDS
    : name === 'scene-placements.json' ? process.env.SCENE_PLACEMENTS : undefined;
  return JSON.parse(readFileSync(override ?? serverAssetPath(name), 'utf8')) as T;
}

export function readSimulationTable<T>(name: string, path?: string): T {
  return JSON.parse(readFileSync(path ?? sourceTablePath(name), 'utf8')) as T;
}

export function readSimulationContent<T>(name: string): T {
  return JSON.parse(readFileSync(resolve(__dirname, '../../../shared/content/definitions', name), 'utf8')) as T;
}

export function createRoomPassword(password: string): RoomPassword {
  if (!password) return {};
  const passwordSalt = randomBytes(16);
  return {passwordSalt, passwordHash: scryptSync(password, passwordSalt, 32)};
}

export function matchesRoomPassword(room: RoomPassword, password: string): boolean {
  return !room.passwordHash || !room.passwordSalt
    || timingSafeEqual(room.passwordHash, scryptSync(password, room.passwordSalt, 32));
}

export function simulationItemId(): string {return randomUUID();}
