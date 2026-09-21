import { AccountStatus, type FamilyRole } from "@prisma/client";
import { FAMILY_ROLE_LABELS } from "../domain/stage.js";
import { otpMailboxForRole, type FamilyRoleValue } from "../domain/journey.js";
import { HttpError } from "../lib/http.js";
import { dummyPasswordHash, hashPassword, verifyPassword } from "../lib/password.js";
import { hashToken, newOtpCode, newRefreshToken, signAccessToken } from "../lib/tokens.js";
import { writeAudit } from "../lib/audit.js";
import { sendOtpEmail, demoInbox } from "../lib/mailer.js";
import { publicUser } from "../lib/serialize.js";
import { prisma } from "../lib/prisma.js";

const OTP_PURPOSE_RESET = "password_reset";
const OTP_PURPOSE_LOGIN = "login";
const ALL_FAMILY_ROLES: FamilyRoleValue[] = ["PARENT", "TEACHER", "CAREGIVER", "CHILD"];

function assertParentFirst(
  learner: { profileCompletedAt: Date | null } | null | undefined,
  familyRole?: FamilyRole,
) {
  if (!learner || learner.profileCompletedAt) return;
  if (familyRole && familyRole !== "PARENT") {
    throw new HttpError(
      403,
      "PARENT_FIRST",
      "The parent must complete Basic Information first. Teacher, caregiver, and child can sign in after that.",
    );
  }
}

function staffRoleLabel(role: "ADMIN" | "EXPERT" | "RESPONDENT"): string {
  if (role === "ADMIN") return "Administrator";
  if (role === "EXPERT") return "Specialist";
  return "Parent";
}

async function issueLoginOtp(input: {
  id: string;
  email: string;
  role: "ADMIN" | "EXPERT" | "RESPONDENT";
  familyRole?: FamilyRoleValue;
  learner?: {
    teacherEmail: string | null;
    caregiverEmail: string | null;
  } | null;
}) {
  await prisma.emailOtp.updateMany({
    where: { email: input.email, purpose: OTP_PURPOSE_LOGIN, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  const otp = newOtpCode();
  await prisma.emailOtp.create({
    data: {
      email: input.email,
      purpose: OTP_PURPOSE_LOGIN,
      codeHash: await hashPassword(otp.code),
      expiresAt: otp.expiresAt,
    },
  });

  const roleLabel = input.familyRole ? FAMILY_ROLE_LABELS[input.familyRole] : staffRoleLabel(input.role);
  const mailbox = input.familyRole
    ? otpMailboxForRole({
        familyRole: input.familyRole,
        accountEmail: input.email,
        teacherEmail: input.learner?.teacherEmail,
        caregiverEmail: input.learner?.caregiverEmail,
      })
    : input.email;

  await sendOtpEmail(mailbox, otp.code, OTP_PURPOSE_LOGIN, input.id, roleLabel);
  return {
    roleLabel,
    mailbox,
    inbox: demoInbox({
      to: mailbox,
      subject: "Your PVI-CAP sign-in code",
      code: otp.code,
    }),
  };
}

async function issueSession(userId: string, email: string, role: "ADMIN" | "EXPERT" | "RESPONDENT") {
  const refresh = newRefreshToken();
  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: refresh.hash,
      expiresAt: refresh.expiresAt,
    },
  });
  return {
    accessToken: signAccessToken({ sub: userId, email, role }),
    refreshToken: refresh.raw,
  };
}

async function loadActiveUser(email: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { learner: true },
  });
  return user;
}

export async function login(input: {
  email: string;
  password: string;
  familyRole?: FamilyRole;
  ip?: string;
}) {
  const user = await loadActiveUser(input.email);
  const hash = user?.passwordHash ?? dummyPasswordHash;
  const matches = await verifyPassword(input.password, hash);

  if (!user || !matches) {
    throw new HttpError(401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
  }
  if (user.accountStatus !== AccountStatus.ACTIVE) {
    throw new HttpError(403, "ACCOUNT_DISABLED", "This account is not active.");
  }

  if (user.role !== "RESPONDENT") {
    const tokens = await issueSession(user.id, user.email, user.role);
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    await writeAudit({
      actorId: user.id,
      action: "AUTH_LOGIN",
      entityType: "User",
      entityId: user.id,
      ipAddress: input.ip,
    });
    return { ...tokens, user: publicUser(user) };
  }

  if (!input.familyRole) {
    const profileComplete = Boolean(user.learner?.profileCompletedAt);
    return {
      step: "choose_role" as const,
      email: user.email,
      defaultFamilyRole: (profileComplete ? (user.learner?.lastFamilyRole ?? "PARENT") : "PARENT") as FamilyRoleValue,
      profileComplete,
      allowedRoles: profileComplete ? ALL_FAMILY_ROLES : (["PARENT"] as FamilyRoleValue[]),
    };
  }

  assertParentFirst(user.learner, input.familyRole);

  const familyRole = user.role === "RESPONDENT" ? (input.familyRole as FamilyRoleValue) : undefined;
  const { roleLabel, mailbox, inbox } = await issueLoginOtp({
    id: user.id,
    email: user.email,
    role: user.role,
    familyRole,
    learner: user.learner,
  });

  await writeAudit({
    actorId: user.id,
    action: "AUTH_LOGIN_OTP_SENT",
    entityType: "User",
    entityId: user.id,
    metadata: familyRole ? { familyRole, mailbox } : undefined,
    ipAddress: input.ip,
  });

  return {
    otpRequired: true as const,
    email: user.email,
    roleLabel,
    familyRole: familyRole ?? null,
    otpSentTo: mailbox,
    demoInbox: inbox,
  };
}

export async function verifyLoginOtp(input: {
  email: string;
  code: string;
  familyRole?: FamilyRole;
  ip?: string;
}) {
  const otp = await prisma.emailOtp.findFirst({
    where: {
      email: input.email,
      purpose: OTP_PURPOSE_LOGIN,
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!otp || !(await verifyPassword(input.code, otp.codeHash))) {
    throw new HttpError(400, "INVALID_OTP", "That code is invalid or has expired.");
  }

  const user = await loadActiveUser(input.email);
  if (!user || user.accountStatus !== AccountStatus.ACTIVE) {
    throw new HttpError(400, "INVALID_OTP", "That code is invalid or has expired.");
  }

  await prisma.emailOtp.update({
    where: { id: otp.id },
    data: { consumedAt: new Date() },
  });

  if (user.role === "RESPONDENT") {
    assertParentFirst(user.learner, input.familyRole);
  }

  if (user.role === "RESPONDENT" && user.learner && input.familyRole) {
    await prisma.learner.update({
      where: { id: user.learner.id },
      data: { lastFamilyRole: input.familyRole },
    });
    user.learner.lastFamilyRole = input.familyRole;
  }

  const tokens = await issueSession(user.id, user.email, user.role);
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });
  await writeAudit({
    actorId: user.id,
    action: "AUTH_LOGIN",
    entityType: "User",
    entityId: user.id,
    metadata: input.familyRole ? { familyRole: input.familyRole } : undefined,
    ipAddress: input.ip,
  });

  return { ...tokens, user: publicUser(user) };
}

export async function resendLoginOtp(email: string, familyRole?: FamilyRole, ip?: string) {
  const recent = await prisma.emailOtp.findFirst({
    where: {
      email,
      purpose: OTP_PURPOSE_LOGIN,
      createdAt: { gt: new Date(Date.now() - 10 * 60 * 1000) },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!recent) {
    return { ok: true as const };
  }

  const user = await loadActiveUser(email);
  if (!user || user.accountStatus !== AccountStatus.ACTIVE) {
    return { ok: true as const };
  }

  if (user.role === "RESPONDENT") {
    assertParentFirst(user.learner, familyRole);
  }

  const { inbox, mailbox, roleLabel } = await issueLoginOtp({
    id: user.id,
    email: user.email,
    role: user.role,
    familyRole: user.role === "RESPONDENT" ? (familyRole as FamilyRoleValue | undefined) : undefined,
    learner: user.learner,
  });
  await writeAudit({
    actorId: user.id,
    action: "AUTH_LOGIN_OTP_RESENT",
    entityType: "User",
    entityId: user.id,
    ipAddress: ip,
  });
  return { ok: true as const, roleLabel, otpSentTo: mailbox, demoInbox: inbox };
}

export async function refreshSession(refreshToken: string) {
  const tokenHash = hashToken(refreshToken);
  const stored = await prisma.refreshToken.findFirst({
    where: { tokenHash, revokedAt: null, expiresAt: { gt: new Date() } },
    include: { user: { include: { learner: true } } },
  });

  if (!stored || stored.user.accountStatus !== AccountStatus.ACTIVE) {
    throw new HttpError(401, "UNAUTHORIZED", "Session expired or invalid. Sign in again.");
  }

  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revokedAt: new Date() },
  });

  const tokens = await issueSession(stored.user.id, stored.user.email, stored.user.role);
  return { ...tokens, user: publicUser(stored.user) };
}

export async function logout(userId: string, refreshToken: string, ip?: string) {
  const tokenHash = hashToken(refreshToken);
  await prisma.refreshToken.updateMany({
    where: { userId, tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  await writeAudit({
    actorId: userId,
    action: "AUTH_LOGOUT",
    entityType: "User",
    entityId: userId,
    ipAddress: ip,
  });
}

export async function requestPasswordReset(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.accountStatus === AccountStatus.SUSPENDED) {
    return;
  }

  await prisma.emailOtp.updateMany({
    where: { email, purpose: OTP_PURPOSE_RESET, consumedAt: null },
    data: { consumedAt: new Date() },
  });

  const otp = newOtpCode();
  await prisma.emailOtp.create({
    data: {
      email,
      purpose: OTP_PURPOSE_RESET,
      codeHash: await hashPassword(otp.code),
      expiresAt: otp.expiresAt,
    },
  });
  await sendOtpEmail(email, otp.code, OTP_PURPOSE_RESET, user.id);
}

export async function resetPassword(input: { email: string; code: string; password: string; ip?: string }) {
  const otp = await prisma.emailOtp.findFirst({
    where: {
      email: input.email,
      purpose: OTP_PURPOSE_RESET,
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!otp || !(await verifyPassword(input.code, otp.codeHash))) {
    throw new HttpError(400, "INVALID_OTP", "That code is invalid or has expired.");
  }

  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) {
    throw new HttpError(400, "INVALID_OTP", "That code is invalid or has expired.");
  }

  await prisma.$transaction([
    prisma.emailOtp.update({
      where: { id: otp.id },
      data: { consumedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(input.password) },
    }),
    prisma.refreshToken.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);

  await writeAudit({
    actorId: user.id,
    action: "AUTH_PASSWORD_RESET",
    entityType: "User",
    entityId: user.id,
    ipAddress: input.ip,
  });
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { learner: true },
  });
  if (!user) {
    throw new HttpError(401, "UNAUTHORIZED", "Sign in required.");
  }
  return publicUser(user);
}
