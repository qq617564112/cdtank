export interface RoleSkillRecord {
  skillId: number;
  triggerType: number;
  functions: readonly {type: number; t: number}[];
}

