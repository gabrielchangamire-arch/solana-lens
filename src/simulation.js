import { evaluatePolicies } from "./policy.js";

const KNOWN_PROGRAMS = new Map([
  ["11111111111111111111111111111111", "System Program"],
  ["ComputeBudget111111111111111111111111111111", "Compute Budget"],
  ["TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", "SPL Token"],
  ["TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb", "Token-2022"],
  ["ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL", "Associated Token"],
  ["MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr", "Memo"],
  ["Vote111111111111111111111111111111111111111", "Vote Program"],
  ["Stake11111111111111111111111111111111111111", "Stake Program"],
]);

function invokedPrograms(logs = []) {
  const ids = logs.flatMap((line) => {
    const match = /^Program ([1-9A-HJ-NP-Za-km-z]+) invoke/.exec(line);
    return match ? [match[1]] : [];
  });
  return [...new Set(ids)];
}

export function analyzeSimulation(value, { network = "devnet", policies = {}, inspection = null } = {}) {
  if (!value || !Array.isArray(value.logs)) {
    throw new Error("The RPC response does not contain simulation logs.");
  }
  const programIds = [...new Set([
    ...invokedPrograms(value.logs),
    ...(inspection?.available ? inspection.programIds || [] : []),
  ])];
  const unknownProgramIds = programIds.filter((id) => !KNOWN_PROGRAMS.has(id));
  const failed = value.err !== null;
  const report = {
    mode: "simulation",
    network,
    status: failed ? "failed" : "succeeded",
    fee: null,
    summary: `This unsigned ${network} transaction ${failed ? "failed" : "completed"} pre-sign simulation, invoked ${programIds.length} program${programIds.length === 1 ? "" : "s"}, and consumed ${Number(value.unitsConsumed || 0).toLocaleString()} compute units. It was not broadcast and no signature was created.`,
    programs: programIds.map((id) => KNOWN_PROGRAMS.get(id) || `${id.slice(0, 7)}…${id.slice(-5)}`),
    programIds,
    unknownProgramIds,
    unknownProgramCount: unknownProgramIds.length,
    transfers: [],
    changes: [],
    flags: [],
    instructionCount: inspection?.available ? inspection.instructionCount : value.innerInstructions?.length || 0,
    writableAccounts: inspection?.available ? inspection.writableAccountCount : 0,
    unitsConsumed: Number(value.unitsConsumed || 0),
    logs: value.logs,
    error: value.err,
    inspection,
  };

  if (failed) report.flags.push({ level: "danger", title: "Simulation failed", detail: JSON.stringify(value.err) });
  if (unknownProgramIds.length) report.flags.push({ level: "warning", title: `${unknownProgramIds.length} unfamiliar program${unknownProgramIds.length === 1 ? "" : "s"}`, detail: "Verify each unfamiliar program ID before signing." });
  if (!report.flags.length) report.flags.push({ level: "safe", title: "No obvious simulation warning", detail: "The configured policies still determine the final decision." });
  report.policy = evaluatePolicies(report, policies);
  return report;
}

export const simulationHelpers = { invokedPrograms };
