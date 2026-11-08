# Solana Lens

**A pre-sign firewall that simulates, enforces, and explains Solana transactions before a user approves them.**

Solana Lens combines a Rust wire-format inspector, live Solana RPC simulation, and deterministic, user-configurable safety policies. It can also inspect confirmed transactions and optionally translate the verified report into simpler language with a grounded model explanation. The model never makes or overrides the safety decision.

## Why it matters

Wallet confirmation screens often expose technical details without answering the questions a user actually has:

- Will this transaction execute?
- How much SOL can leave my account?
- Which programs and writable accounts are involved?
- Does the request violate a limit I set?

Solana Lens answers those questions without requesting a seed phrase, private key, signature, or wallet approval.

## What is working

- **Real pre-sign simulation:** accepts an unsigned base64 transaction and calls Solana `simulateTransaction` with signature verification disabled and recent-blockhash replacement enabled.
- **Rust transaction inspection:** decodes legacy and v0 wire structure to recover exact static-account, writable-account, instruction, program, signature, and lookup-table counts before the RPC call.
- **Never broadcasts:** simulation produces no signature and never submits the transaction.
- **Deterministic policy engine:** blocks failed execution, excessive SOL outflow, unfamiliar programs, or excessive writable-account access according to visible limits.
- **Confirmed-transaction inspection:** reads parsed Devnet or Mainnet transactions through Solana JSON-RPC.
- **Transparent evidence:** shows fees, programs, instructions, writable accounts, transfers, balance changes, compute units, and the reason for every policy result.
- **Grounded explanation layer:** when a server-side model credential is configured, it restates only the deterministic report and cannot change its decision.
- **Reliable judging path:** safe and risky offline fixtures demonstrate both allow and block outcomes even if public RPC is unavailable.
- **Automated tests:** covers confirmed analysis, failure handling, policy enforcement, simulation parsing, and the no-credential AI fallback.
- **Operational safeguards:** adds readiness and liveness probes, Prometheus metrics, structured request logs, request IDs, upstream deadlines and retries, API rate limits, bounded simulation concurrency, security headers, graceful shutdown, Docker health checks, and a non-root runtime.

## Run locally

Requires Node.js 20 or newer.

```bash
npm run build:rust
npm run test:all
npm run dev
```

Open <http://localhost:4173>.

For a presentation-ready launch on macOS:

```bash
./run-demo.sh
```

The exact speaking flow is in [DEMO_GUIDE.md](./DEMO_GUIDE.md). Ready-to-edit entry text is in [SUBMISSION_COPY.md](./SUBMISSION_COPY.md).

## Optional grounded explanation

The transaction analyzer and policy engine work without any model credential. To enable the optional explanation button, copy the environment template and add a server-side key:

```bash
cp .env.example .env
set -a && source .env && set +a
npm run dev
```

The server uses the Responses API. The report sent to the model contains the deterministic evidence and policy result; the browser never receives the credential.

## Demo in 90 seconds

1. Click **Risky demo** and show that a technically successful transaction is still **Blocked by policy** because it violates the user's limits.
2. Click **Safe demo** and show the same policy producing **Safe to review** with every rule explained.
3. Under **Simulate before signing**, click **Load official Devnet sample**, then **Simulate without signing**.
4. Point out the real RPC result, compute units, recognized program, and the explicit “not broadcast” state.
5. Explain that AI may simplify the verified report, but only the deterministic policy decides.

## Architecture

```text
unsigned transaction
        |
        v
Rust wire inspector
        |
        v
Solana simulateTransaction RPC
        |
        v
deterministic evidence report
        |
        +--> policy engine --> safe / attention / blocked
        |
        +--> optional grounded explanation
```

Key modules:

- `src/simulation.js` parses simulation logs and compute usage.
- `rust/transaction-inspector` decodes transaction wire metadata without signing or broadcasting.
- `src/analyzer.js` interprets confirmed parsed transactions.
- `src/policy.js` normalizes user limits and produces the final decision.
- `src/ai.js` generates an optional evidence-bound explanation.
- `server.mjs` keeps RPC and model calls server-side and serves the browser app.

## API routes

- `GET /api/health` — service status and whether the explanation layer is configured.
- `GET /api/ready` — deployment readiness and Rust-decoder availability.
- `GET /api/metrics` — Prometheus-format request, error, latency, and simulation counters.
- `POST /api/simulate` — simulate an unsigned base64 transaction without broadcasting.
- `POST /api/analyze` — apply the reusable analyzer to a parsed RPC response.
- `POST /api/explain` — explain a completed deterministic report without changing it.

## Safety boundaries

- No seed phrase, private key, signing request, or wallet connection.
- No transaction broadcast endpoint.
- Model credentials stay on the server.
- Unknown programs are labeled for verification, not declared malicious.
- “Safe to review” means the configured checks passed; it is not a guarantee.

## Reliability design

- Every response includes a request ID and strict browser security headers.
- Solana RPC calls have an eight-second deadline and one bounded retry for transient failures.
- API and simulation-specific limits reduce accidental abuse; concurrent simulations are capped.
- JSON request logs omit transaction payloads, credentials, and private data.
- Render uses `/api/ready` for zero-downtime health gating and gives the process time to shut down cleanly.
- The production image builds Rust separately and runs the final Node service as a non-root user.

## Next product steps

- Add v1 decoding to the Rust inspector and resolve lookup-table account addresses for exact balance-impact previews.
- Resolve program identities from a maintained, verified registry.
- Package the analyzer and policy engine as a wallet-adapter component.
- Add saved policy profiles for consumers, teams, and treasury operators.

## References

- [Solana `simulateTransaction` RPC](https://solana.com/docs/rpc/http/simulatetransaction)
- [OpenAI Responses API](https://developers.openai.com/api/docs/guides/text)

## Disclaimer

Solana Lens is educational software. A clean result is not a guarantee that a transaction is safe.
