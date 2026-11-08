# Submission Copy

## Project name

Solana Lens

## Tagline

The pre-sign firewall for Solana transactions.

## Short description

Solana Lens simulates an unsigned Solana transaction before a user signs it, applies visible safety limits, and explains exactly why it is safe to review or blocked. It never requests a private key, never asks the user to sign, and never broadcasts the transaction.

## The problem

Wallet confirmations expose technical fields but often fail to make practical risk understandable. A user needs to know whether a transaction will execute, which programs and accounts it can affect, how much SOL can leave, and whether it violates limits the user chose.

## The solution

Solana Lens turns the signing boundary into an inspectable safety workflow:

1. **Simulate:** call Solana's real `simulateTransaction` RPC on an unsigned serialized transaction.
2. **Enforce:** apply deterministic limits for execution failure, SOL outflow, unfamiliar programs, and writable-account access.
3. **Explain:** show the evidence and reason for every rule. An optional grounded model can simplify the wording but cannot change the decision.

The app also inspects confirmed Devnet or Mainnet signatures and includes safe and risky offline fixtures so the full policy flow remains demonstrable if a public RPC is unavailable.

## How Solana is used

- `simulateTransaction` previews an unsigned transaction without broadcasting it.
- `getTransaction` reads confirmed Devnet or Mainnet activity.
- `getSignaturesForAddress` finds a recent successful Devnet transaction for a live demonstration.
- Simulation logs reveal invoked programs and compute usage.
- Parsed transaction metadata provides execution status, fees, account permissions, transfers, and balance changes.

## What is working

- Real unsigned pre-sign simulation.
- No signing, wallet connection, or broadcast path.
- Configurable deterministic policy engine.
- Safe, attention, and blocked decisions with per-rule evidence.
- Confirmed Devnet and Mainnet transaction inspection.
- Fee, instruction, program, writable-account, transfer, compute, and balance-change views.
- Optional model-backed explanation constrained to the verified deterministic report.
- Safe and risky offline demo fixtures.
- Six automated tests covering analysis, policy, simulation, and AI fallback behavior.

## Why it is different

Solana Lens is not only a post-transaction explorer. Its strongest path happens before a signature exists. The policy engine is transparent rather than a black-box score, and the optional model is deliberately prevented from making the safety decision.

## Built by

Gabriel Changamire — solo project.

## Suggested categories

- Top 3 Overall
- Best Beginner Hack, if the event's eligibility definition applies
- AI category only when the live deployment has a configured and tested model credential

## One-line judge takeaway

> Solana Lens moves transaction understanding from after-the-fact exploration to a pre-sign, user-controlled safety boundary.
