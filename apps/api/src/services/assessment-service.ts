import type { AssessmentStage, FamilyRole, InstanceStatus, Prisma, QuestionType } from "@prisma/client";
import { HttpError } from "../lib/http.js";
import { writeAudit } from "../lib/audit.js";
import { prisma } from "../lib/prisma.js";
import { FAMILY_ROLE_LABELS, STAGE_LABELS } from "../domain/stage.js";
import { isQuestionVisible, isResponseComplete, progressPercent } from "../domain/visibility.js";
import { DONE_INSTANCE_STATUSES, familySectionStates, overallSectionProgress } from "../domain/journey.js";
import { sendCompletionEmail, demoInbox } from "../lib/mailer.js";

type Auth = { userId: string; role: "ADMIN" | "EXPERT" | "RESPONDENT" };

const instanceInclude = {
  tool: true,
  learner: { include: { user: true } },
  review: true,
  responses: { include: { option: true } },
} satisfies Prisma.AssessmentInstanceInclude;

function questionFilter(isStageBased: boolean, stage: AssessmentStage): Prisma.QuestionWhereInput {
  if (!isStageBased) return { isActive: true };
  return { isActive: true, stages: { some: { stage } } };
}

async function requireLearner(userId: string) {
  const learner = await prisma.learner.findUnique({
    where: { userId },
    include: { user: true },
  });
  if (!learner) {
    throw new HttpError(403, "FORBIDDEN", "Only family accounts can take assessments.");
  }
  return learner;
}

function sittingFiller(learner: { lastFamilyRole: FamilyRole | null }): FamilyRole {
  return learner.lastFamilyRole ?? "PARENT";
}

function assertSittingAccess(
  auth: Auth,
  instance: { familyRole: FamilyRole; learner: { userId: string; lastFamilyRole: FamilyRole | null } },
) {
  const isStaff = auth.role === "ADMIN" || auth.role === "EXPERT";
  if (isStaff) return;
  if (instance.learner.userId !== auth.userId) {
    throw new HttpError(403, "FORBIDDEN", "You cannot view this assessment.");
  }
  if (instance.familyRole !== sittingFiller(instance.learner)) {
    throw new HttpError(
      403,
      "WRONG_FILLER",
      "This sitting belongs to another person filling the form for this child.",
    );
  }
}

function firstUnanswered(
  questions: Awaited<ReturnType<typeof loadAssignedQuestions>>,
  responses: { questionId: string; optionId: string | null; freeText: string | null }[],
) {
  const byQuestion = new Map(responses.map((row) => [row.questionId, row]));
  return questions.find((question) => {
    const response = byQuestion.get(question.id);
    return !isResponseComplete({
      type: question.type,
      optionId: response?.optionId,
      freeText: response?.freeText,
    });
  });
}

async function loadAssignedQuestions(toolId: string, isStageBased: boolean, stage: AssessmentStage) {
  return prisma.question.findMany({
    where: { toolId, ...questionFilter(isStageBased, stage) },
    include: { options: { orderBy: { sortOrder: "asc" } }, stages: true, section: true },
    orderBy: [{ section: { sortOrder: "asc" } }, { sortOrder: "asc" }],
  });
}

async function recalcProgress(instanceId: string, isStageBased: boolean, stage: AssessmentStage, toolId: string) {
  const questions = await loadAssignedQuestions(toolId, isStageBased, stage);
  const responses = await prisma.response.findMany({ where: { instanceId } });
  const byQuestion = new Map(responses.map((row) => [row.questionId, row]));
  const answered = questions.filter((question) => {
    const response = byQuestion.get(question.id);
    return (
      response &&
      isResponseComplete({
        type: question.type,
        optionId: response.optionId,
        freeText: response.freeText,
      })
    );
  }).length;
  const percent = progressPercent(answered, questions.length);
  await prisma.assessmentInstance.update({
    where: { id: instanceId },
    data: { progressPercent: percent },
  });
  return { answered, total: questions.length, percent };
}

function serializeInstance(
  instance: Prisma.AssessmentInstanceGetPayload<{ include: typeof instanceInclude }>,
  questions: Awaited<ReturnType<typeof loadAssignedQuestions>>,
  forStaff: boolean,
) {
  const byQuestion = new Map(instance.responses.map((row) => [row.questionId, row]));
  const sectionsMap = new Map<
    string,
    {
      id: string;
      title: string;
      sortOrder: number;
      questions: unknown[];
    }
  >();

  for (const question of questions) {
    if (
      !isQuestionVisible(
        instance.tool.isStageBased,
        question.stages.map((row) => row.stage),
        instance.stage,
      )
    ) {
      continue;
    }
    const section = sectionsMap.get(question.sectionId) ?? {
      id: question.section.id,
      title: question.section.title,
      sortOrder: question.section.sortOrder,
      questions: [],
    };
    const response = byQuestion.get(question.id);
    section.questions.push({
      id: question.id,
      indicatorCode: question.indicatorCode,
      prompt: question.prompt,
      type: question.type as QuestionType,
      isQualitative: question.isQualitative,
      sortOrder: question.sortOrder,
      options: question.options.map((option) => ({
        id: option.id,
        label: option.label,
        value: option.value,
        sortOrder: option.sortOrder,
      })),
      response: response
        ? {
            optionId: response.optionId,
            optionLabel: response.option?.label ?? null,
            freeText: response.freeText,
            savedAt: response.savedAt.toISOString(),
          }
        : null,
      ...(forStaff ? { scoringNotes: question.scoringNotes } : {}),
    });
    sectionsMap.set(question.sectionId, section);
  }

  const sections = [...sectionsMap.values()].sort((a, b) => a.sortOrder - b.sortOrder);
  const total = questions.length;
  const answered = questions.filter((question) => {
    const response = byQuestion.get(question.id);
    return (
      response &&
      isResponseComplete({ type: question.type, optionId: response.optionId, freeText: response.freeText })
    );
  }).length;

  return {
    sampleContent: false,
    instance: {
      id: instance.id,
      status: instance.status,
      familyRole: instance.familyRole,
      familyRoleLabel: FAMILY_ROLE_LABELS[instance.familyRole],
      progressPercent: instance.progressPercent,
      stage: instance.stage,
      stageLabel: STAGE_LABELS[instance.stage],
      startedAt: instance.startedAt?.toISOString() ?? null,
      submittedAt: instance.submittedAt?.toISOString() ?? null,
      tool: {
        code: instance.tool.code,
        name: instance.tool.name,
        isStageBased: instance.tool.isStageBased,
        contractedIndicatorCount: instance.tool.indicatorCount,
      },
      learner: {
        id: instance.learner.id,
        displayName: instance.learner.displayName,
        respondentEmail: instance.learner.user.email,
        respondentName: `${instance.learner.user.firstName} ${instance.learner.user.lastName}`,
      },
      review: instance.review
        ? {
            id: instance.review.id,
            status: instance.review.status,
            notes: instance.review.notes,
            reviewedAt: instance.review.reviewedAt?.toISOString() ?? null,
          }
        : null,
    },
    sections,
    progress: { answered, total, percent: progressPercent(answered, total) },
    resume: (() => {
      const current = firstUnanswered(questions, instance.responses);
      const index = current ? questions.findIndex((row) => row.id === current.id) : questions.length;
      return {
        questionId: current?.id ?? null,
        index,
        total,
        done: !current,
      };
    })(),
  };
}

export async function catalogForUser(auth: Auth) {
  const learner = await requireLearner(auth.userId);
  const filler = sittingFiller(learner);
  const tools = await prisma.assessmentTool.findMany({ orderBy: { sortOrder: "asc" } });
  const instances = await prisma.assessmentInstance.findMany({
    where: { learnerId: learner.id, familyRole: filler },
  });
  const byTool = new Map(instances.map((row) => [row.toolId, row]));
  const states = familySectionStates(
    tools.map((tool) => ({
      code: tool.code,
      sortOrder: tool.sortOrder,
      status: byTool.get(tool.id)?.status ?? null,
    })),
  );
  const stateByCode = new Map(states.map((row) => [row.code, row.state]));
  const overall = overallSectionProgress(states);

  const rows = [];
  for (const tool of tools) {
    const assigned = await prisma.question.count({
      where: { toolId: tool.id, ...questionFilter(tool.isStageBased, learner.assignedStage) },
    });
    const instance = byTool.get(tool.id);
    const state = stateByCode.get(tool.code) ?? "locked";
    rows.push({
      code: tool.code,
      name: tool.name,
      isStageBased: tool.isStageBased,
      contractedIndicatorCount: tool.indicatorCount,
      availableQuestionCount: assigned,
      sampleContent: false,
      sortOrder: tool.sortOrder,
      state,
      canBegin: state === "active" && Boolean(learner.profileCompletedAt) && assigned > 0,
      instance: instance
        ? {
            id: instance.id,
            status: instance.status,
            progressPercent: instance.progressPercent,
            submittedAt: instance.submittedAt?.toISOString() ?? null,
          }
        : null,
    });
  }

  const resumeTool = rows.find(
    (row) => row.state === "active" && row.instance && !DONE_INSTANCE_STATUSES.has(row.instance.status),
  );

  return {
    profileComplete: Boolean(learner.profileCompletedAt),
    familyRole: filler,
    familyRoleLabel: FAMILY_ROLE_LABELS[filler],
    childName: learner.displayName,
    stage: learner.assignedStage,
    stageLabel: STAGE_LABELS[learner.assignedStage],
    overall,
    allComplete: overall.completed === overall.total && overall.total > 0,
    resumeInstanceId: resumeTool?.instance?.id ?? null,
    tools: rows,
  };
}

export async function startAssessment(auth: Auth, toolCode: string, ip?: string) {
  const learner = await requireLearner(auth.userId);
  if (!learner.profileCompletedAt) {
    throw new HttpError(403, "PROFILE_INCOMPLETE", "Complete the child profile before starting the assessment.");
  }

  const filler = sittingFiller(learner);
  const tool = await prisma.assessmentTool.findUnique({ where: { code: toolCode.toUpperCase() } });
  if (!tool) throw new HttpError(404, "NOT_FOUND", "Assessment tool not found.");

  const tools = await prisma.assessmentTool.findMany({ orderBy: { sortOrder: "asc" } });
  const instances = await prisma.assessmentInstance.findMany({
    where: { learnerId: learner.id, familyRole: filler },
  });
  const byTool = new Map(instances.map((row) => [row.toolId, row]));
  const states = familySectionStates(
    tools.map((row) => ({
      code: row.code,
      sortOrder: row.sortOrder,
      status: byTool.get(row.id)?.status ?? null,
    })),
  );
  const thisState = states.find((row) => row.code === tool.code)?.state;
  if (thisState === "locked") {
    throw new HttpError(409, "SECTION_LOCKED", "Finish the previous section first. You cannot skip ahead.");
  }
  if (thisState === "completed") {
    throw new HttpError(409, "LOCKED", "This section is already completed.");
  }

  const existing = await prisma.assessmentInstance.findUnique({
    where: {
      learnerId_toolId_familyRole: { learnerId: learner.id, toolId: tool.id, familyRole: filler },
    },
    include: instanceInclude,
  });
  if (existing && DONE_INSTANCE_STATUSES.has(existing.status)) {
    const questions = await loadAssignedQuestions(tool.id, tool.isStageBased, existing.stage);
    return serializeInstance(existing, questions, false);
  }

  const instance = existing
    ? await prisma.assessmentInstance.update({
        where: { id: existing.id },
        data: {
          status: "IN_PROGRESS",
          startedAt: existing.startedAt ?? new Date(),
          stage: learner.assignedStage,
        },
        include: instanceInclude,
      })
    : await prisma.assessmentInstance.create({
        data: {
          learnerId: learner.id,
          toolId: tool.id,
          familyRole: filler,
          stage: learner.assignedStage,
          status: "IN_PROGRESS",
          startedAt: new Date(),
        },
        include: instanceInclude,
      });

  await writeAudit({
    actorId: auth.userId,
    action: "ASSESSMENT_START",
    entityType: "AssessmentInstance",
    entityId: instance.id,
    metadata: { toolCode: tool.code },
    ipAddress: ip,
  });

  const questions = await loadAssignedQuestions(tool.id, tool.isStageBased, instance.stage);
  return serializeInstance(instance, questions, false);
}

export async function getAssessment(auth: Auth, instanceId: string) {
  const instance = await prisma.assessmentInstance.findUnique({
    where: { id: instanceId },
    include: instanceInclude,
  });
  if (!instance) throw new HttpError(404, "NOT_FOUND", "Assessment not found.");
  assertSittingAccess(auth, instance);
  const isStaff = auth.role === "ADMIN" || auth.role === "EXPERT";
  const questions = await loadAssignedQuestions(instance.toolId, instance.tool.isStageBased, instance.stage);
  return serializeInstance(instance, questions, isStaff);
}

export async function saveResponse(
  auth: Auth,
  instanceId: string,
  input: { questionId: string; optionId?: string | null; freeText?: string | null },
) {
  const instance = await prisma.assessmentInstance.findUnique({
    where: { id: instanceId },
    include: { tool: true, learner: true, responses: true },
  });
  if (!instance) throw new HttpError(404, "NOT_FOUND", "Assessment not found.");
  assertSittingAccess(auth, instance);
  if (DONE_INSTANCE_STATUSES.has(instance.status)) {
    throw new HttpError(409, "LOCKED", "This assessment is already submitted.");
  }

  const questions = await loadAssignedQuestions(instance.toolId, instance.tool.isStageBased, instance.stage);
  const current = firstUnanswered(questions, instance.responses);
  if (!current || current.id !== input.questionId) {
    throw new HttpError(400, "SEQUENCE", "Answer the current question. You cannot go back or skip ahead.");
  }

  const question = questions.find((row) => row.id === input.questionId);
  if (!question) throw new HttpError(400, "VALIDATION", "That question is not part of this sitting.");

  if (question.type === "FREE_TEXT") {
    if (input.optionId) throw new HttpError(400, "VALIDATION", "This question is a fill-in answer, not a choice.");
  } else if (input.optionId && !question.options.some((option) => option.id === input.optionId)) {
    throw new HttpError(400, "VALIDATION", "That option does not belong to this question.");
  }

  await prisma.response.upsert({
    where: { instanceId_questionId: { instanceId, questionId: input.questionId } },
    create: {
      instanceId,
      questionId: input.questionId,
      optionId: input.optionId ?? null,
      freeText: input.freeText ?? null,
    },
    update: {
      optionId: input.optionId ?? null,
      freeText: input.freeText ?? null,
      savedAt: new Date(),
    },
  });

  const progress = await recalcProgress(instanceId, instance.tool.isStageBased, instance.stage, instance.toolId);
  if (progress.answered >= progress.total && progress.total > 0) {
    const submitted = await submitAssessment(auth, instanceId);
    return {
      ok: true as const,
      progress: { ...progress, percent: 100 },
      submitted: true as const,
      allComplete: submitted.allComplete,
      completionDemoInbox: submitted.completionDemoInbox,
    };
  }

  return { ok: true as const, progress, submitted: false as const, allComplete: false };
}

export async function submitAssessment(auth: Auth, instanceId: string, ip?: string) {
  const instance = await prisma.assessmentInstance.findUnique({
    where: { id: instanceId },
    include: { tool: true, learner: { include: { user: true } } },
  });
  if (!instance) throw new HttpError(404, "NOT_FOUND", "Assessment not found.");
  assertSittingAccess(auth, instance);
  if (DONE_INSTANCE_STATUSES.has(instance.status)) {
    throw new HttpError(409, "LOCKED", "This assessment is already submitted.");
  }

  const progress = await recalcProgress(instanceId, instance.tool.isStageBased, instance.stage, instance.toolId);
  if (progress.total === 0) {
    throw new HttpError(409, "EMPTY", "No sample questions are available for this stage yet.");
  }
  if (progress.answered < progress.total) {
    throw new HttpError(400, "INCOMPLETE", `Answer all questions before submitting (${progress.answered}/${progress.total}).`);
  }

  const updated = await prisma.assessmentInstance.update({
    where: { id: instanceId },
    data: { status: "SUBMITTED", submittedAt: new Date(), progressPercent: 100 },
    include: instanceInclude,
  });

  await writeAudit({
    actorId: auth.userId,
    action: "ASSESSMENT_SUBMIT",
    entityType: "AssessmentInstance",
    entityId: instanceId,
    ipAddress: ip,
  });

  const toolCount = await prisma.assessmentTool.count();
  const submittedCount = await prisma.assessmentInstance.count({
    where: {
      learnerId: instance.learnerId,
      familyRole: instance.familyRole,
      status: { in: ["SUBMITTED", "UNDER_REVIEW", "REVIEWED"] },
    },
  });
  const allComplete = submittedCount >= toolCount;
  let completionDemoInbox: ReturnType<typeof demoInbox>;
  if (allComplete) {
    await sendCompletionEmail({
      to: instance.learner.user.email,
      adultFirstName: instance.learner.user.firstName,
      childName: instance.learner.displayName,
      userId: instance.learner.userId,
    });
    completionDemoInbox = demoInbox({
      to: instance.learner.user.email,
      subject: `You have completed the career assessment for ${instance.learner.displayName}`,
    });
  }

  const questions = await loadAssignedQuestions(instance.toolId, instance.tool.isStageBased, instance.stage);
  return {
    ...serializeInstance(updated, questions, false),
    allComplete,
    completionDemoInbox,
  };
}

export async function listStaffAssessments(query: {
  q?: string;
  toolCode?: string;
  status?: InstanceStatus;
  reviewStatus?: "PENDING" | "IN_REVIEW" | "COMPLETED";
  stage?: AssessmentStage;
  page?: number;
  pageSize?: number;
}) {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;
  const where: Prisma.AssessmentInstanceWhereInput = {
    AND: [
      query.status ? { status: query.status } : {},
      query.stage ? { stage: query.stage } : {},
      query.toolCode ? { tool: { code: query.toolCode.toUpperCase() } } : {},
      query.reviewStatus ? { review: { status: query.reviewStatus } } : {},
      query.q
        ? {
            OR: [
              { learner: { displayName: { contains: query.q, mode: "insensitive" } } },
              { learner: { user: { email: { contains: query.q, mode: "insensitive" } } } },
              { learner: { user: { firstName: { contains: query.q, mode: "insensitive" } } } },
              { learner: { user: { lastName: { contains: query.q, mode: "insensitive" } } } },
            ],
          }
        : {},
    ],
  };

  const [total, rows] = await prisma.$transaction([
    prisma.assessmentInstance.count({ where }),
    prisma.assessmentInstance.findMany({
      where,
      include: instanceInclude,
      orderBy: [{ submittedAt: "desc" }, { updatedAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    page,
    pageSize,
    total,
    assessments: rows.map((row) => ({
      id: row.id,
      status: row.status,
      progressPercent: row.progressPercent,
      stage: row.stage,
      stageLabel: STAGE_LABELS[row.stage],
      submittedAt: row.submittedAt?.toISOString() ?? null,
      toolCode: row.tool.code,
      toolName: row.tool.name,
      learnerName: row.learner.displayName,
      respondentName: `${row.learner.user.firstName} ${row.learner.user.lastName}`,
      respondentEmail: row.learner.user.email,
      reviewStatus: row.review?.status ?? null,
    })),
  };
}

export async function reviewAssessment(
  auth: Auth,
  instanceId: string,
  input: { notes?: string; status: "PENDING" | "IN_REVIEW" | "COMPLETED" },
  ip?: string,
) {
  const instance = await prisma.assessmentInstance.findUnique({ where: { id: instanceId } });
  if (!instance) throw new HttpError(404, "NOT_FOUND", "Assessment not found.");
  if (!["SUBMITTED", "UNDER_REVIEW", "REVIEWED"].includes(instance.status)) {
    throw new HttpError(409, "NOT_SUBMITTED", "Review is only available after submission.");
  }

  const instanceStatus = input.status === "COMPLETED" ? "REVIEWED" : "UNDER_REVIEW";
  await prisma.$transaction([
    prisma.review.upsert({
      where: { instanceId },
      create: {
        instanceId,
        reviewerId: auth.userId,
        status: input.status,
        notes: input.notes,
        reviewedAt: input.status === "COMPLETED" ? new Date() : null,
      },
      update: {
        reviewerId: auth.userId,
        status: input.status,
        notes: input.notes,
        reviewedAt: input.status === "COMPLETED" ? new Date() : null,
      },
    }),
    prisma.assessmentInstance.update({
      where: { id: instanceId },
      data: { status: instanceStatus },
    }),
  ]);

  await writeAudit({
    actorId: auth.userId,
    action: "ASSESSMENT_REVIEW",
    entityType: "AssessmentInstance",
    entityId: instanceId,
    metadata: { status: input.status },
    ipAddress: ip,
  });

  return getAssessment(auth, instanceId);
}
