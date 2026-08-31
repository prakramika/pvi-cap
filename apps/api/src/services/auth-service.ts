import { AccountStatus } from "@prisma/client";
import { HttpError } from "../lib/http.js";
import { dummyPasswordHash, hashPassword, verifyPassword } from "../lib/password.js";
import { hashToken, newOtpCode, newRefreshToken, signAccessToken } from "../lib/tokens.js";
import { writeAudit } from "../lib/audit.js";
import { sendOtpEmail } from "../lib/mailer.js";
import { publicUser } from "../lib/serialize.js";
import { prisma } from "../lib/prisma.js";

const OTP_PURPOSE_RESET = "password_reset";

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

export async function login(input: { email: string; password: string; ip?: string }) {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    include: { learner: true },
  });

  const hash = user?.passwordHash ?? dummyPasswordHash;
  const matches = await verifyPassword(input.password, hash);

  if (!user || !matches) {
    throw new HttpError(401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
  }
  if (user.accountStatus !== AccountStatus.ACTIVE) {
    throw new HttpError(403, "ACCOUNT_DISABLED", "This account is not active.");
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
    ipAddress: input.ip,
  });

  return { ...tokens, user: publicUser(user) };
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
