import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createEffectTree, findEffectDefinition, EffectTreeDefinition} from '../apps/web/src/render/effects/runtime/effect-tree-create';
interface Definition extends EffectTreeDefinition {id: number; index: number;}
interface Created {node: number; retain: boolean;}
interface Row {node: number; retain: boolean; created: Created[]; attached: {parent: number; child: number}[];}
const library = JSON.parse(readFileSync('recovery/output/web-assets/effect-library.json', 'utf8')) as {nodes: Definition[]};
const native = JSON.parse(readFileSync('recovery/output/effect-tree-create-native.json', 'utf8')) as {rows: Row[]};

for (const row of native.rows) {
  const created: Created[] = [];
  const attached: {parent: number; child: number}[] = [];
  const result = createEffectTree(library.nodes[row.node].id, row.retain, {
    lookup: id => findEffectDefinition(library.nodes, id),
    create: (definition, retain) => {
      const node = {node: definition.index, retain};
      created.push(node);
      return node;
    },
    attach: (parent, child) => attached.push({parent: parent.node, child: child.node}),
  });
  assert.deepEqual(result, row.created[0]);
  assert.deepEqual(created, row.created, `source tree${row.node}`);
  assert.deepEqual(attached, row.attached, `source attach${row.node}`);
}
console.log(`PASS: ${native.rows.length} original source recursive effect tree creations`);
