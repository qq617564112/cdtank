import {setBattleHealth} from './health';
import type {TankConfig} from '../config';
import type {Point} from '../battlefield';
import type {MsgPlayerInput} from '../../../shared/protocols';
import {createRoleCombatState} from './roles/combat-state';
import {RoleAttributeState} from './roles/attribute-state';
import {BattleRoleSources} from '../battle-role-sources';
import type {PlayerState} from './player-state';
import {resetRoundStatistics} from './round-statistics';

/** Existing fallback for participants without complete owned attribute sources. */
export function baseTankMaxHp(tank: TankConfig): number {
  return Math.round(180 + tank.defense * 8);
}

export function createBattlePlayer(id: string, clientId: string, name: string,
  tank: TankConfig, team: number, spawn: Point & {yaw: number},
  defaultInput: MsgPlayerInput): PlayerState {
  const cleanName = name.replace(/[<>&\u0000-\u001f]/g, '').trim().slice(0, 16);
  const player: PlayerState = {
    id, clientId, name: cleanName || '无名坦克手', tank, team,
    x: spawn.x, y: spawn.y, z: spawn.z, yaw: spawn.yaw,
    aim: 0, hp: baseTankMaxHp(tank), alive: true,
    score: 0, kills: 0, deaths: 0, respawnAt: 0, cancellationsSpent: 0,
    combat: createRoleCombatState(),
    inventory: [],
    ownedRoles: new BattleRoleSources(),
    attributes: new RoleAttributeState({hp: baseTankMaxHp(tank), maxHp: baseTankMaxHp(tank),
      maxBullet: 0, move: 0, turn: 0}, () => {}),
    attributesReady: false,
    magazineReady: false,
    lifeReady: false,
    inputSequence: 0, input: {...defaultInput},
    vip: false, objectivesDestroyed: 0,
  };
  setBattleHealth(player, player.hp);
  resetRoundStatistics(player);
  return player;
}
