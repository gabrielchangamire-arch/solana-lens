const DEFAULT_POLICIES = Object.freeze({
  maxSolOutflow: 1,
  maxWritableAccounts: 10,
  blockFailed: true,
  blockUnknownPrograms: true,
});

function numberOr(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export function normalizePolicies(policies = {}) {
  return {
    maxSolOutflow: numberOr(policies.maxSolOutflow, DEFAULT_POLICIES.maxSolOutflow),
    maxWritableAccounts: numberOr(policies.maxWritableAccounts, DEFAULT_POLICIES.maxWritableAccounts),
    blockFailed: policies.blockFailed !== false,
    blockUnknownPrograms: policies.blockUnknownPrograms !== false,
  };
}

export function evaluatePolicies(report, rawPolicies = {}) {
  const policies = normalizePolicies(rawPolicies);
  const largestOutflow = Math.abs(Math.min(0, ...(report.changes || []).map((item) => Number(item.change || 0))));
  const unknownCount = Number(report.unknownProgramCount || 0);
  const writableAccounts = Number(report.writableAccounts || 0);
  const rules = [
    {
      id: "execution",
      passed: report.status !== "failed",
      blocking: policies.blockFailed,
      title: report.status === "failed" ? "Simulation or transaction failed" : "Execution succeeded",
      detail: report.status === "failed" ? "A failed transaction is blocked by the current policy." : "No execution error was reported.",
    },
    {
      id: "outflow",
      passed: largestOutflow <= policies.maxSolOutflow,
      blocking: true,
      title: largestOutflow <= policies.maxSolOutflow ? "SOL outflow is within policy" : "SOL outflow exceeds policy",
      detail: `${largestOutflow.toFixed(6)} SOL observed; policy maximum is ${policies.maxSolOutflow.toFixed(6)} SOL.`,
    },
    {
      id: "programs",
      passed: unknownCount === 0,
      blocking: policies.blockUnknownPrograms,
      title: unknownCount === 0 ? "Programs are recognized" : `${unknownCount} unfamiliar program${unknownCount === 1 ? "" : "s"}`,
      detail: unknownCount === 0 ? "Every invoked program is in the local verified registry." : "Unfamiliar does not mean malicious, but this policy requires manual verification.",
    },
    {
      id: "writable",
      passed: writableAccounts <= policies.maxWritableAccounts,
      blocking: true,
      title: writableAccounts <= policies.maxWritableAccounts ? "Write access is within policy" : "Write access exceeds policy",
      detail: `${writableAccounts} writable account${writableAccounts === 1 ? "" : "s"}; policy maximum is ${policies.maxWritableAccounts}.`,
    },
  ];

  const blockingFailures = rules.filter((rule) => !rule.passed && rule.blocking);
  const advisoryFailures = rules.filter((rule) => !rule.passed && !rule.blocking);
  const decision = blockingFailures.length ? "blocked" : advisoryFailures.length ? "attention" : "safe";
  return {
    decision,
    label: decision === "blocked" ? "Blocked by policy" : decision === "attention" ? "Needs attention" : "Safe to review",
    policies,
    largestOutflow: Number(largestOutflow.toFixed(6)),
    rules,
  };
}

export { DEFAULT_POLICIES };
