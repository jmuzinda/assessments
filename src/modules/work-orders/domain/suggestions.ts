export interface TechnicianSuggestion {
  technicianId: string;
  userId: string;
  name: string;
  email: string;
  skills: string[];
  hourlyRateCents: number;
  skillMatch: number;
  openAssignments: number;
  score: number;
}

export function countSkillMatches(skills: readonly string[], category: string | null | undefined): number {
  const target = category?.trim().toLowerCase() ?? '';
  if (!target) {
    return 0;
  }
  return skills.filter((skill) => skill.trim().toLowerCase() === target).length;
}

export function suggestionScore(skillMatch: number, openAssignments: number): number {
  return skillMatch * 100 - openAssignments;
}
