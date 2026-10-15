import {BehaviourTree, State} from 'mistreevous';

export type TacticalIntent = 'BREACH' | 'RETREAT' | 'UNSTICK' | 'OBJECTIVE' | 'APPROACH' | 'ENGAGE';

export interface TacticalSnapshot {
  readonly breach: boolean;
  readonly lowHealth: boolean;
  readonly nearbyThreat: boolean;
  readonly blocked: boolean;
  readonly objective: boolean;
  readonly hasTarget: boolean;
  readonly targetVisible: boolean;
}

/**
 * The tree selects a short-lived intent. Movement and combat remain in the
 * controller so a tactical decision cannot bypass authoritative world rules.
 */
export class TacticalPlanner {
  private snapshot: TacticalSnapshot = {
    breach: false, lowHealth: false, nearbyThreat: false, blocked: false, objective: false,
    hasTarget: false, targetVisible: false,
  };
  private intent: TacticalIntent = 'ENGAGE';
  private readonly tree: BehaviourTree;

  constructor() {
    const agent = {
      ShouldBreach: () => this.snapshot.breach,
      SetBreach: () => this.choose('BREACH'),
      ShouldRetreat: () => this.snapshot.lowHealth && this.snapshot.nearbyThreat,
      SetRetreat: () => this.choose('RETREAT'),
      ShouldUnstick: () => this.snapshot.blocked,
      SetUnstick: () => this.choose('UNSTICK'),
      ShouldObjective: () => this.snapshot.objective,
      SetObjective: () => this.choose('OBJECTIVE'),
      ShouldApproach: () => this.snapshot.hasTarget && !this.snapshot.targetVisible,
      SetApproach: () => this.choose('APPROACH'),
      SetEngage: () => this.choose('ENGAGE'),
    };
    this.tree = new BehaviourTree(`root {
      selector {
        sequence { condition [ShouldBreach] action [SetBreach] }
        sequence { condition [ShouldRetreat] action [SetRetreat] }
        sequence { condition [ShouldUnstick] action [SetUnstick] }
        sequence { condition [ShouldObjective] action [SetObjective] }
        sequence { condition [ShouldApproach] action [SetApproach] }
        action [SetEngage]
      }
    }`, agent);
  }

  decide(snapshot: TacticalSnapshot): TacticalIntent {
    this.snapshot = snapshot;
    this.intent = 'ENGAGE';
    // Every decision is a fresh short action. A RUNNING branch would retain a
    // stale target across ticks and make the observed forward/back oscillation
    // harder to recover from.
    this.tree.reset();
    this.tree.step();
    return this.intent;
  }

  private choose(intent: TacticalIntent): State.SUCCEEDED {
    this.intent = intent;
    return State.SUCCEEDED;
  }
}
