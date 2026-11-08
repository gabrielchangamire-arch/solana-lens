import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeTransaction } from "./src/analyzer.js";
import { explainWithModel } from "./src/ai.js";
import { analyzeSimulation } from "./src/simulation.js";

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 4173);
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

async function jsonBody(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 1_500_000) throw new Error("Request body is too large.");
  }
  return body ? JSON.parse(body) : {};
}

function sendJson(response, status, payload) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  response.end(JSON.stringify(payload));
}

async function rpc(network, method, params) {
  const endpoint = rpcUrls[network];
  if (!endpoint) throw new Error("Unsupported Solana network.");
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const payload = await response.json();
  if (!response.ok || payload.error) throw new Error(payload.error?.message || `RPC returned HTTP ${response.status}.`);
  return payload.result;
}

createServer(async (request, response) => {
  const pathname = new URL(request.url, "http://localhost").pathname;
  if (pathname === "/api/health") {
    sendJson(response, 200, { ok: true, aiConfigured: Boolean(process.env.OPENAI_API_KEY), model: process.env.OPENAI_API_KEY ? (process.env.OPENAI_MODEL || "gpt-6-luna") : null });
    return;
  }
  if (request.method === "POST" && pathname.startsWith("/api/")) {
    try {
      const body = await jsonBody(request);
      if (pathname === "/api/analyze") {
        sendJson(response, 200, analyzeTransaction(body.transaction, { network: body.network, signature: body.signature, policies: body.policies }));
        return;
      }
      if (pathname === "/api/simulate") {
        if (!body.serializedTransaction || typeof body.serializedTransaction !== "string") throw new Error("Paste a base64 serialized transaction first.");
        const network = body.network || "devnet";
        const result = await rpc(network, "simulateTransaction", [body.serializedTransaction.trim(), {
          commitment: "confirmed",
          encoding: "base64",
          replaceRecentBlockhash: true,
          sigVerify: false,
          innerInstructions: true,
        }]);
        sendJson(response, 200, analyzeSimulation(result.value, { network, policies: body.policies }));
        return;
      }
      if (pathname === "/api/explain") {
        sendJson(response, 200, await explainWithModel(body.report));
        return;
      }
      sendJson(response, 404, { error: "Unknown API route." });
    } catch (error) {
      sendJson(response, 400, { error: error.message });
    }
    return;
  }
  const requested = resolveRequest(request.url);
  if (!requested) {
    response.writeHead(403).end("Forbidden");
    return;
  }

  let filePath = requested;
  try {
    const info = await stat(filePath);
    if (info.isDirectory()) filePath = path.join(filePath, "index.html");
    await stat(filePath);
  } catch {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" }).end("Not found");
    return;
  }

  response.writeHead(200, {
    "content-type": contentTypes[path.extname(filePath)] || "application/octet-stream",
    "cache-control": "no-store",
  });
  createReadStream(filePath).pipe(response);
}).listen(port, () => {
  console.log(`Solana Lens running at http://localhost:${port}`);
});
