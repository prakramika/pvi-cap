import type {
  AccountStatus,
  AssessmentStage,
  FamilyRole,
  Learner,
  RespondentRelation,
  Role,
  User,
} from "@prisma/client";
import { FAMILY_ROLE_LABELS, RELATION_LABELS, STAGE_GUIDANCE, STAGE_LABELS, ageYearsFromDob } from "../domain/stage.js";

export type PublicLearner = {
  id: string;
  displayName: string;
  dateOfBirth: string;
  ageYears: number;
  assignedStage: AssessmentStage;
  stageLabel: string;
  stageGuidance: string;
  stageOverridden: boolean;
  respondentRelation: RespondentRelation;
  relationLabel: string;
    lastFamilyRole: FamilyRole | null;
    familyRoleLabel: string | null;
    gender: string | null;
    diagnosis: string | null;
    schoolName: string | null;
    city: string | null;
    teacherEmail: string | null;
    caregiverEmail: string | null;
    profileComplete: boolean;
};

export type PublicUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  accountStatus: AccountStatus;
  lastLoginAt: string | null;
  createdAt: string;
  learner: PublicLearner | null;
};

export function toDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function publicLearner(learner: Learner): PublicLearner {
  return {
    id: learner.id,
    displayName: learner.displayName,
    dateOfBirth: toDateOnly(learner.dateOfBirth),
    ageYears: ageYearsFromDob(learner.dateOfBirth),
    assignedStage: learner.assignedStage,
    stageLabel: STAGE_LABELS[learner.assignedStage],
    stageGuidance: STAGE_GUIDANCE[learner.assignedStage],
    stageOverridden: learner.stageOverridden,
    respondentRelation: learner.respondentRelation,
    relationLabel: learner.lastFamilyRole
      ? FAMILY_ROLE_LABELS[learner.lastFamilyRole]
      : RELATION_LABELS[learner.respondentRelation],
    lastFamilyRole: learner.lastFamilyRole,
    familyRoleLabel: learner.lastFamilyRole ? FAMILY_ROLE_LABELS[learner.lastFamilyRole] : null,
    gender: learner.gender,
    diagnosis: learner.diagnosis,
    schoolName: learner.schoolName,
    city: learner.city,
    teacherEmail: learner.teacherEmail,
    caregiverEmail: learner.caregiverEmail,
    profileComplete: Boolean(learner.profileCompletedAt),
  };
}

export function publicUser(user: User & { learner?: Learner | null }): PublicUser {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    accountStatus: user.accountStatus,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
    learner: user.learner ? publicLearner(user.learner) : null,
  };
}
