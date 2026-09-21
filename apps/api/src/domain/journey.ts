import { progressPercent } from "./visibility.js";

export const FAMILY_ROLES = [
  { value: "PARENT", label: "Parent" },
  { value: "TEACHER", label: "Teacher" },
  { value: "CAREGIVER", label: "Caregiver" },
  { value: "CHILD", label: "Child" },
] as const;

export type FamilyRoleValue = (typeof FAMILY_ROLES)[number]["value"];

export const DONE_INSTANCE_STATUSES = new Set(["SUBMITTED", "UNDER_REVIEW", "REVIEWED"]);

export type SectionState = "completed" | "active" | "locked";

export function familySectionStates(
  tools: { code: string; sortOrder: number; status: string | null }[],
): { code: string; state: SectionState }[] {
  const ordered = [...tools].sort((a, b) => a.sortOrder - b.sortOrder);
  let foundActive = false;
  return ordered.map((tool) => {
    if (tool.status && DONE_INSTANCE_STATUSES.has(tool.status)) {
      return { code: tool.code, state: "completed" as const };
    }
    if (!foundActive) {
      foundActive = true;
      return { code: tool.code, state: "active" as const };
    }
    return { code: tool.code, state: "locked" as const };
  });
}

export function overallSectionProgress(states: { state: SectionState }[]) {
  const completed = states.filter((row) => row.state === "completed").length;
  return {
    completed,
    total: states.length,
    percent: progressPercent(completed, states.length),
  };
}

export function otpMailboxForRole(input: {
  familyRole: FamilyRoleValue;
  accountEmail: string;
  teacherEmail?: string | null;
  caregiverEmail?: string | null;
}): string {
  if (input.familyRole === "TEACHER" && input.teacherEmail) return input.teacherEmail;
  if (input.familyRole === "CAREGIVER" && input.caregiverEmail) return input.caregiverEmail;
  return input.accountEmail;
}
