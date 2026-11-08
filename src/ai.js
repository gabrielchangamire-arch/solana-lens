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

export async function explainWithModel(report, env = process.env) {
  if (!env.OPENAI_API_KEY) {
    return { available: false, explanation: null, model: null };
  }
  const model = env.OPENAI_MODEL || "gpt-6-luna";
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "authorization": `Bearer ${env.OPENAI_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      reasoning: { effort: "low" },
      instructions: "You explain Solana transaction safety reports. Use only the supplied deterministic evidence. Never call a transaction safe; use the exact policy decision. Explain unfamiliar programs as requiring verification, not as malicious. Write 2 concise sentences for a nontechnical user.",
      input: JSON.stringify(compactReport(report)),
      max_output_tokens: 180,
    }),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error?.message || `Model request failed with HTTP ${response.status}.`);
  return { available: true, explanation: extractOutputText(payload), model };
}

export const aiHelpers = { compactReport, extractOutputText };
