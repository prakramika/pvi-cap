import { AssessmentStage, QuestionType } from "@prisma/client";
import { HttpError } from "../lib/http.js";
import { writeAudit } from "../lib/audit.js";
import { prisma } from "../lib/prisma.js";

const LIKERT = [
  { label: "4 — Always", value: "4", sortOrder: 1 },
  { label: "3 — Often", value: "3", sortOrder: 2 },
  { label: "2 — Sometimes", value: "2", sortOrder: 3 },
  { label: "1 — Never", value: "1", sortOrder: 4 },
];

const STAGES: AssessmentStage[] = [
  AssessmentStage.EARLY_CHILDHOOD,
  AssessmentStage.PRE_SKILL,
  AssessmentStage.BASIC,
  AssessmentStage.INTERMEDIATE,
  AssessmentStage.ADVANCED,
];

export type QuestionInput = {
  toolCode: string;
  sectionTitle: string;
  indicatorCode: string;
  prompt: string;
  type: QuestionType;
  isQualitative?: boolean;
  isActive?: boolean;
  scoringNotes?: string | null;
  stages?: AssessmentStage[];
  options?: { label: string; value: string; sortOrder?: number }[];
};

function serializeQuestion(
  question: {
    id: string;
    indicatorCode: string;
    prompt: string;
    type: QuestionType;
    sortOrder: number;
    isQualitative: boolean;
    isActive: boolean;
    scoringNotes: string | null;
    options: { id: string; label: string; value: string; sortOrder: number }[];
    stages: { stage: AssessmentStage }[];
    _count?: { responses: number };
  },
  section: { id: string; title: string; sortOrder: number },
  tool: { code: string; name: string },
) {
  return {
    id: question.id,
    toolCode: tool.code,
    toolName: tool.name,
    sectionId: section.id,
    sectionTitle: section.title,
    indicatorCode: question.indicatorCode,
    prompt: question.prompt,
    type: question.type,
    sortOrder: question.sortOrder,
    isQualitative: question.isQualitative,
    isActive: question.isActive,
    scoringNotes: question.scoringNotes,
    stages: question.stages.map((row) => row.stage),
    options: question.options,
    responseCount: question._count?.responses ?? 0,
  };
}

async function ensureSection(toolId: string, title: string) {
  const existing = await prisma.assessmentSection.findFirst({ where: { toolId, title } });
  if (existing) return existing;
  const last = await prisma.assessmentSection.aggregate({ where: { toolId }, _max: { sortOrder: true } });
  return prisma.assessmentSection.create({
    data: { toolId, title, sortOrder: (last._max.sortOrder ?? 0) + 1 },
  });
}

function resolveOptions(type: QuestionType, options?: QuestionInput["options"]) {
  if (type === "FREE_TEXT") return [];
  if (options?.length) {
    return options.map((option, index) => ({
      label: option.label,
      value: option.value || String(option.sortOrder ?? index + 1),
      sortOrder: option.sortOrder ?? index + 1,
    }));
  }
  return LIKERT;
}

function resolveStages(isStageBased: boolean, stages?: AssessmentStage[]) {
  if (!isStageBased) return [];
  if (stages?.length) return stages;
  return STAGES;
}

export async function listQuestionBank() {
  const tools = await prisma.assessmentTool.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      sections: {
        orderBy: { sortOrder: "asc" },
        include: {
          questions: {
            orderBy: { sortOrder: "asc" },
            include: {
              options: { orderBy: { sortOrder: "asc" } },
              stages: true,
              _count: { select: { responses: true } },
            },
          },
        },
      },
    },
  });

  return {
    tools: tools.map((tool) => ({
      id: tool.id,
      code: tool.code,
      name: tool.name,
      isStageBased: tool.isStageBased,
      sortOrder: tool.sortOrder,
      sections: tool.sections.map((section) => ({
        id: section.id,
        title: section.title,
        sortOrder: section.sortOrder,
        questions: section.questions.map((question) => serializeQuestion(question, section, tool)),
      })),
    })),
  };
}

export async function upsertQuestion(input: QuestionInput, actorId: string, ip?: string) {
  const tool = await prisma.assessmentTool.findUnique({ where: { code: input.toolCode.toUpperCase() } });
  if (!tool) throw new HttpError(404, "NOT_FOUND", "Assessment section (tool) not found.");

  const section = await ensureSection(tool.id, input.sectionTitle.trim());
  const options = resolveOptions(input.type, input.options);
  const stages = resolveStages(tool.isStageBased, input.stages);
  const indicatorCode = input.indicatorCode.trim();

  const existing = await prisma.question.findUnique({
    where: { toolId_indicatorCode: { toolId: tool.id, indicatorCode } },
  });

  const saved = existing
    ? await prisma.question.update({
        where: { id: existing.id },
        data: {
          sectionId: section.id,
          prompt: input.prompt.trim(),
          type: input.type,
          isQualitative: input.isQualitative ?? existing.isQualitative,
          isActive: input.isActive ?? existing.isActive,
          scoringNotes: input.scoringNotes ?? existing.scoringNotes,
        },
      })
    : await prisma.question.create({
        data: {
          toolId: tool.id,
          sectionId: section.id,
          indicatorCode,
          prompt: input.prompt.trim(),
          type: input.type,
          sortOrder:
            ((
              await prisma.question.aggregate({
                where: { sectionId: section.id },
                _max: { sortOrder: true },
              })
            )._max.sortOrder ?? 0) + 1,
          isQualitative: input.isQualitative ?? false,
          isActive: input.isActive ?? true,
          scoringNotes: input.scoringNotes,
        },
      });

  await prisma.answerOption.deleteMany({
    where: {
      questionId: saved.id,
      sortOrder: { notIn: options.map((option) => option.sortOrder) },
    },
  });
  for (const option of options) {
    await prisma.answerOption.upsert({
      where: { questionId_sortOrder: { questionId: saved.id, sortOrder: option.sortOrder } },
      create: { questionId: saved.id, ...option },
      update: { label: option.label, value: option.value },
    });
  }
  await prisma.questionStage.deleteMany({ where: { questionId: saved.id } });
  if (stages.length) {
    await prisma.questionStage.createMany({
      data: stages.map((stage) => ({ questionId: saved.id, stage })),
    });
  }

  await writeAudit({
    actorId,
    action: existing ? "QUESTION_UPDATE" : "QUESTION_CREATE",
    entityType: "Question",
    entityId: saved.id,
    metadata: { toolCode: tool.code, indicatorCode },
    ipAddress: ip,
  });

  const full = await prisma.question.findUniqueOrThrow({
    where: { id: saved.id },
    include: {
      options: { orderBy: { sortOrder: "asc" } },
      stages: true,
      section: true,
      tool: true,
      _count: { select: { responses: true } },
    },
  });
  return serializeQuestion(full, full.section, full.tool);
}

export async function updateQuestion(
  id: string,
  patch: Partial<QuestionInput> & { prompt?: string; sectionTitle?: string },
  actorId: string,
  ip?: string,
) {
  const existing = await prisma.question.findUnique({
    where: { id },
    include: { tool: true, section: true, options: true, stages: true },
  });
  if (!existing) throw new HttpError(404, "NOT_FOUND", "Question not found.");

  const toolCode = patch.toolCode ?? existing.tool.code;
  return upsertQuestion(
    {
      toolCode,
      sectionTitle: patch.sectionTitle ?? existing.section.title,
      indicatorCode: patch.indicatorCode ?? existing.indicatorCode,
      prompt: patch.prompt ?? existing.prompt,
      type: patch.type ?? existing.type,
      isQualitative: patch.isQualitative ?? existing.isQualitative,
      isActive: patch.isActive ?? existing.isActive,
      scoringNotes: patch.scoringNotes === undefined ? existing.scoringNotes : patch.scoringNotes,
      stages: patch.stages ?? existing.stages.map((row) => row.stage),
      options:
        patch.options ??
        existing.options.map((option) => ({
          label: option.label,
          value: option.value,
          sortOrder: option.sortOrder,
        })),
    },
    actorId,
    ip,
  );
}

export async function deleteQuestion(id: string, actorId: string, ip?: string) {
  const existing = await prisma.question.findUnique({
    where: { id },
    include: { _count: { select: { responses: true } } },
  });
  if (!existing) throw new HttpError(404, "NOT_FOUND", "Question not found.");

  if (existing._count.responses > 0) {
    const hidden = await prisma.question.update({
      where: { id },
      data: { isActive: false },
    });
    await writeAudit({
      actorId,
      action: "QUESTION_HIDE",
      entityType: "Question",
      entityId: id,
      ipAddress: ip,
    });
    return { id: hidden.id, hidden: true as const };
  }

  await prisma.question.delete({ where: { id } });
  await writeAudit({
    actorId,
    action: "QUESTION_DELETE",
    entityType: "Question",
    entityId: id,
    ipAddress: ip,
  });
  return { id, hidden: false as const };
}

export function csvTemplate(): string {
  return [
    "toolCode,sectionTitle,indicatorCode,prompt,type,options,stages,isQualitative",
    'HDMA,Daily living,HDMA-001,Does the child complete a familiar daily routine?,SCALE,"4 — Always|3 — Often|2 — Sometimes|1 — Never",,false',
    'III,Activity preference,III-EC,Does the learner prefer messy play?,SCALE,"4 — Always|3 — Often|2 — Sometimes|1 — Never",EARLY_CHILDHOOD,false',
    "III,Qualitative note,III-FT,Describe one activity the child returns to without being asked.,FREE_TEXT,,,true",
  ].join("\n");
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]!;
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
      continue;
    }
    if (char === ",") {
      row.push(cell.trim());
      cell = "";
      continue;
    }
    if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(cell.trim());
      cell = "";
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      continue;
    }
    cell += char;
  }
  row.push(cell.trim());
  if (row.some((value) => value.length > 0)) rows.push(row);
  return rows;
}

function parseType(value: string): QuestionType {
  const upper = value.trim().toUpperCase().replaceAll(" ", "_");
  if (upper === "SINGLE_CHOICE" || upper === "MULTI_CHOICE" || upper === "SCALE" || upper === "FREE_TEXT") {
    return upper;
  }
  if (upper === "LIKERT" || upper === "RADIO") return QuestionType.SCALE;
  if (upper === "TEXT" || upper === "FILL") return QuestionType.FREE_TEXT;
  throw new HttpError(400, "VALIDATION", `Unknown question type: ${value}`);
}

function parseStages(value: string): AssessmentStage[] | undefined {
  if (!value.trim() || value.trim().toUpperCase() === "ALL") return undefined;
  return value.split(/[|,]/).map((part) => {
    const key = part.trim().toUpperCase().replaceAll(" ", "_") as AssessmentStage;
    if (!STAGES.includes(key)) {
      throw new HttpError(400, "VALIDATION", `Unknown stage: ${part}`);
    }
    return key;
  });
}

function parseOptions(optionsRaw: string): QuestionInput["options"] | undefined {
  if (!optionsRaw.trim()) return undefined;
  return optionsRaw.split("|").map((label, index) => {
    const trimmed = label.trim();
    const match = trimmed.match(/^(-?\d+)/);
    return {
      label: trimmed,
      value: match?.[1] ?? String(index + 1),
      sortOrder: index + 1,
    };
  });
}

export function questionsFromCsv(csv: string): QuestionInput[] {
  const rows = parseCsv(csv.replace(/^\uFEFF/, ""));
  if (rows.length < 2) throw new HttpError(400, "VALIDATION", "CSV needs a header row and at least one question.");
  const header = rows[0]!.map((value) => value.replaceAll(" ", "").toLowerCase());
  const index = (name: string) => header.indexOf(name);
  const required = ["toolcode", "sectiontitle", "indicatorcode", "prompt", "type"];
  for (const name of required) {
    if (index(name) === -1) {
      throw new HttpError(400, "VALIDATION", `CSV is missing column: ${name}`);
    }
  }

  return rows.slice(1).map((row) => {
    const col = (name: string) => {
      const at = index(name);
      return at >= 0 ? row[at] ?? "" : "";
    };
    return {
      toolCode: col("toolcode"),
      sectionTitle: col("sectiontitle"),
      indicatorCode: col("indicatorcode"),
      prompt: col("prompt"),
      type: parseType(col("type")),
      isQualitative: col("isqualitative").toLowerCase() === "true",
      stages: parseStages(col("stages")),
      options: parseOptions(col("options")),
    };
  });
}

export async function importCsv(csv: string, actorId: string, ip?: string) {
  const questions = questionsFromCsv(csv);
  let created = 0;
  let updated = 0;
  for (const question of questions) {
    const existing = await prisma.question.findFirst({
      where: {
        tool: { code: question.toolCode.toUpperCase() },
        indicatorCode: question.indicatorCode,
      },
    });
    await upsertQuestion(question, actorId, ip);
    if (existing) updated += 1;
    else created += 1;
  }
  return { created, updated, total: created + updated };
}
