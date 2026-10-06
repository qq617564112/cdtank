import {clearAmmoBurn, type AmmoBurnState} from './items/ammo-burn';
import {clearAmmoSlow, type AmmoSlowState} from './items/ammo-slow';
import {setBattleHealth} from './health';
import {separateBattleParticipants} from './dynamic-movement';
import type {RoleMovementMathInput} from './roles/movement-math';
import type {MsgPlayerInput} from '../../../shared/protocols';
import type {RoleCombatState} from './roles/combat-state';
import type {RoleAttributeState} from './roles/attribute-state';
import type {InventoryWireRecord} from '../../../shared/protocols/PtlInventory';
import {initializeBattleQuantities} from '../../../shared/combat/item-hotkeys';
import type {BattleRoleSources} from '../battle-role-sources';
import type {Battlefield} from '../battlefield';
import {BotController} from './cpu/controller';
import {combatCatalog} from './catalog';
import {recomputeBattleAttributes} from './attributes';
import {clearAttackDrink, type AttackBoostState} from './items/attack-drink';
import {clearDefenseDrink, type DefenseBoostState} from './items/defense-drink';
import {clearTurnDrink, type TurnBoostState} from './items/turn-drink';
import {clearSpeedDrink, type SpeedBoostState} from './items/speed-drink';
import {clearInvincibility, type InvincibilityState} from './items/invincibility';
import {clearOpticalCamouflage, type OpticalCamouflageState} from './items/optical-camouflage';
import {clearRoleDisguise, type RoleDisguiseState} from './items/role-disguise';
import {resetConfirmedAmmo} from './items/ammo-confirmation';
import {clearCopiedRoleSkill} from './passive-skill-copy';
import {clearPetHitSpeed, type PetHitSpeedState} from './pet-hit-speed';
import {resetRoundStatistics, type RoundStatsCarrier} from './round-statistics';

interface StartingParticipant extends RoundStatsCarrier {
  name: string;
  x: number; y: number; z: number; yaw: number; aim: number;
  team: number; vip: boolean; hp: number; alive: boolean;
  score: number; kills: number; deaths: number; objectivesDestroyed: number;
  respawnAt: number;
  cancellationsSpent?: number;
  lastStand?: import('./last-stand').LastStandState;
  bodyYaw?: number;
  movementState?: import('./movement').BattleMovementState;
  id: string;
  tank: import('../config').TankConfig;
  movementCommand?: RoleMovementMathInput['command'];
  combat: RoleCombatState;
  inventory: InventoryWireRecord[];
  ownedRoles: BattleRoleSources;
  attributes: RoleAttributeState;
  attributesReady: boolean;
  magazineReady?: boolean;
  lifeReady?: boolean;
  recoveredMaxHp?: number;
  recoveredMovement?: {speed: number; turn: number};
  attackBoost?: AttackBoostState;
  defenseBoost?: DefenseBoostState;
  burn?: AmmoBurnState;
  ammoSlow?: AmmoSlowState;
  invincibility?: InvincibilityState;
  opticalCamouflage?: OpticalCamouflageState;
  roleDisguise?: RoleDisguiseState;
  speedBoost?: SpeedBoostState;
  turnBoost?: TurnBoostState;
  petHitSpeed?: PetHitSpeedState;
  cpu?: BotController;
  autopilot?: BotController;
  inputSequence: number;
  autopilotInputSequence?: number;
  input: MsgPlayerInput;
}

/** Reset actual participants on both first start and consensus rematch. */
export function initializeBattleParticipants<Player extends StartingParticipant>(
  battlefield: Battlefield, players: Iterable<Player>, defaultInput: MsgPlayerInput,
  assignVip: (player: Player) => void, maxHp: (player: Player) => number,
  clock: () => number): void {
  const participants = [...players];
  participants.forEach((player, index) => {
    clearCopiedRoleSkill(player.combat);
    clearPetHitSpeed(player, () => recomputeBattleAttributes(player));
    player.lastStand = undefined;
    clearAmmoBurn(player);
    clearAmmoSlow(player, () => recomputeBattleAttributes(player));
    clearDefenseDrink(player, () => recomputeBattleAttributes(player));
    clearAttackDrink(player, () => recomputeBattleAttributes(player));
    clearInvincibility(player, () => recomputeBattleAttributes(player));
    clearOpticalCamouflage(player, () => recomputeBattleAttributes(player));
    clearRoleDisguise(player, () => recomputeBattleAttributes(player));
    clearSpeedDrink(player, () => recomputeBattleAttributes(player));
    clearTurnDrink(player, () => recomputeBattleAttributes(player));
    Object.assign(player, battlefield.spawn(index));
    player.aim = 0;
    player.bodyYaw = undefined;
    player.movementState = undefined;
    player.movementCommand = 0;
    player.alive = true;
    player.combat.setStatus(2);
    resetConfirmedAmmo(player.combat);
    initializeBattleQuantities(player.combat.record!.arrays.get(0)!, player.inventory,
      itemId => combatCatalog.items.find(item => item.itemTableId === itemId)?.battleUseMax ?? 0);
    assignVip(player);
    recomputeBattleAttributes(player);
    const maximum = maxHp(player);
    setBattleHealth(player, maximum, maximum);
    player.score = 0;
    player.kills = 0;
    player.deaths = 0;
    player.objectivesDestroyed = 0;
    resetRoundStatistics(player);
    player.respawnAt = 0;
    player.cancellationsSpent = 0;
    if (player.cpu) player.cpu = new BotController();
    if (player.cpu) player.inputSequence = 0;
    if (player.autopilot) player.autopilot = new BotController();
    player.autopilotInputSequence = 0;
    // Human sequence watermarks survive: previous-round packets stay stale.
    player.input = {...defaultInput};
  });
  separateBattleParticipants(participants, battlefield, clock);
}
