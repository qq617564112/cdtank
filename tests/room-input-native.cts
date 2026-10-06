import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {roomInputLength, limitRoomInput} from '../apps/shared/room-input';

const native = JSON.parse(readFileSync('recovery/output/room-create-input-limit-native.json', 'utf8')) as {
  status: string; rows: {kind: string; text?: string; count?: number; before?: string; after?: string; limit?: number}[];
};
assert.equal(native.status, 'PASS');
for (const row of native.rows) {
  if (row.kind === 'UTF32count') assert.equal(roomInputLength(row.text!), row.count);
  if (row.kind === 'onTextChanged') assert.equal(limitRoomInput(row.before!, row.limit!), row.after);
}
console.log('PASS original UTF32 counts and complete onTextChanged prefix truncation vectors');
