import test from "node:test";
import assert from "node:assert/strict";
import { explainWithModel } from "../src/ai.js";

test("AI explanation cleanly degrades when no API key is configured", async () => {
  const result = await explainWithModel({ status: "succeeded", policy: { decision: "safe" } }, {});
  assert.deepEqual(result, { available: false, explanation: null, model: null });
});
