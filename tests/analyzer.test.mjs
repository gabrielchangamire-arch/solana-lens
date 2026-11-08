import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { analyzeTransaction } from "../src/analyzer.js";
import { evaluatePolicies } from "../src/policy.js";
import { analyzeSimulation } from "../src/simulation.js";

const fixture = JSON.parse(await readFile(new URL("../public/sample-transaction.json", import.meta.url), "utf8"));

test("summarizes a successful system transfer", () => {
  const result = analyzeTransaction(fixture, { network: "devnet", signature: "demo" });
  assert.equal(result.status, "succeeded");
  assert.equal(result.fee, 0.000005);
  assert.equal(result.instructionCount, 1);
  assert.equal(result.transfers.length, 1);
  assert.equal(result.transfers[0].amount, 0.25);
  assert.equal(result.flags[0].level, "safe");
  assert.equal(result.policy.decision, "safe");
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

test("blocks a report that violates outflow and write-access policies", () => {
  const policy = evaluatePolicies({
    status: "succeeded",
    changes: [{ account: "sender", change: -2.5 }],
    unknownProgramCount: 0,
    writableAccounts: 14,
  }, { maxSolOutflow: 1, maxWritableAccounts: 10 });
  assert.equal(policy.decision, "blocked");
  assert.ok(policy.rules.some((rule) => rule.id === "outflow" && !rule.passed));
  assert.ok(policy.rules.some((rule) => rule.id === "writable" && !rule.passed));
});

test("summarizes an unsigned simulation without claiming broadcast", () => {
  const report = analyzeSimulation({
    err: null,
    logs: [
      "Program TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb invoke [1]",
      "Program TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb success",
    ],
    unitsConsumed: 1714,
    innerInstructions: [],
  }, { network: "devnet" });
  assert.equal(report.mode, "simulation");
  assert.equal(report.status, "succeeded");
  assert.match(report.summary, /not broadcast/);
  assert.equal(report.policy.decision, "safe");
});
