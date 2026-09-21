import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { familySectionStates, otpMailboxForRole, overallSectionProgress } from "./journey.js";

describe("family section gate", () => {
  const tools = [
    { code: "HDMA", sortOrder: 1, status: null },
    { code: "III", sortOrder: 2, status: null },
    { code: "CALP", sortOrder: 3, status: null },
    { code: "FSIC", sortOrder: 4, status: null },
    { code: "BWRS", sortOrder: 5, status: null },
    { code: "VLAP", sortOrder: 6, status: null },
  ];

  it("opens only the first section until it is submitted", () => {
    const states = familySectionStates(tools);
    assert.deepEqual(
      states.map((row) => row.state),
      ["active", "locked", "locked", "locked", "locked", "locked"],
    );
  });

  it("opens the next section after the previous one is submitted", () => {
    const states = familySectionStates([
      { code: "HDMA", sortOrder: 1, status: "SUBMITTED" },
      { code: "III", sortOrder: 2, status: "IN_PROGRESS" },
      { code: "CALP", sortOrder: 3, status: null },
      { code: "FSIC", sortOrder: 4, status: null },
      { code: "BWRS", sortOrder: 5, status: null },
      { code: "VLAP", sortOrder: 6, status: null },
    ]);
    assert.equal(states[0]?.state, "completed");
    assert.equal(states[1]?.state, "active");
    assert.equal(states[2]?.state, "locked");
    assert.deepEqual(overallSectionProgress(states), { completed: 1, total: 6, percent: 17 });
  });

  it("does not let a later sitting become active if an earlier one is still open", () => {
    const states = familySectionStates([
      { code: "HDMA", sortOrder: 1, status: null },
      { code: "III", sortOrder: 2, status: "IN_PROGRESS" },
    ]);
    assert.equal(states[0]?.state, "active");
    assert.equal(states[1]?.state, "locked");
  });
});

describe("role mailbox", () => {
  it("sends the teacher OTP to the teacher address when one is on the child profile", () => {
    assert.equal(
      otpMailboxForRole({
        familyRole: "TEACHER",
        accountEmail: "parent@pvi.local",
        teacherEmail: "teacher@school.edu",
      }),
      "teacher@school.edu",
    );
  });

  it("falls back to the family username when the teacher address is empty", () => {
    assert.equal(
      otpMailboxForRole({
        familyRole: "TEACHER",
        accountEmail: "parent@pvi.local",
      }),
      "parent@pvi.local",
    );
  });
});
