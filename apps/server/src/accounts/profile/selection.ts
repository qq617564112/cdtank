/** Original42fdc5/42fdea forwarding to42029e/420551 selectors28/29. */
export function readRoleProfileSelection(fields: ReadonlyMap<number, number>,
    selector: 28 | 29): number {
  return fields.get(selector === 28 ? 0x84 : 0x88)! >>> 0;
}

