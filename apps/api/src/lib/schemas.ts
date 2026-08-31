import { AccountStatus, Role } from "@prisma/client";
import { z } from "zod";

export const emailSchema = z
  .string()
  .trim()
  .email()
  .transform((value) => value.toLowerCase());

export const passwordSchema = z
  .string()
  .min(10, "Password must be at least 10 characters.")
  .regex(/[A-Za-z]/, "Password must include a letter.")
  .regex(/[0-9]/, "Password must include a number.");

export const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.");

export const loginBody = z.object({
  email: emailSchema,
  password: z.string().min(1),
});

export const refreshBody = z.object({
  refreshToken: z.string().min(16),
});

export const logoutBody = z.object({
  refreshToken: z.string().min(16),
});

export const forgotPasswordBody = z.object({
  email: emailSchema,
});

export const resetPasswordBody = z.object({
  email: emailSchema,
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code."),
  password: passwordSchema,
});

export const createUserBody = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    firstName: z.string().trim().min(1).max(80),
    lastName: z.string().trim().min(1).max(80),
    role: z.nativeEnum(Role),
    displayName: z.string().trim().min(1).max(120).optional(),
    dateOfBirth: isoDateSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (value.role === Role.RESPONDENT) {
      if (!value.displayName) {
        ctx.addIssue({ code: "custom", path: ["displayName"], message: "Learner display name is required." });
      }
      if (!value.dateOfBirth) {
        ctx.addIssue({ code: "custom", path: ["dateOfBirth"], message: "Learner date of birth is required." });
      }
    }
  });

export const updateUserBody = z.object({
  firstName: z.string().trim().min(1).max(80).optional(),
  lastName: z.string().trim().min(1).max(80).optional(),
  role: z.nativeEnum(Role).optional(),
  accountStatus: z.nativeEnum(AccountStatus).optional(),
});

export const updateLearnerBody = z.object({
  displayName: z.string().trim().min(1).max(120).optional(),
  dateOfBirth: isoDateSchema.optional(),
  assignedStage: z
    .enum(["EARLY_CHILDHOOD", "PRE_SKILL", "BASIC", "INTERMEDIATE", "ADVANCED"])
    .optional(),
  stageOverridden: z.boolean().optional(),
});

export const listQuery = z.object({
  q: z.string().trim().max(120).optional(),
  role: z.nativeEnum(Role).optional(),
  accountStatus: z.nativeEnum(AccountStatus).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
