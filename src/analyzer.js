const LAMPORTS_PER_SOL = 1_000_000_000;

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

function keyString(key) {
  if (typeof key === "string") return key;
  return key?.pubkey || key?.toString?.() || "Unknown account";
}

function programName(instruction) {
  if (instruction?.program) return instruction.program;
  const id = keyString(instruction?.programId);
  return KNOWN_PROGRAMS.get(id) || shorten(id);
}

function shorten(value, left = 5, right = 4) {
  if (!value || value.length <= left + right + 1) return value || "Unknown";
  return `${value.slice(0, left)}…${value.slice(-right)}`;
}

function collectInstructions(transaction) {
  const outer = transaction?.transaction?.message?.instructions || [];
  const inner = transaction?.meta?.innerInstructions?.flatMap((entry) => entry.instructions || []) || [];
  return [...outer, ...inner];
}

function sol(value) {
  return Number((Number(value || 0) / LAMPORTS_PER_SOL).toFixed(6));
}

function accountChanges(transaction) {
  const keys = transaction?.transaction?.message?.accountKeys || [];
  const before = transaction?.meta?.preBalances || [];
  const after = transaction?.meta?.postBalances || [];
  return keys.map((key, index) => ({
    account: keyString(key),
    signer: Boolean(key?.signer),
    writable: Boolean(key?.writable),
    change: sol((after[index] || 0) - (before[index] || 0)),
  })).filter((item) => Math.abs(item.change) > 0.000001);
}

function transferDetails(instruction) {
  const parsed = instruction?.parsed;
  const type = parsed?.type;
  const info = parsed?.info || {};
  if (type === "transfer" && info.lamports !== undefined) {
    return {
      kind: "SOL",
      amount: sol(info.lamports),
      source: info.source,
      destination: info.destination,
    };
  }
  if (["transfer", "transferChecked"].includes(type) && (info.amount !== undefined || info.tokenAmount)) {
    return {
      kind: "token",
      amount: info.tokenAmount?.uiAmountString || info.amount || "unknown",
      source: info.source,
      destination: info.destination,
      mint: info.mint,
    };
  }
  return null;
}

export function analyzeTransaction(transaction, { network = "devnet", signature = "" } = {}) {
  if (!transaction?.transaction?.message || !transaction?.meta) {
    throw new Error("The RPC response does not contain a parsed transaction and metadata.");
  }

  const instructions = collectInstructions(transaction);
  const programs = [...new Set(instructions.map(programName))];
  const transfers = instructions.map(transferDetails).filter(Boolean);
  const changes = accountChanges(transaction);
  const unknownPrograms = instructions
    .map((instruction) => keyString(instruction?.programId))
    .filter((id) => id && id !== "Unknown account" && !KNOWN_PROGRAMS.has(id));
  const writableAccounts = (transaction.transaction.message.accountKeys || [])
    .filter((key) => Boolean(key?.writable)).length;
  const largestLoss = changes.reduce((min, item) => Math.min(min, item.change), 0);
  const failed = transaction.meta.err !== null;

  const flags = [];
  if (failed) flags.push({ level: "danger", title: "Transaction failed", detail: JSON.stringify(transaction.meta.err) });
  if (unknownPrograms.length) flags.push({
    level: "warning",
    title: `${new Set(unknownPrograms).size} unfamiliar program${new Set(unknownPrograms).size === 1 ? "" : "s"}`,
    detail: "Unknown does not mean malicious. Verify each program before signing.",
  });
  if (writableAccounts > 10) flags.push({
    level: "warning",
    title: "Broad write access",
    detail: `${writableAccounts} accounts are writable, which increases the transaction's impact surface.`,
  });
  if (largestLoss < -1) flags.push({
    level: "warning",
    title: "Large SOL outflow",
    detail: `The largest account decrease is ${Math.abs(largestLoss).toFixed(4)} SOL.`,
  });
  if (!flags.length) flags.push({
    level: "safe",
    title: "No obvious warning signals",
    detail: "This is not a guarantee of safety. Always verify destinations and program IDs.",
  });

  const status = failed ? "failed" : "succeeded";
  const fee = sol(transaction.meta.fee);
  const summary = `This ${network} transaction ${status} with ${instructions.length} instruction${instructions.length === 1 ? "" : "s"}, invoked ${programs.length} program${programs.length === 1 ? "" : "s"}, and paid a ${fee} SOL network fee. ${transfers.length ? `It contains ${transfers.length} parsed transfer${transfers.length === 1 ? "" : "s"}.` : "No parsed transfer was detected."}`;

  return {
    signature,
    network,
    status,
    slot: transaction.slot,
    blockTime: transaction.blockTime,
    fee,
    summary,
    programs,
    transfers,
    changes,
    flags,
    instructionCount: instructions.length,
    writableAccounts,
  };
}

export const helpers = { shorten, sol };
