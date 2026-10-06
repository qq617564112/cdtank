import type {OwnedRoleBaseRecord} from '../../../apps/shared/contracts/owned-base';

/** Original4dc1c8–4dc214: notify the local hint before emitting3ab3, without changing selection. */
export function requestRolePetSelection(selected: OwnedRoleBaseRecord,
    current: OwnedRoleBaseRecord | undefined, showSelectionHint: boolean,
    send: (instanceId: number) => void, notifyHint?: () => void): boolean {
  if (selected === current) return false;
  if (showSelectionHint) notifyHint?.();
  send(selected.fields.get(0)! >>> 0);
  return true;
}
