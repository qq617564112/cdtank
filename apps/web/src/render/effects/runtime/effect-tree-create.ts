export interface EffectTreeDefinition {
  type: number;
  children: readonly number[];
}

export interface EffectTreeFactory<D extends EffectTreeDefinition, N> {
  lookup(identifier: number): D | undefined;
  create(definition: D, retain: boolean): N;
  attach(parent: N, child: N): void;
}

/** Original 0x4795fa: source order creation, recursive retain and missing-child skip. */
export function createEffectTree<D extends EffectTreeDefinition, N>(identifier: number,
  retain: boolean, factory: EffectTreeFactory<D, N>): N | undefined {
  if (identifier === 0) return undefined;
  const definition = factory.lookup(identifier);
  if (!definition) return undefined;
  const node = factory.create(definition, retain);
  for (const childIdentifier of definition.children) {
    const child = createEffectTree(childIdentifier, retain, factory);
    if (child !== undefined) factory.attach(node, child);
  }
  return node;
}

/** Original 0x479296 linear lookup: zero is absent and the first duplicate wins. */
export function findEffectDefinition<D extends EffectTreeDefinition & {id: number}>(
  definitions: readonly D[], identifier: number): D | undefined {
  return identifier === 0 ? undefined : definitions.find(definition => definition.id === identifier);
}
