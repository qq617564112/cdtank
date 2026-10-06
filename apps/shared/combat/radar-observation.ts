import type {PlayerSnapshot} from '../protocols/MsgRoomSnapshot';

export interface RadarModifiers {
  jammer: boolean;
  detector: boolean;
}

const RADAR_JAMMER_SKILL_ID = 13111;
const RADAR_DETECTOR_SKILL_ID = 13112;

/** Func21 passive sources are selected role skills, never global catalog entries. */
export function readRadarModifiers(selectedSkillIds: readonly number[] | undefined): RadarModifiers {
  return {
    jammer: selectedSkillIds?.includes(RADAR_JAMMER_SKILL_ID) ?? false,
    detector: selectedSkillIds?.includes(RADAR_DETECTOR_SKILL_ID) ?? false,
  };
}

/** Tactical-minimap relationship only; actor visibility and optical camouflage stay separate. */
export function canObserveRadarMarker(observer: PlayerSnapshot, target: PlayerSnapshot, mode: number,
  radarJammed = observer.radarJammed === true): boolean {
  if (target.id === observer.id) return true;
  const hostile = mode >= 4 || target.team !== observer.team;
  if (!hostile) return true;
  const detector = readRadarModifiers(observer.roleSkillSources?.selectedSkillIds).detector;
  if (radarJammed && !detector) return false;
  if (!readRadarModifiers(target.roleSkillSources?.selectedSkillIds).jammer) return true;
  return detector;
}
