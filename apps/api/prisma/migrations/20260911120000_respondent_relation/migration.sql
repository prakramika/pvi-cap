-- CreateEnum
CREATE TYPE "RespondentRelation" AS ENUM ('PARENT', 'GUARDIAN', 'TEACHER', 'SELF', 'OTHER');

-- AlterTable
ALTER TABLE "Learner" ADD COLUMN "respondentRelation" "RespondentRelation" NOT NULL DEFAULT 'PARENT';
