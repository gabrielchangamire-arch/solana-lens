import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { analyzeTransaction } from "../src/analyzer.js";

const fixture = JSON.parse(await readFile(new URL("../public/sample-transaction.json", import.meta.url), "utf8"));

test("summarizes a successful system transfer", () => {
  const result = analyzeTransaction(fixture, { network: "devnet", signature: "demo" });
  assert.equal(result.status, "succeeded");
  assert.equal(result.fee, 0.000005);
  assert.equal(result.instructionCount, 1);
  assert.equal(result.transfers.length, 1);
  assert.equal(result.transfers[0].amount, 0.25);
  assert.equal(result.flags[0].level, "safe");
});

test("flags an unfamiliar program and a failed transaction", () => {
  const risky = structuredClone(fixture);
  risky.meta.err = { InstructionError: [0, "Custom"] };
  risky.transaction.message.instructions[0] = { programId: "UnknownProgram111111111111111111111111111" };
  const result = analyzeTransaction(risky);
  assert.equal(result.status, "failed");
  assert.ok(result.flags.some((flag) => flag.level === "danger"));
  assert.ok(result.flags.some((flag) => flag.title.includes("unfamiliar")));
});

test("rejects incomplete RPC responses", () => {
  assert.throws(() => analyzeTransaction({}), /parsed transaction/);
});
