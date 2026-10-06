import {EffectVec3} from '../common/types';

export interface EffectWorldStartHooks<Node> {
  find(id: number): Node | undefined;
  create(id: number): Node | undefined;
  addActive(node: Node): void;
  startWorld(node: Node, position: EffectVec3): void;
}

/** Original 0x47b1f0 manager entry; +0x38 starts in world space. */
export function startEffectInWorld<Node>(enabled: boolean, id: number,
  position: EffectVec3, hooks: EffectWorldStartHooks<Node>): Node | undefined {
  if (!enabled) return undefined;
  const node = hooks.find(id) ?? hooks.create(id);
  if (node === undefined) return undefined;
  hooks.addActive(node);
  hooks.startWorld(node, position.map(Math.fround) as EffectVec3);
  return node;
}

/** ELK binding mode 0 calls 0x47b510 with a zero world-space position. */
export function startUnboundEffect<Node>(enabled: boolean, id: number,
  hooks: EffectWorldStartHooks<Node>): Node | undefined {
  return startEffectInWorld(enabled, id, [0, 0, 0], hooks);
}
