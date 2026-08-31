import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AssessmentStage } from "@prisma/client";
import { ageYearsFromDob, stageFromAgeYears, stageFromDob } from "./stage.js";

describe("stage bands (Annexure B)", () => {
  it("maps ages to the five contracted stages", () => {
    assert.equal(stageFromAgeYears(0), AssessmentStage.EARLY_CHILDHOOD);
    assert.equal(stageFromAgeYears(5), AssessmentStage.EARLY_CHILDHOOD);
    assert.equal(stageFromAgeYears(6), AssessmentStage.PRE_SKILL);
    assert.equal(stageFromAgeYears(10), AssessmentStage.PRE_SKILL);
    assert.equal(stageFromAgeYears(11), AssessmentStage.BASIC);
    assert.equal(stageFromAgeYears(15), AssessmentStage.BASIC);
    assert.equal(stageFromAgeYears(16), AssessmentStage.INTERMEDIATE);
    assert.equal(stageFromAgeYears(20), AssessmentStage.INTERMEDIATE);
    assert.equal(stageFromAgeYears(21), AssessmentStage.ADVANCED);
    assert.equal(stageFromAgeYears(40), AssessmentStage.ADVANCED);
  });

  it("computes age and stage from date of birth", () => {
    const dob = new Date("2014-08-28T00:00:00.000Z");
    const on = new Date("2026-08-28T00:00:00.000Z");
    assert.equal(ageYearsFromDob(dob, on), 12);
    assert.equal(stageFromDob(dob, on), AssessmentStage.BASIC);
  });
});
