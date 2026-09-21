import type { FamilyRole, InstanceStatus } from "@prisma/client";
import { FAMILY_ROLE_LABELS, STAGE_LABELS } from "../domain/stage.js";
import { familySectionStates, overallSectionProgress } from "../domain/journey.js";
import { HttpError } from "../lib/http.js";
import { publicLearner } from "../lib/serialize.js";
import { prisma } from "../lib/prisma.js";
import { getAssessment } from "./assessment-service.js";

const FILLER_ORDER: FamilyRole[] = ["PARENT", "TEACHER", "CAREGIVER", "CHILD"];

function fillerTracks(
  tools: { id: string; code: string; name: string; sortOrder: number }[],
  assessments: {
    id: string;
    toolId: string;
    familyRole: FamilyRole;
    status: InstanceStatus;
    progressPercent: number;
  }[],
) {
  const present = new Set(assessments.map((row) => row.familyRole));
  const roles = FILLER_ORDER.filter((role) => role === "PARENT" || present.has(role));
  return roles.map((familyRole) => {
    const mine = assessments.filter((row) => row.familyRole === familyRole);
    const byTool = new Map(mine.map((row) => [row.toolId, row]));
    const states = familySectionStates(
      tools.map((tool) => ({
        code: tool.code,
        sortOrder: tool.sortOrder,
        status: byTool.get(tool.id)?.status ?? null,
      })),
    );
    const overall = overallSectionProgress(states);
    const stateByCode = new Map(states.map((row) => [row.code, row.state]));
    return {
      familyRole,
      familyRoleLabel: FAMILY_ROLE_LABELS[familyRole],
      overall,
      sections: tools.map((tool) => {
        const instance = byTool.get(tool.id);
        return {
          code: tool.code,
          name: tool.name,
          state: stateByCode.get(tool.code) ?? "locked",
          status: instance?.status ?? null,
          progressPercent: instance?.progressPercent ?? 0,
          instanceId: instance?.id ?? null,
        };
      }),
    };
  });
}

export async function listChildren() {
  const [learners, tools] = await Promise.all([
    prisma.learner.findMany({
      include: { user: true, assessments: { include: { tool: true } } },
      orderBy: { displayName: "asc" },
    }),
    prisma.assessmentTool.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);

  return {
    children: learners.map((learner) => {
      const fillers = fillerTracks(tools, learner.assessments);
      const parent = fillers.find((row) => row.familyRole === "PARENT") ?? fillers[0];
      return {
        id: learner.id,
        childName: learner.displayName,
        dateOfBirth: learner.dateOfBirth.toISOString().slice(0, 10),
        stageLabel: STAGE_LABELS[learner.assignedStage],
        profileComplete: Boolean(learner.profileCompletedAt),
        signedInAs: learner.lastFamilyRole ? FAMILY_ROLE_LABELS[learner.lastFamilyRole] : null,
        parentName: `${learner.user.firstName} ${learner.user.lastName}`,
        parentEmail: learner.user.email,
        overall: parent.overall,
        fillers,
        sections: parent.sections,
      };
    }),
  };
}

export async function getChildDesk(auth: { userId: string; role: "ADMIN" | "EXPERT" | "RESPONDENT" }, learnerId: string) {
  const learner = await prisma.learner.findUnique({
    where: { id: learnerId },
    include: { user: true, assessments: { include: { tool: true } } },
  });
  if (!learner) throw new HttpError(404, "NOT_FOUND", "Child not found.");

  const tools = await prisma.assessmentTool.findMany({ orderBy: { sortOrder: "asc" } });
  const fillers = fillerTracks(tools, learner.assessments);
  const parent = fillers.find((row) => row.familyRole === "PARENT") ?? fillers[0];
  const ordered = [...learner.assessments].sort((a, b) => {
    const roleDelta = FILLER_ORDER.indexOf(a.familyRole) - FILLER_ORDER.indexOf(b.familyRole);
    if (roleDelta !== 0) return roleDelta;
    return a.tool.sortOrder - b.tool.sortOrder;
  });
  const sittings = [];
  for (const instance of ordered) {
    sittings.push(await getAssessment(auth, instance.id));
  }

  return {
    child: publicLearner(learner),
    parentName: `${learner.user.firstName} ${learner.user.lastName}`,
    parentEmail: learner.user.email,
    overall: parent.overall,
    fillers,
    sittings,
  };
}
