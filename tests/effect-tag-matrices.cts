import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {EffectPrimaryTagMatrices, EFFECT_PRIMARY_TAGS} from '../apps/web/src/assets/tanks/effect-tag-matrices';

const native = JSON.parse(readFileSync('recovery/output/effect-tag-world-native.json', 'utf8'));
for (const fourPart of [false, true]) {
  const store = new EffectPrimaryTagMatrices(fourPart);
  const references = EFFECT_PRIMARY_TAGS.map(name => store.get(name));
  for (const sample of native.rows.filter((row: {variant: string}) =>
    row.variant === (fourPart ? 'fourPartBody' : 'threePart')).slice(0, 3)) {
    const queries: string[] = [];
    store.update({read(part, name) {
      queries.push(`${part}/${name}`);
      return part === 'M' && name !== 'tag_efattack' ? sample.local : undefined;
    }}, sample.pose);
    for (let index = 0; index < EFFECT_PRIMARY_TAGS.length; ++index) {
      const name = EFFECT_PRIMARY_TAGS[index];
      assert.equal(store.get(name), references[index]);
      assert.deepEqual(store.get(name), name === 'tag_efattack' ? Array(16).fill(0) : sample.matrix);
    }
    assert.deepEqual(queries, [...EFFECT_PRIMARY_TAGS.map(name => `M/${name}`),
      ...(fourPart ? ['U/tag_efattack'] : [])]);
  }
}
console.log('PASS: shared primary matrix references follow real native samples and M/U source order');
