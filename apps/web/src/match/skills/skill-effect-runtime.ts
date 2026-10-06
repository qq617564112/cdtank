import type {CombatCatalog} from '../../../../shared/combat/catalog';
import {EffectRuntime} from '../../render/effects/runtime/effect-runtime';
import {SkillEffectNotifications} from './skill-effect-notifications';
import type {TankView} from '../../assets/tanks/tank-view';

export interface SkillEffectRoles {
  role(roleId: number): TankView | undefined;
  localRole(): TankView | undefined;
}

/** Connect received original notifications to loaded production effect trees and role audio. */
export function createSkillEffectNotifications(runtime: EffectRuntime, catalog: CombatCatalog,
  roles: SkillEffectRoles): SkillEffectNotifications<TankView, number, number> {
  return new SkillEffectNotifications({
    skill: skillId => catalog.skills.find(skill => skill.skillId === skillId),
    role: roleId => roles.role(roleId),
    hasActor: role => !role.root.isDisposed(),
    world: (name, position) => {runtime.spawnWorldEffect(name, [...position]);},
    attached: (role, effectId, _binding, tag, oneShot) =>
      runtime.spawnAttachedEffect(role, effectId, tag, oneShot, roles.localRole()),
    sound: (role, reference, selector) => runtime.playSkillSound(role, reference, selector),
    worldSound: (reference, position) => {runtime.playSceneSound(reference, [...position], 1);},
    stopEffect: handle => runtime.stopEffect(handle),
    stopSound: handle => runtime.stopSkillSound(handle),
    release: () => {},
    resetRoleEffects: roleId => {const role = roles.role(roleId); if (role) runtime.resetRoleEffects(role);},
  });
}
