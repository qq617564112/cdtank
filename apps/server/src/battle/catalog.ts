import type {CombatCatalog} from '../../../shared/combat/catalog';
import {readRoleDataScaleLimits} from './roles/data-scale';
import {readFileSync} from 'node:fs';
import {webAssetPath} from '../runtime/content-paths';

export const combatCatalog = JSON.parse(readFileSync(webAssetPath('combat-catalog.json'), 'utf8')) as CombatCatalog;
export const combatItems = new Map(combatCatalog.items.map(item => [item.itemTableId, item]));
export const combatSkills = new Map(combatCatalog.skills.map(skill => [skill.skillId, skill]));
export const combatItemSkills = new Map(combatCatalog.items.map(item => [item.itemTableId,
  {itemId: item.itemTableId, skillIds: item.skillIds}]));
export const combatLimits = readRoleDataScaleLimits(combatCatalog.dataScales);

