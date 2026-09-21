-- AlterTable
ALTER TABLE "AssessmentInstance" ADD COLUMN "familyRole" "FamilyRole" NOT NULL DEFAULT 'PARENT';

-- DropIndex
DROP INDEX "AssessmentInstance_learnerId_toolId_key";

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentInstance_learnerId_toolId_familyRole_key" ON "AssessmentInstance"("learnerId", "toolId", "familyRole");

-- CreateIndex
CREATE INDEX "AssessmentInstance_learnerId_familyRole_idx" ON "AssessmentInstance"("learnerId", "familyRole");
