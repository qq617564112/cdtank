import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRoleCombatState} from '../apps/server/src/battle/roles/combat-state';
import {encodeRoleAmmoChange, receiveRoleAmmoChange} from '../recovery/evidence/roles/role-ammo-change-wire';
interface State {seconds: number; deadline: number}
interface Event {kind: string; key?: number; value?: number; bytes?: number[]; state?: State}
const evidence: {uiFormatBytes: number[]; uiRows: {ui: boolean; hotkeys: boolean; item: boolean;
  definition: boolean; accepted: boolean; result: State; uiEvents: Event[]; events: Event[]}[]} =
  JSON.parse(readFileSync('recovery/output/role-ammo-change-native.json', 'utf8'));
const decoder = new TextDecoder('gbk');
for (const row of evidence.uiRows) {
  const role = createRoleCombatState();
  role.roleFloatFields.set(0x54, 9.25); role.nextAvailableSeconds = 7.25;
  const state = (): State => ({seconds: role.roleFloatFields.get(0x54)!, deadline: role.nextAvailableSeconds});
  const uiEvents: Event[] = [], events: Event[] = [];
  receiveRoleAmmoChange(encodeRoleAmmoChange({field0c: 2, field10: 77, seconds: .7}), role,
    () => {events.push({kind: 'clock', state: state()}); return 123.456789;}, {
      ammoChanged: value => events.push({kind: 'changed', value, state: state()}),
      duration: value => events.push({kind: 'duration', value, state: state()}),
    }, 0, row.ui ? {
      hotkeysPresent: row.hotkeys,
      findItem: key => {uiEvents.push({kind: 'inventory', key}); return row.item ? {itemTableId: 2002} : undefined;},
      findDefinition: key => {uiEvents.push({kind: 'definition', key});
        return row.definition ? {name: 'Ammo', field74: 0xf1234567} : undefined;},
      localizedFormat: decoder.decode(Uint8Array.from(evidence.uiFormatBytes)),
      updateAttackEffect: value => uiEvents.push({kind: 'model', value, state: state()}),
      updateText: text => uiEvents.push({kind: 'text', bytes: [...Buffer.from(text, 'utf8')], state: state()}),
    } : undefined);
  const expectedUi = row.uiEvents.map(event => event.kind === 'text'
    ? {...event, bytes: [...Buffer.from(decoder.decode(Uint8Array.from(event.bytes!)), 'utf8')]} : event);
  assert.deepEqual(uiEvents, expectedUi);
  assert.deepEqual(events, row.events);
  assert.deepEqual(state(), row.result);
  assert.equal(events.length > 0, row.accepted);
}
console.log(`PASS: ${evidence.uiRows.length} original optional-UI gates, item/default lookup, model/caption order and reload early returns`);
