import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertPasswordPolicy, hashPassword, verifyPassword } from "./password.js";

describe("password policy", () => {
  it("rejects short or letter-only secrets", () => {
    assert.throws(() => assertPasswordPolicy("short1"), /at least 10/);
    assert.throws(() => assertPasswordPolicy("lettersonly"), /letter and one number/);
  });

  it("hashes and verifies", async () => {
    const hash = await hashPassword("ChangeMe_admin1");
    assert.equal(await verifyPassword("ChangeMe_admin1", hash), true);
    assert.equal(await verifyPassword("wrong-password", hash), false);
  });
});
