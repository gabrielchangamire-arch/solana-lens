import { analyzeTransaction, helpers } from "/src/analyzer.js";

const rpcUrls = {
  devnet: "https://api.devnet.solana.com",
  "mainnet-beta": "https://api.mainnet-beta.solana.com",
};
const systemProgram = "11111111111111111111111111111111";
const officialSimulationSample = "AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAEEjNmKiZGiOtSZ+g0//wH5kEQo3+UzictY+KlLV8hjXcs44M/Xnr+1SlZsqS6cFMQc46yj9PIsxqkycxJmXT+veJjIvefX4nhY9rY+B5qreeqTHu4mG6Xtxr5udn4MN8PnBt324e51j94YQl285GzN2rYa/E2DuQ0n/r35KNihi/zamQ6EeyeeVDvPVgUO2W3Lgt9hT+CfyqHvIa11egFPCgEDAwIBAAkDZAAAAAAAAAA=";

const form = document.querySelector("#analyzer-form");
const signatureInput = document.querySelector("#signature");
const networkInput = document.querySelector("#network");
const status = document.querySelector("#status");
const results = document.querySelector("#results");
let currentReport = null;

async function rpc(network, method, params) {
  const response = await fetch(rpcUrls[network], {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!response.ok) throw new Error(`RPC returned HTTP ${response.status}.`);
  const payload = await response.json();
  if (payload.error) throw new Error(payload.error.message || "Solana RPC rejected the request.");
  return payload.result;
}

async function postJson(path, body) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || `Request failed with HTTP ${response.status}.`);
  return payload;
}

function policies() {
  return {
    maxSolOutflow: document.querySelector("#max-outflow").value,
    maxWritableAccounts: document.querySelector("#max-writable").value,
    blockUnknownPrograms: document.querySelector("#block-unknown").checked,
    blockFailed: true,
  };
}

function setBusy(message) {
  status.textContent = message;
  document.querySelector("#analyze-button").disabled = true;
}

function setReady(message) {
  status.textContent = message;
  document.querySelector("#analyze-button").disabled = false;
}

function decisionClass(decision) {
  return decision === "blocked" ? "blocked" : decision === "attention" ? "attention" : "safe";
}

function render(report) {
  currentReport = report;
  results.classList.remove("hidden");
  const decision = document.querySelector("#policy-decision");
  decision.textContent = report.policy.label;
  decision.className = `decision-badge ${decisionClass(report.policy.decision)}`;
  const badge = document.querySelector("#result-status");
  badge.textContent = report.status;
  badge.classList.toggle("failed", report.status === "failed");
  document.querySelector("#result-mode").textContent = report.mode === "simulation" ? "Pre-sign simulation" : "Confirmed transaction";
  document.querySelector("#result-network").textContent = report.network;
  document.querySelector("#result-summary").textContent = report.summary;
  document.querySelector("#metric-fee").textContent = report.fee === null ? "Not broadcast" : `${report.fee} SOL`;
  document.querySelector("#metric-instructions").textContent = report.instructionCount;
  document.querySelector("#metric-programs").textContent = report.programs.length;
  document.querySelector("#metric-writable").textContent = report.writableAccounts;

  document.querySelector("#flags").replaceChildren(...report.flags.map((flag) => {
    const node = document.createElement("div");
    node.className = `flag ${flag.level}`;
    node.innerHTML = `<strong></strong><span></span>`;
    node.querySelector("strong").textContent = flag.title;
    node.querySelector("span").textContent = flag.detail;
    return node;
  }));

  document.querySelector("#programs").replaceChildren(...report.programs.map((program) => {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent = program;
    return chip;
  }));

  document.querySelector("#policy-rules").replaceChildren(...report.policy.rules.map((rule) => {
    const node = document.createElement("div");
    node.className = `policy-rule ${rule.passed ? "passed" : rule.blocking ? "blocked" : "attention"}`;
    node.innerHTML = `<span class="rule-icon"></span><div><strong></strong><p></p></div>`;
    node.querySelector(".rule-icon").textContent = rule.passed ? "✓" : rule.blocking ? "×" : "!";
    node.querySelector("strong").textContent = rule.title;
    node.querySelector("p").textContent = rule.detail;
    return node;
  }));

  const changeNodes = report.changes.slice(0, 8).map((change) => {
    const node = document.createElement("div");
    node.className = "change";
    node.innerHTML = `<code></code><strong></strong>`;
    node.querySelector("code").textContent = helpers.shorten(change.account, 8, 6);
    const amount = node.querySelector("strong");
    amount.textContent = `${change.change > 0 ? "+" : ""}${change.change} SOL`;
    amount.className = change.change > 0 ? "positive" : "negative";
    return node;
  });
  if (!changeNodes.length) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = report.mode === "simulation" ? "This RPC simulation did not request post-simulation account snapshots." : "No material SOL balance change was detected.";
    changeNodes.push(empty);
  }
  document.querySelector("#changes").replaceChildren(...changeNodes);
  document.querySelector("#ai-explanation").textContent = "The deterministic decision above is final. Generate a grounded explanation only if a model credential is configured.";
  document.querySelector("#ai-status").textContent = "";
  results.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function analyze(signature, network) {
  setBusy("Fetching a parsed transaction from Solana RPC…");
  const transaction = await rpc(network, "getTransaction", [signature, {
    encoding: "jsonParsed",
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0,
  }]);
  if (!transaction) throw new Error("Transaction not found. Check the network and confirmation status.");
  render(analyzeTransaction(transaction, { network, signature, policies: policies() }));
  setReady("Analysis complete. The policy decision is based on visible deterministic evidence.");
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const signature = signatureInput.value.trim();
  if (!signature) {
    setReady("Paste a transaction signature first.");
    signatureInput.focus();
    return;
  }
  try { await analyze(signature, networkInput.value); } catch (error) { setReady(error.message); }
});

document.querySelector("#latest-button").addEventListener("click", async () => {
  networkInput.value = "devnet";
  try {
    setBusy("Finding a recent confirmed Devnet transaction…");
    const signatures = await rpc("devnet", "getSignaturesForAddress", [systemProgram, { limit: 12 }]);
    const candidate = signatures.find((entry) => !entry.err)?.signature;
    if (!candidate) throw new Error("No recent successful Devnet transaction was available.");
    signatureInput.value = candidate;
    await analyze(candidate, "devnet");
  } catch (error) { setReady(error.message); }
});

async function loadDemo(path, signature, message) {
  setBusy(message);
  const response = await fetch(path);
  const transaction = await response.json();
  signatureInput.value = signature;
  networkInput.value = "devnet";
  render(analyzeTransaction(transaction, { network: "devnet", signature, policies: policies() }));
  setReady("Offline demonstration loaded. No network request was required.");
}

document.querySelector("#sample-button").addEventListener("click", async () => {
  try { await loadDemo("/public/sample-transaction.json", "offline-safe-demo", "Loading the safe demonstration…"); } catch (error) { setReady(error.message); }
});

document.querySelector("#risky-button").addEventListener("click", async () => {
  try { await loadDemo("/public/risky-transaction.json", "offline-risky-demo", "Loading the risky demonstration…"); } catch (error) { setReady(error.message); }
});

document.querySelector("#load-simulation-button").addEventListener("click", () => {
  document.querySelector("#serialized-transaction").value = officialSimulationSample;
  document.querySelector("#simulation-status").textContent = "Official unsigned Solana RPC sample loaded. It will be simulated, never broadcast.";
});

document.querySelector("#simulate-button").addEventListener("click", async () => {
  const simulationStatus = document.querySelector("#simulation-status");
  try {
    simulationStatus.textContent = "Calling Solana simulateTransaction without a signature…";
    const report = await postJson("/api/simulate", {
      serializedTransaction: document.querySelector("#serialized-transaction").value,
      network: networkInput.value,
      policies: policies(),
    });
    render(report);
    simulationStatus.textContent = "Simulation complete. The transaction was not broadcast and no wallet was connected.";
  } catch (error) { simulationStatus.textContent = error.message; }
});

document.querySelector("#ai-button").addEventListener("click", async () => {
  const aiStatus = document.querySelector("#ai-status");
  if (!currentReport) return;
  try {
    aiStatus.textContent = "Generating an explanation grounded in the deterministic report…";
    const result = await postJson("/api/explain", { report: currentReport });
    if (!result.available) {
      aiStatus.textContent = "AI is not configured. Set OPENAI_API_KEY on the server; the deterministic analyzer remains fully functional.";
      return;
    }
    document.querySelector("#ai-explanation").textContent = result.explanation;
    aiStatus.textContent = "Grounded explanation ready. The policy decision was not changed.";
  } catch (error) { aiStatus.textContent = error.message; }
});
