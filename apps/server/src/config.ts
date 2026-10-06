import {readFileSync} from 'node:fs';
import {sourceTablePath} from './runtime/content-paths';
import {readRoleTankBase, readRolePetBase} from './config/role-base';
import type {RoleTankBaseDefinition, RolePetBaseDefinition} from '../../shared/contracts/role-base';

export interface TankConfig {
  recomputeBase: RoleTankBaseDefinition;
  id: number;
  name: string;
  attack: number;
  defense: number;
  speed: number;
  turn: number;
  reload: number;
  sideDefense: number;
  backDefense: number;
}

export interface ModeMapConfig {
  description?: string;
  mapId: number;
  mode: number;
  name: string;
  timeLimit: number;
  maxPlayers: number;
  sourceMinPlayers: number;
  tankLimit: number;
  bunkerHp: number;
  vipHp: number;
  respawnTime: number;
  reviveLimit: number;
  hitScore: number;
  destroyScore: number;
  brokenScore: number;
  winScore: number;
  loseScore: number;
  drawScore: number;
  timeScore: number;
}

interface SourceTable {
  rows: {values: Record<string, string>}[];
}

function readTable(name: string): Record<string, string>[] {
  const table: SourceTable = JSON.parse(readFileSync(sourceTablePath(name), 'utf8'));
  return table.rows.map(row => row.values);
}

export const TANKS: TankConfig[] = readTable('tank').map(row => ({
  id: Number(row.ID), name: row.TankName, recomputeBase: readRoleTankBase(row),
  attack: Number(row.TankAtk), defense: Number(row.TankDef),
  speed: Number(row.TankMove), turn: Number(row.TankTurn),
  // Keep the legacy projection on the same source value as the recompute path;
  // no tank falls back to the old 800ms prototype.
  reload: Math.fround(Number(row.TankDelay)),
  sideDefense: Number(row.SideDef), backDefense: Number(row.BackDef),
}));

export const PET_BASES: RolePetBaseDefinition[] = readTable('pet').map(readRolePetBase);

export const MAPS: ModeMapConfig[] = [1, 2, 3, 4, 5].flatMap(mode =>
  readTable(`m00${mode}`).map(row => ({
    mode, mapId: Number(row.MapID), name: row.MapName, description: row.MapInfo,
    timeLimit: Number(row.Time), maxPlayers: Number(row.PlayerMax),
    sourceMinPlayers: Number(row.PlayerMin),
    tankLimit: Number(row.TankNum), bunkerHp: Number(row.BunkerHP),
    vipHp: Number(row.VIPHPMax), respawnTime: 3, reviveLimit: Number(row.ButtReborn),
    hitScore: Number(row.HitScore), destroyScore: Number(row.DestroyScore),
    brokenScore: Number(row.BrokenScore), winScore: Number(row.WinScore),
    loseScore: Number(row.LoseScore), drawScore: Number(row.DrawScore),
    timeScore: Number(row.TimeScore),
  })));

export function getTankConfig(id: number): TankConfig {
  return TANKS.find(tank => tank.id === id) ?? TANKS[0];
}

export function getMapConfig(mode: number, mapId?: number): ModeMapConfig {
  return MAPS.find(map => map.mode === mode && (mapId === undefined || map.mapId === mapId))
    ?? MAPS.find(map => map.mode === mode)
    ?? MAPS[0];
}
