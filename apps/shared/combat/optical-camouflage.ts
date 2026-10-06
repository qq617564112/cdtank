interface CamouflagedActor {
  id: string;
  team: number;
  alive: boolean;
  opticalCamouflage?: {skillId: number; expiresAt: number};
}

/** Reconstructed observer rule shared by actor drawing and CPU target selection. */
export function isHiddenByOpticalCamouflage(target: CamouflagedActor,
  observer: Pick<CamouflagedActor, 'id' | 'team'> | undefined, mode: number): boolean {
  return !!observer && target.alive && target.opticalCamouflage?.skillId === 9
    && target.id !== observer.id && (mode >= 4 || target.team !== observer.team);
}
