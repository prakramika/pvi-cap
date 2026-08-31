import { Prisma, Role } from "@prisma/client";
import { HttpError } from "../lib/http.js";
import { hashPassword } from "../lib/password.js";
import { writeAudit } from "../lib/audit.js";
import { sendWelcomeEmail } from "../lib/mailer.js";
import { publicUser } from "../lib/serialize.js";
import { stageFromDob } from "../domain/stage.js";
import { prisma } from "../lib/prisma.js";

function parseDob(isoDate: string): Date {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new HttpError(400, "VALIDATION", "Date of birth is invalid.");
  }
  if (date > new Date()) {
    throw new HttpError(400, "VALIDATION", "Date of birth cannot be in the future.");
  }
  return date;
}

export async function createUser(
  input: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role: Role;
    displayName?: string;
    dateOfBirth?: string;
  },
  actorId: string,
  ip?: string,
) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new HttpError(409, "EMAIL_TAKEN", "An account with this email already exists.");
  }

  const passwordHash = await hashPassword(input.password);
  const dateOfBirth = input.dateOfBirth ? parseDob(input.dateOfBirth) : undefined;

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        email: input.email,
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        role: input.role,
      },
    });

    if (input.role === Role.RESPONDENT && dateOfBirth && input.displayName) {
      await tx.learner.create({
        data: {
          userId: created.id,
          displayName: input.displayName,
          dateOfBirth,
          assignedStage: stageFromDob(dateOfBirth),
        },
      });
    }

    return tx.user.findUniqueOrThrow({
      where: { id: created.id },
      include: { learner: true },
    });
  });

  await writeAudit({
    actorId,
    action: "USER_CREATE",
    entityType: "User",
    entityId: user.id,
    metadata: { role: user.role, email: user.email },
    ipAddress: ip,
  });

  try {
    await sendWelcomeEmail(user.email, user.firstName, user.id);
  } catch (error) {
    console.error("Welcome email failed", error);
  }

  return publicUser(user);
}

export async function listUsers(query: {
  q?: string;
  role?: Role;
  accountStatus?: "ACTIVE" | "INACTIVE" | "SUSPENDED";
  page?: number;
  pageSize?: number;
}) {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;
  const where: Prisma.UserWhereInput = {
    AND: [
      query.role ? { role: query.role } : {},
      query.accountStatus ? { accountStatus: query.accountStatus } : {},
      query.q
        ? {
            OR: [
              { email: { contains: query.q, mode: "insensitive" } },
              { firstName: { contains: query.q, mode: "insensitive" } },
              { lastName: { contains: query.q, mode: "insensitive" } },
              { learner: { displayName: { contains: query.q, mode: "insensitive" } } },
            ],
          }
        : {},
    ],
  };

  const [total, rows] = await prisma.$transaction([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      include: { learner: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    page,
    pageSize,
    total,
    users: rows.map(publicUser),
  };
}

export async function getUser(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    include: { learner: true },
  });
  if (!user) {
    throw new HttpError(404, "NOT_FOUND", "User not found.");
  }
  return publicUser(user);
}

export async function updateUser(
  id: string,
  patch: {
    firstName?: string;
    lastName?: string;
    role?: Role;
    accountStatus?: "ACTIVE" | "INACTIVE" | "SUSPENDED";
  },
  actorId: string,
  ip?: string,
) {
  const existing = await prisma.user.findUnique({
    where: { id },
    include: { learner: true },
  });
  if (!existing) {
    throw new HttpError(404, "NOT_FOUND", "User not found.");
  }
  if (existing.id === actorId && patch.accountStatus && patch.accountStatus !== "ACTIVE") {
    throw new HttpError(400, "VALIDATION", "You cannot disable your own account.");
  }

  const user = await prisma.user.update({
    where: { id },
    data: {
      firstName: patch.firstName,
      lastName: patch.lastName,
      role: patch.role,
      accountStatus: patch.accountStatus,
    },
    include: { learner: true },
  });

  await writeAudit({
    actorId,
    action: "USER_UPDATE",
    entityType: "User",
    entityId: user.id,
    metadata: patch,
    ipAddress: ip,
  });

  return publicUser(user);
}
