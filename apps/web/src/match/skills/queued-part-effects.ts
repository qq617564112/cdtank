import type {PlaySkillEffectMessage} from '../../../../shared/protocols/MsgRoomEvent';

interface QueuedPartNotifications {
  play(message: PlaySkillEffectMessage): void;
  revive(roleId: number): void;
  clearQueue(roleId: number): void;
}

/** Authority survives asset loading; original queue playback begins with a live actor. */
export class QueuedPartEffects {
  private readonly roles = new Map<number, readonly number[]>();
  constructor(private readonly notifications: QueuedPartNotifications) {}

  reconcile(roleId: number, skills: readonly number[], active: boolean): boolean {
    const previous = this.roles.get(roleId);
    if (!active || !skills.length) {
      if (previous) this.notifications.clearQueue(roleId);
      this.roles.delete(roleId);
      return false;
    }
    if (previous?.length === skills.length && previous.every((id, index) => id === skills[index])) return false;
    if (previous) this.notifications.clearQueue(roleId);
    for (const skillId of skills) this.notifications.play({skillId, effectIndex: 0, duration: 0,
      roleId, xBits: 0, zBits: 0});
    this.notifications.revive(roleId);
    this.roles.set(roleId, [...skills]);
    return true;
  }

  remove(roleId: number): void {this.roles.delete(roleId);}
  clear(): void {this.roles.clear();}
}
