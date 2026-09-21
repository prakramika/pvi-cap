import type { AssessmentStage } from "@prisma/client";
import { HttpError } from "../lib/http.js";
import { writeAudit } from "../lib/audit.js";
import { publicLearner } from "../lib/serialize.js";
import { sendRolePortalEmail } from "../lib/mailer.js";
import { stageFromDob } from "../domain/stage.js";
import { prisma } from "../lib/prisma.js";

function parseDob(isoDate: string): Date {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date > new Date()) {
    throw new HttpError(400, "VALIDATION", "Date of birth is invalid.");
  }
  return date;
}

function emptyToNull(value?: string): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export async function getLearnerForUser(userId: string) {
  const learner = await prisma.learner.findUnique({ where: { userId } });
  if (!learner) {
    throw new HttpError(404, "NOT_FOUND", "No child profile is linked to this account.");
  }
  return publicLearner(learner);
}

export async function getLearnerById(id: string) {
  const learner = await prisma.learner.findUnique({ where: { id } });
  if (!learner) {
    throw new HttpError(404, "NOT_FOUND", "Child profile not found.");
  }
  return publicLearner(learner);
}

export async function completeChildProfile(
  userId: string,
  patch: {
    displayName: string;
    dateOfBirth: string;
    gender: string;
    diagnosis?: string;
    schoolName?: string;
    city?: string;
    teacherEmail?: string;
    caregiverEmail?: string;
  },
  ip?: string,
) {
  const existing = await prisma.learner.findUnique({
    where: { userId },
    include: { user: true },
  });
  if (!existing) {
    throw new HttpError(404, "NOT_FOUND", "No child profile is linked to this account.");
  }
  if (!existing.profileCompletedAt && existing.lastFamilyRole && existing.lastFamilyRole !== "PARENT") {
    throw new HttpError(
      403,
      "PARENT_FIRST",
      "Only the parent can complete Basic Information the first time.",
    );
  }

  const dateOfBirth = parseDob(patch.dateOfBirth);
  const assignedStage = existing.stageOverridden ? existing.assignedStage : stageFromDob(dateOfBirth);
  const teacherEmail = emptyToNull(patch.teacherEmail);
  const caregiverEmail = emptyToNull(patch.caregiverEmail);

  const learner = await prisma.learner.update({
    where: { id: existing.id },
    data: {
      displayName: patch.displayName,
      dateOfBirth,
      assignedStage,
      gender: patch.gender,
      diagnosis: emptyToNull(patch.diagnosis),
      schoolName: emptyToNull(patch.schoolName),
      city: emptyToNull(patch.city),
      teacherEmail,
      caregiverEmail,
      profileCompletedAt: existing.profileCompletedAt ?? new Date(),
    },
  });

  await writeAudit({
    actorId: userId,
    action: existing.profileCompletedAt ? "CHILD_PROFILE_UPDATE" : "CHILD_PROFILE_COMPLETE",
    entityType: "Learner",
    entityId: learner.id,
    ipAddress: ip,
  });

  if (teacherEmail && teacherEmail !== existing.teacherEmail) {
    await sendRolePortalEmail({
      to: teacherEmail,
      roleLabel: "Teacher",
      childName: learner.displayName,
      username: existing.user.email,
      userId: existing.userId,
    });
  }
  if (caregiverEmail && caregiverEmail !== existing.caregiverEmail) {
    await sendRolePortalEmail({
      to: caregiverEmail,
      roleLabel: "Caregiver",
      childName: learner.displayName,
      username: existing.user.email,
      userId: existing.userId,
    });
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
    throw new HttpError(404, "NOT_FOUND", "Child profile not found.");
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
