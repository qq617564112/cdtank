import {observeLearning, type LearningMemory} from './observation';
import {RecurrentActor, type SerializedActorPolicy} from './policy';
import type {PlayerState} from '../battle/player-state';
import type {RoomState} from '../rooms/state';
import type {MsgPlayerInput, MsgRoomEvent} from '../../../shared/protocols';

interface ActorMemory {
  round: number;
  deaths: number;
  nextDecision: number;
  hidden: Float32Array;
  perception?: LearningMemory;
  pendingEvents: MsgRoomEvent[];
  action: number[];
  decision?: {at: number; observation: number[]; actionMasks: boolean[][];
    actions: number[]; hidden: number[]; logits: number[]; reset: boolean};
}

/** Learned CPU/autopilot decisions use the same ordinary authority input lane. */
export class LearnedCpuPolicy {
  private readonly actor: RecurrentActor;
  private readonly states = new WeakMap<PlayerState, ActorMemory>();

  constructor(model: SerializedActorPolicy) {this.actor = new RecurrentActor(model);}

  input(room: RoomState, player: PlayerState, maximumHp: number, now: number,
    events: readonly MsgRoomEvent[]): MsgPlayerInput {
    let state = this.states.get(player);
    if (!state || state.round !== room.round || state.deaths !== player.deaths) {
      state = {round: room.round, deaths: player.deaths, nextDecision: 0,
        hidden: new Float32Array(64), pendingEvents: [], action: [1, 1, 1, 0, 0]};
      this.states.set(player, state);
    }
    state.pendingEvents.push(...events);
    let useItem = 0;
    if (now >= state.nextDecision) {
      const frame = observeLearning(room, player, maximumHp, now, state.perception, undefined, state.pendingEvents);
      const decision = this.actor.decide(frame.observation, frame.actionMasks, state.hidden);
      state.decision = {at: now, observation: frame.observation, actionMasks: frame.actionMasks,
        actions: decision.actions, hidden: [...decision.hidden], logits: [...decision.logits],
        reset: !state.perception};
      state.hidden = decision.hidden;
      state.perception = frame.memory;
      state.action = decision.actions;
      state.pendingEvents = [];
      state.nextDecision = now + this.actor.model.decisionMs;
      useItem = state.action[4];
    }
    return {sequence: (player.autopilot ? player.autopilotInputSequence ?? 0 : player.inputSequence) + 1,
      move: state.action[0] - 1, turn: state.action[1] - 1, aim: state.action[2] - 1,
      fire: state.action[3] === 1, useItem, clientTime: now};
  }

  /** Actual inference evidence for frozen deployment evaluation. */
  decision(player: PlayerState) {return this.states.get(player)?.decision;}
}
