function compactReport(report) {
  return {
    mode: report.mode,
    network: report.network,
    status: report.status,
    summary: report.summary,
    fee: report.fee,
    programs: report.programs,
    transfers: report.transfers,
    changes: report.changes,
    writableAccounts: report.writableAccounts,
    unitsConsumed: report.unitsConsumed,
    policy: report.policy,
  };
}

function extractOutputText(response) {
  if (typeof response.output_text === "string") return response.output_text;
  return (response.output || [])
    .flatMap((item) => item.content || [])
    .filter((item) => item.type === "output_text")
    .map((item) => item.text)
    .join("\n");
}

function extractGeminiText(response) {
  return (response.candidates || [])
    .flatMap((candidate) => candidate.content?.parts || [])
    .map((part) => part.text)
    .filter((text) => typeof text === "string")
    .join("\n")
    .trim();
}

const instructions = "You explain Solana transaction safety reports. Use only the supplied deterministic evidence. Never call a transaction safe; use the exact policy decision. Explain unfamiliar programs as requiring verification, not as malicious. Write 2 concise sentences for a nontechnical user.";

async function explainWithGemini(report, env, fetchImpl) {
  const model = env.GEMINI_MODEL || "gemini-3.5-flash-lite";
  const response = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-goog-api-key": env.GEMINI_API_KEY,
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: instructions }] },
      contents: [{ role: "user", parts: [{ text: JSON.stringify(compactReport(report)) }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 180 },
    }),
    signal: AbortSignal.timeout(10_000),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error?.message || `Gemini request failed with HTTP ${response.status}.`);
  const explanation = extractGeminiText(payload);
  if (!explanation) throw new Error("Gemini returned an empty explanation.");
  return { available: true, explanation, model, provider: "gemini" };
}

async function explainWithOpenAI(report, env, fetchImpl) {
  const model = env.OPENAI_MODEL || "gpt-6-luna";
  const response = await fetchImpl("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "authorization": `Bearer ${env.OPENAI_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      reasoning: { effort: "low" },
      instructions,
      input: JSON.stringify(compactReport(report)),
      max_output_tokens: 180,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error?.message || `Model request failed with HTTP ${response.status}.`);
  const explanation = extractOutputText(payload).trim();
  if (!explanation) throw new Error("OpenAI returned an empty explanation.");
  return { available: true, explanation, model, provider: "openai" };
}

export async function explainWithModel(report, env = process.env, fetchImpl = fetch) {
  if (env.GEMINI_API_KEY) return explainWithGemini(report, env, fetchImpl);
  if (env.OPENAI_API_KEY) return explainWithOpenAI(report, env, fetchImpl);
  return { available: false, explanation: null, model: null };
}

export const aiHelpers = { compactReport, extractGeminiText, extractOutputText };
