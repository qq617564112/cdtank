import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SceneCastleState, type CastlePresentationCommand} from '../apps/web/src/assets/scenes/scene-castle-state';

interface NativeEvent {kind: string; name?: string; tag?: string | number; mode?: number;
  selector?: number; slot?: number; delta?: number; position?: number[];}
interface NativeRow {hp: number; maxHP: number; stage: number; mask: number; delta: number;
  events: NativeEvent[];}
const source = JSON.parse(readFileSync('recovery/output/castle-damage-native.json', 'utf8')) as
  {rows: NativeRow[]; sequence: NativeRow[]};
function nativeEvent(event: NativeEvent): unknown {
  if (event.kind === 'effectStart') return {kind: 'effect', name: event.name!.slice(-3), target: event.tag};
  if (event.kind === 'sound') {
    return {kind: 'sound', name: event.name, selector: event.selector,
      target: event.name === 'GA48' ? 'position' : event.name === 'se07' ? 0 : 3};
  }
  if (event.kind === 'effectStop') return {kind: 'stopEffect'};
  if (event.kind === 'soundStop') return {kind: 'stopSound', slot: event.slot};
  return event;
}
function commandEvent(command: CastlePresentationCommand): unknown {
  if (command.kind === 'effect') return {kind: command.kind, name: command.name, target: command.target};
  if (command.kind === 'sound') return {kind: command.kind, name: command.name,
    selector: command.selector, target: command.target};
  if (command.kind === 'stopEffect') return {kind: command.kind};
  return command;
}
function verify(state: SceneCastleState, row: NativeRow): void {
  const commands = state.damage({currentHP: row.hp, maxHP: row.maxHP, delta: row.delta});
  // Native skips empty effect handles; a stop request for an empty owned slot is inert.
  assert.deepEqual(commands.filter(c => c.kind !== 'stopEffect').map(commandEvent),
    row.events.filter(e => e.kind !== 'effectStop').map(nativeEvent));
  assert.deepEqual(state.snapshot(), {stage: row.stage, mask: row.mask});
}
for (const row of source.rows) verify(new SceneCastleState(), row);
const state = new SceneCastleState();
for (const row of source.sequence) verify(state, row);
console.log('PASS: Castle action, effect, spatial sound and stop ordering match original boundary and sequential transactions');
