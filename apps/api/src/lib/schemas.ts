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

export const familyRoleSchema = z.enum(["PARENT", "TEACHER", "CAREGIVER", "CHILD"]);

export const loginBody = z.object({
  email: emailSchema,
  password: z.string().min(1),
  familyRole: familyRoleSchema.optional(),
});

export const verifyLoginOtpBody = z.object({
  email: emailSchema,
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code."),
  familyRole: familyRoleSchema.optional(),
});

export const resendLoginOtpBody = z.object({
  email: emailSchema,
  familyRole: familyRoleSchema.optional(),
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
    respondentRelation: z.enum(["PARENT", "GUARDIAN", "TEACHER", "SELF", "OTHER"]).optional(),
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

const optionalContactEmail = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().toLowerCase().email().optional(),
);

export const completeChildProfileBody = z.object({
  displayName: z.string().trim().min(1).max(120),
  dateOfBirth: isoDateSchema,
  gender: z.enum(["Girl", "Boy", "Other", "Prefer not to say"]),
  diagnosis: z.string().trim().max(500).optional(),
  schoolName: z.string().trim().max(160).optional(),
  city: z.string().trim().max(120).optional(),
  teacherEmail: optionalContactEmail,
  caregiverEmail: optionalContactEmail,
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

export const saveResponseBody = z.object({
  questionId: z.string().uuid(),
  optionId: z.string().uuid().nullable().optional(),
  freeText: z.string().max(4000).nullable().optional(),
});

export const startAssessmentBody = z.object({
  toolCode: z.string().trim().min(2).max(16),
});

export const reviewBody = z.object({
  notes: z.string().max(8000).optional(),
  status: z.enum(["PENDING", "IN_REVIEW", "COMPLETED"]),
});

export const questionUpsertBody = z.object({
  toolCode: z.string().trim().min(2).max(16),
  sectionTitle: z.string().trim().min(1).max(160),
  indicatorCode: z.string().trim().min(1).max(80),
  prompt: z.string().trim().min(1).max(2000),
  type: z.enum(["SINGLE_CHOICE", "MULTI_CHOICE", "SCALE", "FREE_TEXT"]),
  isQualitative: z.boolean().optional(),
  isActive: z.boolean().optional(),
  scoringNotes: z.string().max(2000).nullable().optional(),
  stages: z
    .array(z.enum(["EARLY_CHILDHOOD", "PRE_SKILL", "BASIC", "INTERMEDIATE", "ADVANCED"]))
    .optional(),
  options: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(200),
        value: z.string().trim().min(1).max(80),
        sortOrder: z.number().int().min(1).optional(),
      }),
    )
    .optional(),
});

export const questionPatchBody = questionUpsertBody.partial().extend({
  sectionTitle: z.string().trim().min(1).max(160).optional(),
  prompt: z.string().trim().min(1).max(2000).optional(),
});

export const questionImportBody = z.object({
  csv: z.string().min(20).max(500_000),
});

export const staffAssessmentQuery = z.object({
  q: z.string().trim().max(120).optional(),
  toolCode: z.string().trim().max(16).optional(),
  status: z.enum(["NOT_STARTED", "IN_PROGRESS", "SUBMITTED", "UNDER_REVIEW", "REVIEWED"]).optional(),
  reviewStatus: z.enum(["PENDING", "IN_REVIEW", "COMPLETED"]).optional(),
  stage: z.enum(["EARLY_CHILDHOOD", "PRE_SKILL", "BASIC", "INTERMEDIATE", "ADVANCED"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
