import assert from 'node:assert/strict';
import {PortraitState} from '../apps/web/src/interface/battle/portrait-state';
const state = new PortraitState();
state.set(8);assert.equal(state.image(), 'wound');
state.advance(1);assert.equal(state.image(), 'wound');
state.advance(0.001);assert.equal(state.image(), 'normal');
state.set(4);assert.equal(state.image(), 'yeah1');
state.advance(0.25);assert.equal(state.image(), 'yeah2');
state.set(2);assert.equal(state.image(), 'yeah1'); // Suppressed attack still resets elapsed.
state.set(8);state.set(0x04000000);assert.equal(state.image(), 'wound');
state.advance(1.001);assert.equal(state.image(), 'dead');
state.set(1);assert.equal(state.image(), 'dead');
state.set(0x01000000);assert.equal(state.image(), 'normal');
state.set(2);state.advance(0.5);assert.equal(state.image(), 'attack');
state.advance(0.001);assert.equal(state.image(), 'normal');
state.set(0x02000000);state.advance(20);assert.equal(state.image(), 'normal');
assert.equal(state.flags, 0x02000000);
console.log('PASS: source portrait frame rounding, strict expiry, high/low flag preservation, priority, death and revival');
