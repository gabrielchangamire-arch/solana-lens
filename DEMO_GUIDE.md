# Solana Lens Demo Guide

## The pitch

> Solana Lens is a pre-sign firewall. It simulates an unsigned transaction on Solana, applies limits the user can see and control, and explains exactly why the transaction is allowed or blocked. It never asks the user to sign and never broadcasts the transaction.

## Five-minute preflight

1. Open Terminal.
2. Run:

   ```bash
   cd path/to/solana-lens
   ./run-demo.sh
   ```

3. Confirm all tests pass.
4. Open `http://localhost:4173` in Chrome.
5. Click **Risky demo**, then **Safe demo**.
6. Click **Load official Devnet sample**, then **Simulate without signing**.
7. Confirm the page says the simulation succeeded and was not broadcast.
8. Refresh once so the judges see a clean starting screen.

## The 90-second demo

### 0:00–0:12 — The problem

Say:

> Wallet confirmations can tell you that a transaction exists without making its impact understandable. Users need to know what will run and whether it violates their own limits before they approve it.

### 0:12–0:32 — The policy is the product

1. Point to **Your safety policy**.
2. Point to the 1 SOL outflow limit, 10 writable-account limit, and unfamiliar-program toggle.
3. Click **Risky demo**.

Say:

> These are visible, deterministic rules. This transaction technically succeeds, but Solana Lens blocks it because it sends more than one SOL, invokes an unfamiliar program, and exposes too many writable accounts.

### 0:32–0:47 — Show the contrast

1. Click **Safe demo**.
2. Point to **Safe to review** and the green policy checks.

Say:

> The same policy allows a small, recognized transfer. Every outcome includes the evidence and the exact reason, so this is not a black-box safety score.

### 0:47–1:12 — Live pre-sign proof

1. Scroll to **Simulate before signing**.
2. Click **Load official Devnet sample**.
3. Click **Simulate without signing**.
4. Point to **Pre-sign simulation**, **Not broadcast**, compute units in the explanation, and **Token-2022**.

Say:

> First, a Rust component decodes the transaction's wire structure and recovers the actual instruction and writable-account counts. Then the app makes a real call to Solana's simulation RPC. Signature verification is disabled, the recent blockhash is replaced for simulation, and the app never broadcasts anything.

### 1:12–1:30 — The differentiator

Say:

> The deterministic policy always makes the decision. An optional grounded model can translate that verified report into simpler language, but it cannot override the rules. The next step is packaging this as a component that wallets and dApps can place directly before their signing screen.

## If the live RPC fails

Do not debug during judging. Say:

> The public RPC is temporarily unavailable, so I will use the built-in deterministic fixtures. They run through the same analyzer and policy engine.

Then use **Risky demo** and **Safe demo**.

## Likely questions

### What did you personally build?

> I built the Node server, the browser interface, the confirmed-transaction analyzer, the simulation parser, the policy engine, the grounded explanation boundary, the offline fixtures, and the automated tests.

### Where is Solana actually used?

> The pre-sign path calls Solana `simulateTransaction` with an unsigned base64 transaction. The confirmed path calls Solana JSON-RPC for parsed Devnet or Mainnet activity and interprets instructions, programs, account permissions, fees, transfers, and balance changes.

### How do you know the transaction was not sent?

> The server only calls the simulation RPC. There is no send or broadcast endpoint, no wallet connection, and the interface never requests a signature or private key.

### Why did you use Rust?

> Rust handles the byte-level transaction boundary. It decodes legacy and v0 wire metadata before the RPC call, so the policy can use the real instruction and writable-account counts. Node remains the orchestration and web layer because replacing working application code would not improve this boundary.

### What did you do for production reliability?

> The service has liveness and readiness probes, Prometheus metrics, structured request logs, request IDs, upstream timeouts and retries, rate limits, bounded simulation concurrency, security headers, graceful shutdown, and a non-root multi-stage Docker build. Those controls are measurable and relevant on managed infrastructure; kernel tuning would not be.

### Why is the decision deterministic instead of AI-generated?

> A safety boundary should be inspectable and testable. The user sees the exact limits and rules. The model is only an accessibility layer for wording and receives the already-computed report.

### Is “Safe to review” a guarantee?

> No. It means the configured checks passed. The interface explicitly preserves that distinction, and unfamiliar programs are marked for verification rather than called malicious.

### What makes this different from a block explorer?

> A block explorer mainly explains what already happened. Solana Lens has a pre-sign path: it simulates an unsigned transaction, checks it against user-defined policies, and can block the review flow before a signature exists.

### What would you build next?

> I would decode the unsigned message so the pre-sign report can show exact writable accounts and balance impact, add a maintained program registry, and ship the engine as a wallet-adapter component.

## Do not do this during the demo

- Do not connect a real wallet.
- Do not enter a seed phrase, private key, or secret.
- Do not call unfamiliar programs malicious without evidence.
- Do not describe the optional model as the decision maker.
- Do not troubleshoot a public RPC failure live.
