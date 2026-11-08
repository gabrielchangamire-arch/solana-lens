# Solana Lens

Solana Lens turns a Solana transaction into a plain-English explanation with deterministic safety signals. It reads public RPC data only; it never asks for a seed phrase, private key, or wallet approval.

## Why it matters

Wallet confirmation screens can be hard to understand. Solana Lens shows the programs invoked, transaction fee, writable-account count, SOL balance changes, and warning signals before a user repeats or trusts a similar transaction.

## Run it

```bash
npm test
npm run dev
```

Open <http://localhost:4173>. Use **Try safe demo** for a guaranteed offline walkthrough, paste a confirmed signature, or choose **Find a recent Devnet transaction**.

For a presentation-ready launch on macOS, run `./run-demo.sh`. The exact speaking script and fallback path are in [DEMO_GUIDE.md](./DEMO_GUIDE.md), and ready-to-edit submission text is in [SUBMISSION_COPY.md](./SUBMISSION_COPY.md).

## Current MVP

- Reads parsed Devnet or Mainnet transactions through Solana JSON-RPC.
- Generates a deterministic plain-English summary.
- Detects parsed SOL and token transfers.
- Shows fees, program calls, writable accounts, and SOL balance changes.
- Flags failed transactions, unfamiliar programs, broad write access, and large SOL outflows.
- Includes an offline demo so judging does not depend on RPC availability.

## Demo in 60 seconds

1. Open the app and click **Try safe demo**.
2. Read the one-sentence explanation.
3. Point out the fee, instruction, program, and writable-account counters.
4. Show the safety card and SOL balance changes.
5. Explain that the same analyzer can read any confirmed Devnet or Mainnet signature without connecting a wallet.

## Next steps

- Simulate unsigned transactions before wallet confirmation.
- Add wallet connection with an explicit user confirmation boundary.
- Resolve verified program identities from a maintained registry.
- Add an optional AI explanation layer while keeping deterministic safety rules visible.
- Package the analyzer as a wallet-adapter component.

## Safety

This project is educational. A clean result is not a guarantee that a transaction is safe. Never share a wallet seed phrase or private key.
