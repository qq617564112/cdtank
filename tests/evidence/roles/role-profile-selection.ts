/** Field setter only; original setter has no ownership checks or notifications. */
export function setRoleProfileSelection(fields: Map<number, number>,
    selector: 28 | 29, instanceId: number): void {
  fields.set(selector === 28 ? 0x84 : 0x88, instanceId >>> 0);
}
