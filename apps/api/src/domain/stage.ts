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

export const STAGE_GUIDANCE: Record<AssessmentStage, string> = {
  EARLY_CHILDHOOD:
    "For young children. A parent, guardian, or teacher answers by watching the child. The child does not need an email or a login.",
  PRE_SKILL:
    "For developing independence. An adult usually answers, with the child nearby if that feels comfortable.",
  BASIC:
    "The child may join in. An adult still signs in and can pause whenever the child needs a break.",
  INTERMEDIATE:
    "The young person can take part more directly, with a trusted adult close by.",
  ADVANCED:
    "The young person may use their own sign-in, or a parent may still complete it with them.",
};

export const RELATION_LABELS: Record<
  "PARENT" | "GUARDIAN" | "TEACHER" | "SELF" | "OTHER",
  string
> = {
  PARENT: "Parent",
  GUARDIAN: "Caregiver",
  TEACHER: "Teacher",
  SELF: "Child",
  OTHER: "Caregiver",
};

export const FAMILY_ROLE_LABELS: Record<"PARENT" | "TEACHER" | "CAREGIVER" | "CHILD", string> = {
  PARENT: "Parent",
  TEACHER: "Teacher",
  CAREGIVER: "Caregiver",
  CHILD: "Child",
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
