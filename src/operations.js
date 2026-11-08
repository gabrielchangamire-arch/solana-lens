import { randomUUID } from "node:crypto";

export function createRateLimiter({ windowMs = 60_000, max = 60 } = {}) {
  const clients = new Map();
  return {
    check(key, now = Date.now()) {
      const current = clients.get(key);
      if (!current || now >= current.resetAt) {
        clients.set(key, { count: 1, resetAt: now + windowMs });
        return { allowed: true, remaining: max - 1, resetAt: now + windowMs };
      }
      current.count += 1;
      return {
        allowed: current.count <= max,
        remaining: Math.max(0, max - current.count),
        resetAt: current.resetAt,
      };
    },
    prune(now = Date.now()) {
      for (const [key, value] of clients) if (now >= value.resetAt) clients.delete(key);
    },
  };
}

export function createMetrics() {
  const state = { requests: 0, errors: 0, inflight: 0, durationMs: 0, simulations: 0 };
  return {
    begin() {
      state.requests += 1;
      state.inflight += 1;
      const started = performance.now();
      let finished = false;
      return ({ status = 200, simulation = false } = {}) => {
        if (finished) return;
        finished = true;
        state.inflight = Math.max(0, state.inflight - 1);
        state.durationMs += performance.now() - started;
        if (status >= 500) state.errors += 1;
        if (simulation) state.simulations += 1;
      };
    },
    snapshot() { return { ...state }; },
    prometheus() {
      return [
        "# HELP solana_lens_requests_total Total HTTP requests.",
        "# TYPE solana_lens_requests_total counter",
        `solana_lens_requests_total ${state.requests}`,
        "# HELP solana_lens_errors_total Total HTTP 5xx responses.",
        "# TYPE solana_lens_errors_total counter",
        `solana_lens_errors_total ${state.errors}`,
        "# HELP solana_lens_inflight_requests Current in-flight requests.",
        "# TYPE solana_lens_inflight_requests gauge",
        `solana_lens_inflight_requests ${state.inflight}`,
        "# HELP solana_lens_request_duration_ms_sum Cumulative request latency.",
        "# TYPE solana_lens_request_duration_ms_sum counter",
        `solana_lens_request_duration_ms_sum ${state.durationMs.toFixed(3)}`,
        "# HELP solana_lens_simulations_total Successful simulation responses.",
        "# TYPE solana_lens_simulations_total counter",
        `solana_lens_simulations_total ${state.simulations}`,
        "",
      ].join("\n");
    },
  };
}

export function requestContext(request) {
  return {
    id: request.headers["x-request-id"]?.slice(0, 80) || randomUUID(),
    ip: String(request.headers["x-forwarded-for"] || request.socket.remoteAddress || "unknown").split(",")[0].trim(),
    startedAt: performance.now(),
  };
}

export function logRequest({ requestId, method, path, status, durationMs }) {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: status >= 500 ? "error" : "info",
    event: "http_request",
    requestId,
    method,
    path,
    status,
    durationMs: Number(durationMs.toFixed(2)),
  }));
}

export async function fetchWithDeadline(url, options, { timeoutMs = 8_000, attempts = 2 } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, { ...options, signal: AbortSignal.timeout(timeoutMs) });
      if ((response.status === 429 || response.status >= 500) && attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, 150 * attempt));
        continue;
      }
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, 150 * attempt));
    }
  }
  throw lastError || new Error("Upstream request failed.");
}

export const securityHeaders = {
  "content-security-policy": "default-src 'self'; connect-src 'self' https://api.devnet.solana.com https://api.mainnet-beta.solana.com; img-src 'self' data:; style-src 'self'; script-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
};
