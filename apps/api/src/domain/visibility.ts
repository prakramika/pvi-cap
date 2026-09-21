import type { AssessmentStage } from "@prisma/client";

/** Stage-based tools only show items mapped to the learner's stage. HDMA/VLAP ignore stage. */
export function isQuestionVisible(
  isStageBased: boolean,
  mappedStages: AssessmentStage[],
  learnerStage: AssessmentStage,
): boolean {
  if (!isStageBased) return true;
  return mappedStages.includes(learnerStage);
}

export function progressPercent(answered: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((answered / total) * 100);
}

export function isResponseComplete(input: {
  type: "SINGLE_CHOICE" | "MULTI_CHOICE" | "SCALE" | "FREE_TEXT";
  optionId?: string | null;
  freeText?: string | null;
}): boolean {
  if (input.type === "FREE_TEXT") {
    return Boolean(input.freeText && input.freeText.trim().length > 0);
  }
  return Boolean(input.optionId);
}
