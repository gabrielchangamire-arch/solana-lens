import test from "node:test";
import assert from "node:assert/strict";
import { inspectWithRust } from "../src/rust-inspector.js";

const officialSample = "AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAEEjNmKiZGiOtSZ+g0//wH5kEQo3+UzictY+KlLV8hjXcs44M/Xnr+1SlZsqS6cFMQc46yj9PIsxqkycxJmXT+veJjIvefX4nhY9rY+B5qreeqTHu4mG6Xtxr5udn4MN8PnBt324e51j94YQl285GzN2rYa/E2DuQ0n/r35KNihi/zamQ6EeyeeVDvPVgUO2W3Lgt9hT+CfyqHvIa11egFPCgEDAwIBAAkDZAAAAAAAAAA=";

test("Rust inspector extracts the unsigned wire structure", async () => {
  const report = await inspectWithRust(officialSample);
  assert.equal(report.available, true);
  assert.equal(report.engine, "rust-wire-decoder");
  assert.equal(report.transactionVersion, "legacy");
  assert.equal(report.instructionCount, 1);
  assert.equal(report.staticAccountCount, 4);
  assert.equal(report.writableAccountCount, 3);
  assert.deepEqual(report.programIds, ["TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"]);
});
