import test from "node:test";
import assert from "node:assert/strict";
import { createMetrics, createRateLimiter, securityHeaders } from "../src/operations.js";

test("rate limiter resets after its fixed window", () => {
  const limiter = createRateLimiter({ windowMs: 1_000, max: 2 });
  assert.equal(limiter.check("client", 0).allowed, true);
  assert.equal(limiter.check("client", 1).allowed, true);
  assert.equal(limiter.check("client", 2).allowed, false);
  assert.equal(limiter.check("client", 1_000).allowed, true);
});

test("metrics track requests, failures, latency, and simulations", () => {
  const metrics = createMetrics();
  const finish = metrics.begin();
  finish({ status: 503, simulation: true });
  const snapshot = metrics.snapshot();
  assert.equal(snapshot.requests, 1);
  assert.equal(snapshot.errors, 1);
  assert.equal(snapshot.inflight, 0);
  assert.equal(snapshot.simulations, 1);
  assert.match(metrics.prometheus(), /solana_lens_requests_total 1/);
});

test("security headers block framing and browser capabilities", () => {
  assert.equal(securityHeaders["x-frame-options"], "DENY");
  assert.match(securityHeaders["permissions-policy"], /camera=\(\)/);
  assert.match(securityHeaders["content-security-policy"], /frame-ancestors 'none'/);
});
