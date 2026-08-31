import type { AssessmentStage } from "@prisma/client";
import { HttpError } from "../lib/http.js";
import { writeAudit } from "../lib/audit.js";
import { publicLearner } from "../lib/serialize.js";
import { stageFromDob } from "../domain/stage.js";
import { prisma } from "../lib/prisma.js";

function parseDob(isoDate: string): Date {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date > new Date()) {
    throw new HttpError(400, "VALIDATION", "Date of birth is invalid.");
  }
  return date;
}

export async function getLearnerForUser(userId: string) {
  const learner = await prisma.learner.findUnique({ where: { userId } });
  if (!learner) {
    throw new HttpError(404, "NOT_FOUND", "No learner is linked to this account.");
  }
  return publicLearner(learner);
}

export async function getLearnerById(id: string) {
  const learner = await prisma.learner.findUnique({ where: { id } });
  if (!learner) {
    throw new HttpError(404, "NOT_FOUND", "Learner not found.");
  }
  return publicLearner(learner);
}

export async function updateLearner(
  id: string,
  patch: {
    displayName?: string;
    dateOfBirth?: string;
    assignedStage?: AssessmentStage;
    stageOverridden?: boolean;
  },
  actorId: string,
  ip?: string,
) {
  const existing = await prisma.learner.findUnique({ where: { id } });
  if (!existing) {
    throw new HttpError(404, "NOT_FOUND", "Learner not found.");
  }

  const dateOfBirth = patch.dateOfBirth ? parseDob(patch.dateOfBirth) : existing.dateOfBirth;
  let assignedStage = existing.assignedStage;
  let stageOverridden = existing.stageOverridden;

  if (patch.assignedStage) {
    assignedStage = patch.assignedStage;
    stageOverridden = true;
  }
  if (patch.stageOverridden === false) {
    stageOverridden = false;
    assignedStage = stageFromDob(dateOfBirth);
  } else if (patch.stageOverridden === true && patch.assignedStage) {
    stageOverridden = true;
    assignedStage = patch.assignedStage;
  } else if (!stageOverridden) {
    assignedStage = stageFromDob(dateOfBirth);
  }

  const learner = await prisma.learner.update({
    where: { id },
    data: {
      displayName: patch.displayName,
      dateOfBirth,
      assignedStage,
      stageOverridden,
    },
  });

  if (stageOverridden !== existing.stageOverridden || assignedStage !== existing.assignedStage) {
    await writeAudit({
      actorId,
      action: "LEARNER_STAGE_OVERRIDE",
      entityType: "Learner",
      entityId: learner.id,
      metadata: {
        previousStage: existing.assignedStage,
        assignedStage,
        stageOverridden,
      },
      ipAddress: ip,
    });
  }

  return publicLearner(learner);
}
