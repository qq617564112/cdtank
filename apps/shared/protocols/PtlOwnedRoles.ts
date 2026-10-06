/** Lossless recovered ownership fields; base instance key+0, equipment instance key+1c. */
export interface OwnedRoleRecordData {
  name: string;
  fields: [number, number][];
}

export interface ReqOwnedRoles {}
export interface ResOwnedRoles {
  base: OwnedRoleRecordData[];
  equipment: OwnedRoleRecordData[];
}
