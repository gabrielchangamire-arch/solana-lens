import { analyzeTransaction, helpers } from "/src/analyzer.js";

const rpcUrls = {
  devnet: "https://api.devnet.solana.com",
  "mainnet-beta": "https://api.mainnet-beta.solana.com",
};
const systemProgram = "11111111111111111111111111111111";

const form = document.querySelector("#analyzer-form");
const signatureInput = document.querySelector("#signature");
const networkInput = document.querySelector("#network");
const status = document.querySelector("#status");
const results = document.querySelector("#results");

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

function setBusy(message) {
  status.textContent = message;
  document.querySelector("#analyze-button").disabled = true;
}

function setReady(message) {
  status.textContent = message;
  document.querySelector("#analyze-button").disabled = false;
}

function render(report) {
  results.classList.remove("hidden");
  const badge = document.querySelector("#result-status");
  badge.textContent = report.status;
  badge.classList.toggle("failed", report.status === "failed");
  document.querySelector("#result-network").textContent = report.network;
  document.querySelector("#result-summary").textContent = report.summary;
  document.querySelector("#metric-fee").textContent = `${report.fee} SOL`;
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
    empty.textContent = "No material SOL balance change was detected.";
    changeNodes.push(empty);
  }
  document.querySelector("#changes").replaceChildren(...changeNodes);
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
  render(analyzeTransaction(transaction, { network, signature }));
  setReady("Analysis complete. Verify unknown programs before signing similar transactions.");
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const signature = signatureInput.value.trim();
  if (!signature) {
    setReady("Paste a transaction signature first.");
    signatureInput.focus();
    return;
  }
  try {
    await analyze(signature, networkInput.value);
  } catch (error) {
    setReady(error.message);
  }
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
  } catch (error) {
    setReady(error.message);
  }
});

document.querySelector("#sample-button").addEventListener("click", async () => {
  try {
    setBusy("Loading the offline demonstration…");
    const response = await fetch("/public/sample-transaction.json");
    const transaction = await response.json();
    signatureInput.value = "offline-demo-transaction";
    networkInput.value = "devnet";
    render(analyzeTransaction(transaction, { network: "devnet", signature: "offline-demo-transaction" }));
    setReady("Offline demo loaded. No network request was required.");
  } catch (error) {
    setReady(error.message);
  }
});
