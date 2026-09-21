import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseCsv, questionsFromCsv } from "./question-service.js";

describe("question CSV", () => {
  it("splits quoted commas and pipes in options", () => {
    const rows = parseCsv(
      'toolCode,sectionTitle,prompt\nHDMA,Daily living,"Does the child wait, then try?"\n',
    );
    assert.equal(rows[1]?.[2], "Does the child wait, then try?");
  });

  it("keeps leading numbers as option values", () => {
    const [question] = questionsFromCsv(
      [
        "toolCode,sectionTitle,indicatorCode,prompt,type,options,stages,isQualitative",
        'HDMA,Communication,HDMA-0001,Can the learner follow a simple instruction?,SCALE,"3 — Independent|2 — With Prompt|1 — Needs Support|0 — Not Applicable",EARLY_CHILDHOOD,false',
      ].join("\n"),
    );
    assert.equal(question?.options?.[0]?.value, "3");
    assert.equal(question?.options?.[3]?.value, "0");
    assert.equal(question?.stages?.[0], "EARLY_CHILDHOOD");
  });
});
