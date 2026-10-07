import type {Battle} from '../../match/battle';
import type {ResPetSkillLearning} from '../../../../shared/protocols/PtlPetSkillLearning';
import {createRequestId} from '../../network/request-id';

export interface PetSkillLearningAttempt {
  instanceId: number;
  slot: number;
  requestId: string;
}

export type PetSkillConfirmation = 'APPLIED' | 'ABSENT';

export interface PetSkillLearningState {
  busy: boolean;
  quotes?: ResPetSkillLearning['quotes'];
  points?: number;
  owned?: ResPetSkillLearning['owned'];
  profile?: ResPetSkillLearning['profile'];
  attempt?: PetSkillLearningAttempt;
  confirmation?: PetSkillConfirmation;
  queryError?: string;
  actionError?: string;
  message?: string;
}

const describe = (error: unknown) => error instanceof Error ? error.message : String(error);

/**
 * Owns the single pet-skill learning attempt for one Battle and authenticated connection generation.
 * QUERY/LEARN/CONFIRM are serialized, and a failed LEARN keeps its original request fields until the
 * user confirms, retries after an ABSENT confirmation, or explicitly abandons it.
 */
export class PetSkillLearningOwner {
  private readonly listeners = new Set<() => void>();
  private state: PetSkillLearningState = {busy: false};
  private attempt?: PetSkillLearningAttempt;
  private confirmation?: PetSkillConfirmation;
  private revision = 0;
  private queue: Promise<void> = Promise.resolve();

  constructor(private readonly battle: Battle, private readonly generation: number) {}

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {this.listeners.delete(listener);};
  };
  getSnapshot = (): PetSkillLearningState => this.state;

  private current() {return this.battle.accountContext.generation === this.generation;}

  private publish(patch: Partial<PetSkillLearningState>) {
    this.state = {...this.state, ...patch};
    for (const listener of this.listeners) listener();
  }

  private enqueue(task: () => Promise<void>): Promise<void> {
    const run = this.queue.then(task);
    this.queue = run.then(() => undefined, () => undefined);
    return run;
  }

  private accept(result: ResPetSkillLearning, revision: number) {
    if (!this.current() || this.revision !== revision) return false;
    this.publish({quotes: result.quotes, points: result.points, owned: result.owned, profile: result.profile});
    return true;
  }

  query(): Promise<void> {
    return this.enqueue(async () => {
      if (!this.current()) return;
      const revision = ++this.revision;
      this.publish({busy: true, queryError: undefined, actionError: undefined});
      try {
        const result = await this.battle.petSkillLearning({operation: 'QUERY'});
        if (!this.accept(result, revision)) return;
        this.publish({busy: false, queryError: undefined});
      } catch (error) {
        if (!this.current() || this.revision !== revision) return;
        this.publish({busy: false, queryError: describe(error)});
      }
    });
  }

  learn(instanceId: number, slot: number): Promise<void> {
    return this.enqueue(() => this.runLearn(instanceId, slot));
  }

  private async runLearn(instanceId: number, slot: number): Promise<void> {
    if (!this.current()) return;
    if (this.attempt && (this.attempt.instanceId !== instanceId || this.attempt.slot !== slot)) {
      this.publish({actionError: '已有待确认的学习结果，请先确认或放弃'});
      return;
    }
    const attempt = this.attempt ?? {instanceId, slot, requestId: createRequestId()};
    this.attempt = attempt;
    const revision = ++this.revision;
    this.publish({busy: true, attempt, confirmation: undefined, queryError: undefined, actionError: undefined,
      message: '学习技能…'});
    try {
      const result = await this.battle.petSkillLearning({operation: 'LEARN', instanceId: attempt.instanceId,
        slot: attempt.slot, requestId: attempt.requestId});
      if (!this.accept(result, revision)) return;
      this.attempt = undefined; this.confirmation = undefined;
      this.publish({busy: false, attempt: undefined, confirmation: undefined, message: '技能学习已确认'});
    } catch (error) {
      if (!this.current() || this.revision !== revision) return;
      this.publish({busy: false, actionError: describe(error), message: '学习结果未确定，请点击“确认学习结果”'});
    }
  }

  confirm(): Promise<void> {
    return this.enqueue(async () => {
      if (!this.current()) return;
      const attempt = this.attempt;
      if (!attempt) {this.publish({message: '没有待确认的学习结果'}); return;}
      const revision = ++this.revision;
      this.publish({busy: true, actionError: undefined, queryError: undefined, message: '确认学习结果…'});
      try {
        const result = await this.battle.petSkillLearning({operation: 'CONFIRM', instanceId: attempt.instanceId,
          slot: attempt.slot, requestId: attempt.requestId});
        if (!this.current() || this.revision !== revision) return;
        if (result.confirmation === 'APPLIED') {
          this.accept(result, revision);
          this.attempt = undefined; this.confirmation = undefined;
          this.publish({busy: false, attempt: undefined, confirmation: 'APPLIED', message: '学习结果已确认'});
        } else if (result.confirmation === 'ABSENT') {
          this.accept(result, revision);
          this.confirmation = 'ABSENT';
          this.publish({busy: false, confirmation: 'ABSENT', message: '未找到已保存的学习记录，可重试本次学习或放弃'});
        } else {
          this.publish({busy: false, message: '确认结果未知，请再次确认'});
        }
      } catch (error) {
        if (!this.current() || this.revision !== revision) return;
        this.publish({busy: false, actionError: describe(error), message: '确认失败，请再次确认'});
      }
    });
  }

  retry(): Promise<void> {
    return this.enqueue(async () => {
      if (!this.current() || this.confirmation !== 'ABSENT' || !this.attempt) return;
      const attempt = this.attempt;
      const revision = ++this.revision;
      this.publish({busy: true, actionError: undefined, message: '读取当前报价…'});
      try {
        const result = await this.battle.petSkillLearning({operation: 'QUERY'});
        if (!this.accept(result, revision)) return;
        const quote = result.quotes.find(value => value.instanceId === attempt.instanceId && value.slot === attempt.slot);
        if (quote?.kind !== 'eligible') {
          this.publish({busy: false, actionError: '当前报价不满足学习条件，无法重试'});
          return;
        }
      } catch (error) {
        if (!this.current() || this.revision !== revision) return;
        this.publish({busy: false, actionError: describe(error)});
        return;
      }
      await this.runLearn(attempt.instanceId, attempt.slot);
    });
  }

  abandon(): void {
    if (!this.current() || this.confirmation !== 'ABSENT' || this.state.busy) return;
    this.attempt = undefined; this.confirmation = undefined; ++this.revision;
    this.publish({attempt: undefined, confirmation: undefined, actionError: undefined, message: undefined});
  }
}

interface OwnerEntry {generation: number; owner: PetSkillLearningOwner;}
const owners = new WeakMap<Battle, OwnerEntry>();

/** Reuses one owner while Battle identity and authenticated connection generation stay unchanged. */
export function petSkillLearningOwner(battle: Battle): PetSkillLearningOwner {
  const generation = battle.accountContext.generation;
  const existing = owners.get(battle);
  if (existing && existing.generation === generation) return existing.owner;
  const owner = new PetSkillLearningOwner(battle, generation);
  owners.set(battle, {generation, owner});
  return owner;
}
