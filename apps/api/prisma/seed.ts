import { PrismaClient, Role } from "@prisma/client";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { hashPassword } from "../src/lib/password.js";
import { stageFromDob } from "../src/domain/stage.js";
import { questionsFromCsv } from "../src/services/question-service.js";
import "../src/config/env.js";

const prisma = new PrismaClient();

const TOOLS = [
  {
    code: "HDMA",
    name: "Holistic Development Milestone Assessment",
    description: "Stage-based developmental checklist from the CAP Assessment.",
    indicatorCount: 792,
    isStageBased: true,
    sortOrder: 1,
  },
  {
    code: "III",
    name: "Interest Identification Inventory",
    description: "Stage-based (5 stages). Includes qualitative free-text items.",
    indicatorCount: 477,
    isStageBased: true,
    sortOrder: 2,
  },
  {
    code: "CALP",
    name: "Cognitive Ability & Learning Profile",
    description: "Stage-based (5 stages).",
    indicatorCount: 330,
    isStageBased: true,
    sortOrder: 3,
  },
  {
    code: "FSIC",
    name: "Functional Skills & Independence Checklist",
    description: "Stage-based (5 stages).",
    indicatorCount: 100,
    isStageBased: true,
    sortOrder: 4,
  },
  {
    code: "BWRS",
    name: "Behavioural & Workplace Readiness Scale",
    description: "Stage-based (5 stages).",
    indicatorCount: 80,
    isStageBased: true,
    sortOrder: 5,
  },
  {
    code: "VLAP",
    name: "Vocational Learning & Aptitude Profile",
    description: "All ages complete all questions.",
    indicatorCount: 185,
    isStageBased: false,
    sortOrder: 6,
  },
] as const;

async function seedTools() {
  for (const tool of TOOLS) {
    await prisma.assessmentTool.upsert({
      where: { code: tool.code },
      create: { ...tool },
      update: {
        name: tool.name,
        description: tool.description,
        indicatorCount: tool.indicatorCount,
        isStageBased: tool.isStageBased,
        sortOrder: tool.sortOrder,
      },
    });
  }
}

async function seedQuestions() {
  await prisma.question.updateMany({
    where: { indicatorCode: { startsWith: "SAMPLE-" } },
    data: { isActive: false },
  });

  const csvPath = join(dirname(fileURLToPath(import.meta.url)), "../../../data/pvi-cap-questions.csv");
  const questions = questionsFromCsv(readFileSync(csvPath, "utf8"));
  const tools = new Map(
    (await prisma.assessmentTool.findMany()).map((tool) => [tool.code, tool] as const),
  );
  const sections = new Map(
    (await prisma.assessmentSection.findMany()).map((section) => [`${section.toolId}:${section.title}`, section] as const),
  );
  const sectionCount = new Map<string, number>();
  for (const section of sections.values()) {
    sectionCount.set(section.toolId, Math.max(sectionCount.get(section.toolId) ?? 0, section.sortOrder));
  }

  let created = 0;
  for (const question of questions) {
    const tool = tools.get(question.toolCode.toUpperCase());
    if (!tool) throw new Error(`Unknown tool in CSV: ${question.toolCode}`);
    const sectionTitle = question.sectionTitle.trim();
    const sectionKey = `${tool.id}:${sectionTitle}`;
    let section = sections.get(sectionKey);
    if (!section) {
      const sortOrder = (sectionCount.get(tool.id) ?? 0) + 1;
      sectionCount.set(tool.id, sortOrder);
      section = await prisma.assessmentSection.create({
        data: { toolId: tool.id, title: sectionTitle, sortOrder },
      });
      sections.set(sectionKey, section);
    }

    const saved = await prisma.question.upsert({
      where: { toolId_indicatorCode: { toolId: tool.id, indicatorCode: question.indicatorCode } },
      create: {
        toolId: tool.id,
        sectionId: section.id,
        indicatorCode: question.indicatorCode,
        prompt: question.prompt,
        type: question.type,
        sortOrder: created + 1,
        isQualitative: question.isQualitative ?? false,
        isActive: true,
      },
      update: {
        sectionId: section.id,
        prompt: question.prompt,
        type: question.type,
        isQualitative: question.isQualitative ?? false,
        isActive: true,
      },
    });

    const options = question.options ?? [];
    await prisma.answerOption.deleteMany({ where: { questionId: saved.id } });
    if (options.length) {
      await prisma.answerOption.createMany({
        data: options.map((option, index) => ({
          questionId: saved.id,
          label: option.label,
          value: option.value,
          sortOrder: option.sortOrder ?? index + 1,
        })),
      });
    }

    await prisma.questionStage.deleteMany({ where: { questionId: saved.id } });
    if (question.stages?.length) {
      await prisma.questionStage.createMany({
        data: question.stages.map((stage) => ({ questionId: saved.id, stage })),
      });
    }
    created += 1;
    if (created % 500 === 0) console.log(`  questions ${created}/${questions.length}`);
  }
  console.log(`Seeded ${created} questions from data/pvi-cap-questions.csv`);
}

async function upsertUser(input: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: Role;
    learner?: { displayName: string; dateOfBirth: string; respondentRelation?: "PARENT" | "GUARDIAN" | "TEACHER" | "SELF" | "OTHER" };
}) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    console.log(`User already present: ${input.email}`);
    return existing;
  }
  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash: await hashPassword(input.password),
      firstName: input.firstName,
      lastName: input.lastName,
      role: input.role,
    },
  });
  if (input.learner) {
    const dob = new Date(`${input.learner.dateOfBirth}T00:00:00.000Z`);
    await prisma.learner.create({
      data: {
        userId: user.id,
        displayName: input.learner.displayName,
        dateOfBirth: dob,
        assignedStage: stageFromDob(dob),
        respondentRelation: input.learner.respondentRelation ?? "PARENT",
      },
    });
  }
  console.log(`Seeded ${input.role.toLowerCase()} ${input.email}`);
  return user;
}

async function main() {
  await seedTools();
  await seedQuestions();
  await upsertUser({
    email: "admin@gmail.com",
    password: process.env.ADMIN_PASSWORD ?? "Admin12345a",
    firstName: "PVI",
    lastName: "Admin",
    role: Role.ADMIN,
  });
  const extraAdmin = (process.env.ADMIN_EMAIL ?? "").toLowerCase();
  if (extraAdmin && extraAdmin !== "admin@gmail.com") {
    await upsertUser({
      email: extraAdmin,
      password: process.env.ADMIN_PASSWORD ?? "Admin12345a",
      firstName: "PVI",
      lastName: "Admin",
      role: Role.ADMIN,
    });
  }
  await upsertUser({
    email: "respondent@pvi.local",
    password: "Respondent1",
    firstName: "Priya",
    lastName: "Kumar",
    role: Role.RESPONDENT,
    learner: { displayName: "Aarav Kumar", dateOfBirth: "2014-01-15", respondentRelation: "PARENT" },
  });
  await upsertUser({
    email: "early@pvi.local",
    password: "Respondent1",
    firstName: "Meera",
    lastName: "Iyer",
    role: Role.RESPONDENT,
    learner: { displayName: "Anaya Iyer", dateOfBirth: "2023-06-01", respondentRelation: "PARENT" },
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
