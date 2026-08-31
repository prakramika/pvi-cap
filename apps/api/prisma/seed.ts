import { PrismaClient, Role } from "@prisma/client";
import { hashPassword } from "../src/lib/password.js";
import "../src/config/env.js";

const prisma = new PrismaClient();

const TOOLS = [
  {
    code: "HDMA",
    name: "Holistic Development & Milestone Assessment",
    description: "All learners complete all questions.",
    indicatorCount: 792,
    isStageBased: false,
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

async function seedAdmin() {
  const email = (process.env.ADMIN_EMAIL ?? "admin@pvi.local").toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "ChangeMe_admin1";
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Admin already present: ${email}`);
    return;
  }
  await prisma.user.create({
    data: {
      email,
      passwordHash: await hashPassword(password),
      firstName: "PVI",
      lastName: "Admin",
      role: Role.ADMIN,
    },
  });
  console.log(`Seeded admin ${email} (set ADMIN_PASSWORD in .env before production).`);
}

async function main() {
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

  await seedAdmin();
  console.log(`Seeded ${TOOLS.length} assessment tools (question bank awaits PVI content).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
