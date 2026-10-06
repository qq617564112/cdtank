export interface RoleRecomputeTankBase {
  field84: number;
  field88: number;
  reloadDuration: number;
  field90: number;
  fieldA4: number;
  fieldA8: number;
}

export interface RoleRecomputePetBase {
  field7c: number;
  field80: number;
  field84: number;
  field88: number;
}

export interface RoleTankBaseDefinition extends RoleRecomputeTankBase {
  id: number;
  tankType: number;
}

export interface RolePetBaseDefinition extends RoleRecomputePetBase {
  id: number;
}
