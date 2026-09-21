-- CreateEnum
CREATE TYPE "FamilyRole" AS ENUM ('PARENT', 'TEACHER', 'CAREGIVER', 'CHILD');

-- AlterTable
ALTER TABLE "Learner" ADD COLUMN "lastFamilyRole" "FamilyRole",
ADD COLUMN "gender" TEXT,
ADD COLUMN "diagnosis" TEXT,
ADD COLUMN "schoolName" TEXT,
ADD COLUMN "city" TEXT,
ADD COLUMN "teacherEmail" TEXT,
ADD COLUMN "caregiverEmail" TEXT,
ADD COLUMN "profileCompletedAt" TIMESTAMP(3);
