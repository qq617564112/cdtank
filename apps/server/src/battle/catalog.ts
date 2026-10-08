import {readRoleDataScaleLimits} from './roles/data-scale';
import {content} from '../content';

export const combatCatalog = content.combatCatalog;
export const combatItems = new Map(combatCatalog.items.map(item => [item.itemTableId, item]));
export const combatSkills = new Map(combatCatalog.skills.map(skill => [skill.skillId, skill]));
export const combatItemSkills = new Map(combatCatalog.items.map(item => [item.itemTableId,
  {itemId: item.itemTableId, skillIds: item.skillIds}]));
export const combatLimits = readRoleDataScaleLimits(combatCatalog.dataScales);
