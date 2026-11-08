import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeTransaction } from "./src/analyzer.js";
import { explainWithModel } from "./src/ai.js";
import {
  createMetrics,
  createRateLimiter,
  fetchWithDeadline,
  logRequest,
  requestContext,
  securityHeaders,
} from "./src/operations.js";
import { findRustInspector, inspectWithRust } from "./src/rust-inspector.js";
import { analyzeSimulation } from "./src/simulation.js";

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 4173);
const metrics = createMetrics();
const apiLimiter = createRateLimiter({ max: 60 });
const simulationLimiter = createRateLimiter({ max: 20 });
let inflightSimulations = 0;
const maxConcurrentSimulations = 4;

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
};

function resolveRequest(url = "/") {
  const pathname = decodeURIComponent(new URL(url, "http://localhost").pathname);
  const relative = pathname === "/"
    ? "public/index.html"
    : pathname.startsWith("/public/") || pathname.startsWith("/src/")
      ? pathname.replace(/^\//, "")
      : null;
  if (!relative) return null;
  const resolved = path.resolve(root, relative);
  const fromRoot = path.relative(root, resolved);
  return fromRoot && !fromRoot.startsWith("..") && !path.isAbsolute(fromRoot) ? resolved : null;
}

const rpcUrls = {
  devnet: "https://api.devnet.solana.com",
  "mainnet-beta": "https://api.mainnet-beta.solana.com",
};

function statusError(statusCode, message) {
  return Object.assign(new Error(message), { statusCode });
}

async function jsonBody(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 1_500_000) throw statusError(413, "Request body is too large.");
  }
  try {
    return body ? JSON.parse(body) : {};
  } catch {
    throw statusError(400, "Request body must contain valid JSON.");
  }
}

function sendJson(response, status, payload, headers = {}) {
  response.writeHead(status, {
    ...securityHeaders,
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    ...headers,
  });
  response.end(JSON.stringify(payload));
}

function sendText(response, status, body, contentType = "text/plain; charset=utf-8") {
  response.writeHead(status, { ...securityHeaders, "content-type": contentType, "cache-control": "no-store" });
  response.end(body);
}

async function rpc(network, method, params) {
  const endpoint = rpcUrls[network];
  if (!endpoint) throw statusError(400, "Unsupported Solana network.");
  const response = await fetchWithDeadline(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw statusError(502, "Solana RPC returned an invalid response.");
  }
  if (!response.ok || payload.error) {
    throw statusError(502, payload.error?.message || `Solana RPC returned HTTP ${response.status}.`);
  }
  return payload.result;
}

const pruneTimer = setInterval(() => {
  apiLimiter.prune();
  simulationLimiter.prune();
}, 60_000);
pruneTimer.unref();

const server = createServer(async (request, response) => {
  const context = requestContext(request);
  const finishMetrics = metrics.begin();
  let successfulSimulation = false;
  response.setHeader("x-request-id", context.id);
  response.once("finish", () => {
    finishMetrics({ status: response.statusCode, simulation: successfulSimulation });
    logRequest({
      requestId: context.id,
      method: request.method,
      path: new URL(request.url, "http://localhost").pathname,
      status: response.statusCode,
      durationMs: performance.now() - context.startedAt,
    });
  });

  const pathname = new URL(request.url, "http://localhost").pathname;

  if (pathname === "/api/health") {
    sendJson(response, 200, {
      ok: true,
      uptimeSeconds: Math.round(process.uptime()),
      explanationConfigured: Boolean(process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY),
      commit: process.env.RENDER_GIT_COMMIT?.slice(0, 7) || "local",
    });
    return;
  }

  if (pathname === "/api/ready") {
    const rustBinary = await findRustInspector();
    sendJson(response, rustBinary ? 200 : 503, { ok: Boolean(rustBinary), rustDecoder: Boolean(rustBinary) });
    return;
  }

  if (pathname === "/api/metrics") {
    sendText(response, 200, metrics.prometheus(), "text/plain; version=0.0.4; charset=utf-8");
    return;
  }

  if (request.method === "POST" && pathname.startsWith("/api/")) {
    const rate = apiLimiter.check(context.ip);
    if (!rate.allowed) {
      sendJson(response, 429, { error: "API rate limit exceeded. Try again shortly." }, {
        "retry-after": String(Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1_000))),
      });
      return;
    }

    try {
      const body = await jsonBody(request);
      if (pathname === "/api/analyze") {
        sendJson(response, 200, analyzeTransaction(body.transaction, {
          network: body.network,
          signature: body.signature,
          policies: body.policies,
        }));
        return;
      }

      if (pathname === "/api/simulate") {
        const simulationRate = simulationLimiter.check(context.ip);
        if (!simulationRate.allowed) throw statusError(429, "Simulation rate limit exceeded. Try again shortly.");
        if (inflightSimulations >= maxConcurrentSimulations) {
          throw statusError(503, "Simulation capacity is busy. Try again shortly.");
        }
        if (!body.serializedTransaction || typeof body.serializedTransaction !== "string") {
          throw statusError(400, "Paste a base64 serialized transaction first.");
        }

        inflightSimulations += 1;
        try {
          const network = body.network || "devnet";
          const serializedTransaction = body.serializedTransaction.trim();
          const inspection = await inspectWithRust(serializedTransaction);
          const result = await rpc(network, "simulateTransaction", [serializedTransaction, {
            commitment: "confirmed",
            encoding: "base64",
            replaceRecentBlockhash: true,
            sigVerify: false,
            innerInstructions: true,
          }]);
          successfulSimulation = true;
          sendJson(response, 200, analyzeSimulation(result.value, {
            network,
            policies: body.policies,
            inspection,
          }));
        } finally {
          inflightSimulations -= 1;
        }
        return;
      }

      if (pathname === "/api/explain") {
        sendJson(response, 200, await explainWithModel(body.report));
        return;
      }

      sendJson(response, 404, { error: "Unknown API route." });
    } catch (error) {
      const status = Number(error.statusCode) || (error.name === "TimeoutError" ? 504 : 400);
      sendJson(response, status, { error: error.message });
    }
    return;
  }

  const requested = resolveRequest(request.url);
  if (!requested) {
    sendText(response, 403, "Forbidden");
    return;
  }

  let filePath = requested;
  try {
    const info = await stat(filePath);
    if (info.isDirectory()) filePath = path.join(filePath, "index.html");
    await stat(filePath);
  } catch {
    sendText(response, 404, "Not found");
    return;
  }

  response.writeHead(200, {
    ...securityHeaders,
    "content-type": contentTypes[path.extname(filePath)] || "application/octet-stream",
    "cache-control": "no-store",
  });
  createReadStream(filePath).pipe(response);
});

server.listen(port, () => {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: "info",
    event: "server_started",
    port,
  }));
});

function shutdown(signal) {
  console.log(JSON.stringify({ timestamp: new Date().toISOString(), level: "info", event: "shutdown", signal }));
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 9_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
