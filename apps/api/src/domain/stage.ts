import { AssessmentStage } from "@prisma/client";

const BANDS: { maxAge: number; stage: AssessmentStage }[] = [
  { maxAge: 5, stage: AssessmentStage.EARLY_CHILDHOOD },
  { maxAge: 10, stage: AssessmentStage.PRE_SKILL },
  { maxAge: 15, stage: AssessmentStage.BASIC },
  { maxAge: 20, stage: AssessmentStage.INTERMEDIATE },
];

export const STAGE_LABELS: Record<AssessmentStage, string> = {
  EARLY_CHILDHOOD: "Early Childhood",
  PRE_SKILL: "Pre-Skill",
  BASIC: "Basic",
  INTERMEDIATE: "Intermediate",
  ADVANCED: "Advanced",
};

export function ageYearsFromDob(dateOfBirth: Date, on: Date = new Date()): number {
  let years = on.getUTCFullYear() - dateOfBirth.getUTCFullYear();
  const monthDelta = on.getUTCMonth() - dateOfBirth.getUTCMonth();
  if (monthDelta < 0 || (monthDelta === 0 && on.getUTCDate() < dateOfBirth.getUTCDate())) {
    years -= 1;
  }
  return Math.max(0, years);
}

export function stageFromAgeYears(ageYears: number): AssessmentStage {
  for (const band of BANDS) {
    if (ageYears <= band.maxAge) return band.stage;
  }
  return AssessmentStage.ADVANCED;
}

export function stageFromDob(dateOfBirth: Date, on?: Date): AssessmentStage {
  return stageFromAgeYears(ageYearsFromDob(dateOfBirth, on));
}
