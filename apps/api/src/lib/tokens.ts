import { createHmac, randomBytes, randomInt } from "node:crypto";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import type { Role } from "@prisma/client";

export type AccessClaims = {
  sub: string;
  email: string;
  role: Role;
};

const ACCESS_TTL_SEC = 15 * 60;
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const OTP_TTL_MS = 10 * 60 * 1000;

export function signAccessToken(claims: AccessClaims): string {
  return jwt.sign(claims, env.jwtAccessSecret, { expiresIn: ACCESS_TTL_SEC });
}

export function verifyAccessToken(token: string): AccessClaims {
  const payload = jwt.verify(token, env.jwtAccessSecret);
  if (typeof payload !== "object" || payload === null || typeof payload.sub !== "string") {
    throw new Error("Invalid access token.");
  }
  const role = payload.role;
  if (role !== "ADMIN" && role !== "EXPERT" && role !== "RESPONDENT") {
    throw new Error("Invalid access token.");
  }
  if (typeof payload.email !== "string") {
    throw new Error("Invalid access token.");
  }
  return { sub: payload.sub, email: payload.email, role };
}

export function newRefreshToken(): { raw: string; hash: string; expiresAt: Date } {
  const raw = randomBytes(32).toString("hex");
  return {
    raw,
    hash: hashToken(raw),
    expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
  };
}

export function hashToken(raw: string): string {
  return createHmac("sha256", env.jwtRefreshSecret).update(raw).digest("hex");
}

export function newOtpCode(): { code: string; expiresAt: Date } {
  return {
    code: randomInt(0, 1_000_000).toString().padStart(6, "0"),
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
  };
}

export const tokenTtl = {
  accessSeconds: ACCESS_TTL_SEC,
  refreshMs: REFRESH_TTL_MS,
  otpMs: OTP_TTL_MS,
};
