import type { AccountStatus, AssessmentStage, Learner, Role, User } from "@prisma/client";
import { STAGE_LABELS } from "../domain/stage.js";

export type PublicLearner = {
  id: string;
  displayName: string;
  dateOfBirth: string;
  assignedStage: AssessmentStage;
  stageLabel: string;
  stageOverridden: boolean;
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
    assignedStage: learner.assignedStage,
    stageLabel: STAGE_LABELS[learner.assignedStage],
    stageOverridden: learner.stageOverridden,
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
