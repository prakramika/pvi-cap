import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AssessmentStage } from "@prisma/client";
import { isQuestionVisible, isResponseComplete, progressPercent } from "./visibility.js";

describe("question visibility", () => {
  it("shows every item when the tool is not stage-based", () => {
    assert.equal(isQuestionVisible(false, [], AssessmentStage.BASIC), true);
  });

  it("hides items not mapped to the learner stage", () => {
    assert.equal(
      isQuestionVisible(true, [AssessmentStage.EARLY_CHILDHOOD], AssessmentStage.BASIC),
      false,
    );
    assert.equal(isQuestionVisible(true, [AssessmentStage.BASIC], AssessmentStage.BASIC), true);
  });
});

describe("progress and completeness", () => {
  it("computes percent and treats empty free-text as incomplete", () => {
    assert.equal(progressPercent(2, 4), 50);
    assert.equal(isResponseComplete({ type: "FREE_TEXT", freeText: "  " }), false);
    assert.equal(isResponseComplete({ type: "SCALE", optionId: "x" }), true);
  });
});
