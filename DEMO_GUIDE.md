# Solana Lens Demo Guide

## The one-sentence pitch

Solana Lens turns a public Solana transaction into a readable explanation and highlights warning signals without asking for a wallet, private key, or seed phrase.

## What to submit it for

- Best Beginner Hack: the strongest current fit.
- Top 3 Overall: every eligible project is entered automatically.
- AI Track only after adding a real model-backed explanation layer. The current safety analysis is deterministic, not AI-generated.

## Deadline and submission status

- The event schedule lists the final project deadline as Sunday, November 8 at 8:45 AM Pacific.
- The MLH Challenges portal displays a later close time of 10:00 AM Pacific. Treat 8:45 AM as the safe deadline.
- The submission form requires Gabriel to sign in to MLH Challenges before its exact fields can be inspected or completed.
- Do not wait until the last few minutes: create the project entry first, then improve its links and description before the cutoff.

## Submission checklist

- Project name: Solana Lens.
- Short description: use `SUBMISSION_COPY.md`.
- Working code in a dedicated public repository.
- README with setup and demo instructions.
- Screenshot or short demonstration video.
- Honest prize selection: Best Beginner Hack; overall entry is automatic.
- Verify that no secret, API key, wallet private key, seed phrase, or private link is present.
- Open every submitted link in a private/incognito window before final submission.

## Five-minute preflight

1. Open Terminal.
2. Run:

   ```bash
   cd /Users/gabriel/Documents/GC/MLH-Solana/hackathon/solana-lens
   ./run-demo.sh
   ```

3. Wait for all three tests to pass.
4. Chrome should open `http://localhost:4173` automatically.
5. Click **Try safe demo** once and confirm that the result appears.
6. Refresh the page so the judges see the clean starting screen.
7. Keep this guide open on another screen or device.

## The safest 90-second demo

### 0:00–0:15 — Problem

Say:

> Solana transactions are fast and inexpensive, but the confirmation details can be difficult for a normal user to understand. Solana Lens makes a transaction readable before someone trusts or repeats similar activity.

### 0:15–0:30 — Product

Point to the signature field and say:

> A user can paste any confirmed Devnet or Mainnet transaction signature. The app reads public RPC data only. It never asks for a wallet, private key, or seed phrase.

### 0:30–0:55 — Guaranteed demonstration

1. Click **Try safe demo**.
2. Point to the plain-English explanation.
3. Point to the four counters: fee, instructions, programs, and writable accounts.
4. Point to **Safety signals** and the two SOL balance changes.

Say:

> This sample is a successful SOL transfer. The app explains the fee, the invoked program, the accounts that can be changed, and the actual balance movement. It also applies visible deterministic rules, so the user can see why a warning appears.

### 0:55–1:15 — Live Solana proof

1. Click **Find a recent Devnet transaction**.
2. Wait for the result.
3. Point to the real signature and the programs invoked.

Say:

> This is a live confirmed Devnet transaction fetched through Solana JSON-RPC. Solana is doing real work here: the result comes from on-chain transaction data rather than a mock backend.

If the RPC request fails, do not troubleshoot during the presentation. Say:

> The public RPC is temporarily unavailable, which is why the offline path is included. The same analyzer code processes both results.

Then click **Try safe demo** and continue.

### 1:15–1:30 — Finish

Say:

> The next step is to simulate unsigned transactions before wallet confirmation and add verified program identities. The goal is a clear safety layer between a transaction request and a user's signature.

## Three-minute version

Use the same flow, then add:

> The analyzer combines outer and inner instructions, calculates fee and SOL balance changes, counts writable accounts, recognizes common Solana programs, and flags failures, unfamiliar programs, broad write access, or large SOL outflows. The analysis is intentionally deterministic so every warning can be explained.

Show one warning from the live Devnet result if one appears. Explain that “unfamiliar” does not automatically mean malicious; it means the user should verify the program ID.

## Likely questions

### How did you build it?

> I used a small Node server and a browser client. The client calls Solana JSON-RPC with `getTransaction` using parsed encoding. A reusable analyzer reads the instructions and metadata, calculates the important values, and turns them into a report for the interface.

### Where is Solana used?

> Solana is the data source and execution network. The app reads confirmed Devnet or Mainnet transactions through Solana JSON-RPC and interprets their instructions, programs, accounts, fees, and balance changes.

### Is this really a safety guarantee?

> No. It is an educational risk screen. A clean result is not a guarantee. The interface says that explicitly, and unfamiliar programs are presented as something to verify rather than automatically malicious.

### Why no wallet connection?

> The first version is read-only by design. That reduces risk, makes the demo reliable, and proves the transaction-analysis layer before introducing wallet permissions or signing.

### Where is the AI?

> The current working version uses deterministic analysis so its warnings are explainable and testable. A model-backed explanation layer is a planned enhancement, but I would not claim the AI track until that layer is implemented and doing real work.

### What would you build next?

> I would accept an unsigned transaction, simulate it before wallet confirmation, resolve verified program identities, and package the analyzer so wallets and dApps can embed the safety report.

## Never do this during the demo

- Do not enter a seed phrase or private key.
- Do not connect a wallet just to make the demo look more advanced.
- Do not start by testing an unknown Mainnet transaction.
- Do not spend presentation time debugging a public RPC failure.
- Do not describe an unfamiliar program as malicious without evidence.

