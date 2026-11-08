# Submission Copy

## Project name

Solana Lens

## Tagline

Understand a Solana transaction before you trust it.

## Short description

Solana Lens converts a confirmed Solana transaction into a plain-English explanation. It shows fees, invoked programs, writable accounts, parsed transfers, and SOL balance changes, then highlights practical warning signals such as failed execution, unfamiliar programs, broad write access, or large SOL outflows. It reads public Devnet or Mainnet RPC data and never requests a wallet, private key, or seed phrase.

## The problem

Transaction details are difficult for many users to interpret. A signature or wallet confirmation can hide the practical questions a user cares about: What programs ran? Which accounts changed? How much SOL moved? Is anything unusual?

## The solution

Solana Lens fetches parsed transaction data through Solana JSON-RPC and applies a transparent analyzer. The interface explains the result in one sentence, exposes the underlying metrics, and makes each warning understandable. A built-in offline sample keeps the product demonstrable even when a public RPC endpoint is unavailable.

## How Solana is used

- `getTransaction` reads confirmed Devnet or Mainnet activity.
- `getSignaturesForAddress` finds a recent successful Devnet transaction for the live demo.
- Parsed instructions identify transfers and invoked programs.
- Transaction metadata provides execution status, fees, account permissions, and balance changes.

## What is working

- Live Devnet and Mainnet transaction lookup.
- Plain-English deterministic summaries.
- Parsed SOL and token-transfer detection.
- Program, fee, instruction, writable-account, and balance-change views.
- Warning signals for failed transactions, unfamiliar programs, broad write access, and large SOL outflows.
- Offline demonstration and automated analyzer tests.

## Next steps

- Simulate unsigned transactions before wallet confirmation.
- Resolve program identities from a maintained registry.
- Add an optional model-backed explanation layer while keeping deterministic warnings visible.
- Package the analyzer as an embeddable component for wallets and dApps.

## Suggested tracks

- Best Beginner Hack
- Top 3 Overall

