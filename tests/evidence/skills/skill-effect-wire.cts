import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {decodePlaySkillEffect, decodeStopSkillEffect, encodePlaySkillEffect, encodeStopSkillEffect,
  PLAY_SKILL_EFFECT_MESSAGE_TYPE, STOP_SKILL_EFFECT_MESSAGE_TYPE} from './skill-effect-wire';

interface WireRow {
  type: number;
  alignment: number;
  values: number[];
  payload: string;
}
const evidence: {wire: WireRow[]} = JSON.parse(readFileSync('recovery/output/skill-effect-message-native.json', 'utf8'));
for (const row of evidence.wire) {
  const bytes = Buffer.from(row.payload, 'hex');
  if (row.type === PLAY_SKILL_EFFECT_MESSAGE_TYPE) {
    const [skillId, effectIndex, duration, roleId, xBits, zBits] = row.values;
    const message = {skillId, effectIndex, duration, roleId, xBits, zBits};
    assert.deepEqual(decodePlaySkillEffect(bytes, row.alignment), message);
    assert.equal(Buffer.from(encodePlaySkillEffect(message, row.alignment)).toString('hex'), row.payload);
  } else {
    assert.equal(row.type, STOP_SKILL_EFFECT_MESSAGE_TYPE);
    const [skillId, roleId] = row.values;
    const message = {skillId, roleId};
    assert.deepEqual(decodeStopSkillEffect(bytes, row.alignment), message);
    assert.equal(Buffer.from(encodeStopSkillEffect(message, row.alignment)).toString('hex'), row.payload);
  }
}
assert.throws(() => decodePlaySkillEffect(new Uint8Array(16)), RangeError);
assert.throws(() => decodeStopSkillEffect(new Uint8Array(5)), RangeError);
console.log(`PASS: ${evidence.wire.length} original Play/Stop skill-effect payloads, exact bytes and all bit alignments`);
