interface CamouflagedActor {
  id: string;
  team: number;
  alive: boolean;
  opticalCamouflage?: {skillId: number; expiresAt: number};
  roleDisguise?: {skillId: number; expiresAt: number};
}

/** Reconstructed observer rule shared by actor drawing and CPU target selection. */
export function isHiddenByOpticalCamouflage(target: CamouflagedActor,
  observer: Pick<CamouflagedActor, 'id' | 'team'> | undefined, mode: number): boolean {
  return !!observer && target.alive && target.opticalCamouflage !== undefined
    && target.id !== observer.id && (mode >= 4 || target.team !== observer.team);
}

/** Concealed enemies cannot be acquired by AI or exposed by actor markers. */
export function isHiddenFromOpponent(target: CamouflagedActor,
  observer: Pick<CamouflagedActor, 'id' | 'team'> | undefined, mode: number): boolean {
  return !!observer && target.alive
    && (target.opticalCamouflage !== undefined || target.roleDisguise !== undefined)
    && target.id !== observer.id && (mode >= 4 || target.team !== observer.team);
}
