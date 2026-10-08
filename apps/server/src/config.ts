import {readFileSync} from 'node:fs';
import {sourceTablePath, webAssetPath} from './runtime/content-paths';
import {content} from './content';
import type {RoleTankBaseDefinition, RolePetBaseDefinition} from '../../shared/contracts/role-base';
import {BATTLE_RESPAWN_SECONDS} from '../../shared/combat/battle-respawn';
import {TEST_MAP} from '../../shared/maps/test-map';
import {FIELD_ROAD_HD} from '../../shared/maps/field-road-hd';
import {playableMapDirectory} from './config/map-directory';

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

/** Original per-map award enable/score columns and the four source threshold pairs. */
export interface ModeAwardConfig {
  enable: number;
  score: number;
  damage?: number;
  damagePlus?: number;
}

export interface ModeAwardsConfig {
  perfect: ModeAwardConfig;
  mvp: ModeAwardConfig;
  savage: ModeAwardConfig;
  console: ModeAwardConfig;
  brave: ModeAwardConfig;
  kind: ModeAwardConfig;
  crafty: ModeAwardConfig;
  shy: ModeAwardConfig;
  greedy: ModeAwardConfig;
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
  defaultButt: number;
  buttReborn: number;
  buttRebornTime: number;
  vanishTime: number;
  hitScore: number;
  destroyScore: number;
  brokenScore: number;
  winScore: number;
  loseScore: number;
  drawScore: number;
  timeScore: number;
  awards: ModeAwardsConfig;
}

interface SourceTable {
  rows: {values: Record<string, string>}[];
}

function readTable(name: string): Record<string, string>[] {
  const table: SourceTable = JSON.parse(readFileSync(sourceTablePath(name), 'utf8'));
  return table.rows.map(row => row.values);
}

export const TANKS: TankConfig[] = [...content.tanks.values()].map(tank => ({
  id: tank.id, name: tank.name,
  recomputeBase: {id: tank.id, tankType: tank.tankType, field84: tank.attributes.speed,
    field88: tank.attributes.turn, reloadDuration: Math.fround(tank.attributes.reload),
    field90: tank.attributes.bullets, fieldA4: tank.attributes.sideDefense, fieldA8: tank.attributes.backDefense},
  attack: tank.attributes.attack, defense: tank.attributes.defense,
  speed: tank.attributes.speed, turn: tank.attributes.turn, reload: Math.fround(tank.attributes.reload),
  sideDefense: tank.attributes.sideDefense, backDefense: tank.attributes.backDefense,
}));

export const PET_BASES: RolePetBaseDefinition[] = [...content.pets.values()].map(pet => ({
  id: pet.id, field7c: pet.attributes.mastery[0], field80: pet.attributes.mastery[1],
  field84: pet.attributes.mastery[2], field88: pet.attributes.mastery[3],
}));

const sourceMaps: ModeMapConfig[] = [1, 2, 3, 4, 5].flatMap(mode =>
  readTable(`m00${mode}`).map(row => ({
    mode, mapId: Number(row.MapID), name: row.MapName, description: row.MapInfo,
    timeLimit: Number(row.Time), maxPlayers: Number(row.PlayerMax),
    sourceMinPlayers: Number(row.PlayerMin),
    tankLimit: Number(row.TankNum), bunkerHp: Number(row.BunkerHP),
    vipHp: Number(row.VIPHPMax), respawnTime: BATTLE_RESPAWN_SECONDS,
    defaultButt: Number(row.DefaultButt), buttReborn: Number(row.ButtReborn),
    buttRebornTime: Number(row.ButtRebornTime), vanishTime: Number(row.VanishTime),
    hitScore: Number(row.HitScore), destroyScore: Number(row.DestroyScore),
    brokenScore: Number(row.BrokenScore), winScore: Number(row.WinScore),
    loseScore: Number(row.LoseScore), drawScore: Number(row.DrawScore),
    timeScore: Number(row.TimeScore),
    awards: {
      perfect: {enable: Number(row.Perfect), score: Number(row.PerfectScore)},
      mvp: {enable: Number(row.MVP), score: Number(row.MVPScore)},
      savage: {enable: Number(row.Savage), score: Number(row.SavageScore),
        damage: Number(row.SavageDamage), damagePlus: Number(row.SavageDamagePlus)},
      console: {enable: Number(row.Console), score: Number(row.ConsoleScore),
        damage: Number(row.ConsoleDamage), damagePlus: Number(row.ConsoleDamagePlus)},
      brave: {enable: Number(row.Brave), score: Number(row.BraveScore)},
      kind: {enable: Number(row.Kind), score: Number(row.KindScore),
        damage: Number(row.KindDamage), damagePlus: Number(row.KindDamagePlus)},
      crafty: {enable: Number(row.Crafty), score: Number(row.CraftyScore),
        damage: Number(row.CraftyDamage), damagePlus: Number(row.CraftyDamagePlus)},
      shy: {enable: Number(row.Shy), score: Number(row.ShyScore)},
      greedy: {enable: Number(row.Greedy), score: Number(row.GreedyScore)},
    },
  })));

export const MAPS = playableMapDirectory(sourceMaps,
  JSON.parse(readFileSync(process.env.SCENE_PLACEMENTS ?? webAssetPath('scene-placements.json'), 'utf8')),
  readTable('gamestring'));

MAPS.push({...MAPS.find(map => map.mode === TEST_MAP.mode && map.mapId === 2)!,
  mapId: TEST_MAP.id, mode: TEST_MAP.mode, name: TEST_MAP.name, description: TEST_MAP.description,
  timeLimit: TEST_MAP.timeLimit, sourceMinPlayers: TEST_MAP.minPlayers, maxPlayers: TEST_MAP.maxPlayers});

MAPS.push(...MAPS.filter(map => map.mapId === FIELD_ROAD_HD.sourceId).map(map => ({
  ...map, mapId: FIELD_ROAD_HD.id, name: FIELD_ROAD_HD.name,
})));

export const TITLE_TABLE = readTable('title');

export function getTankConfig(id: number): TankConfig {
  return TANKS.find(tank => tank.id === id) ?? TANKS.find(tank => content.tanks.get(tank.id)?.defaultSelected)!;
}

export function getMapConfig(mode: number, mapId?: number): ModeMapConfig {
  return MAPS.find(map => map.mode === mode && (mapId === undefined || map.mapId === mapId))
    ?? MAPS.find(map => map.mode === mode)
    ?? MAPS[0];
}
