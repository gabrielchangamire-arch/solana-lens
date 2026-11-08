import { access } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const candidates = [
  process.env.RUST_INSPECTOR_PATH,
  path.join(projectRoot, "bin", "solana-inspect"),
  path.join(projectRoot, "rust", "transaction-inspector", "target", "release", "solana-inspect"),
].filter(Boolean);

let cachedBinary;

export async function findRustInspector() {
  if (cachedBinary !== undefined) return cachedBinary;
  for (const candidate of candidates) {
    try {
      await access(candidate);
      cachedBinary = candidate;
      return candidate;
    } catch {
      // Try the next production or local build location.
    }
  }
  cachedBinary = null;
  return null;
}

export async function inspectWithRust(serializedTransaction, { timeoutMs = 1_500 } = {}) {
  const binary = await findRustInspector();
  if (!binary) return { available: false, reason: "Rust inspector binary is not built." };

  return new Promise((resolve, reject) => {
    const child = spawn(binary, [], { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("Rust transaction inspection timed out."));
    }, timeoutMs);

    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        resolve({ available: false, reason: stderr.trim() || `Rust inspector exited with ${code}.` });
        return;
      }
      try {
        resolve({ available: true, ...JSON.parse(stdout) });
      } catch {
        reject(new Error("Rust inspector returned invalid JSON."));
      }
    });
    child.stdin.end(serializedTransaction.trim());
  });
}

export function resetRustInspectorCacheForTests() {
  cachedBinary = undefined;
}
