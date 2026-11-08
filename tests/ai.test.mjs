import test from "node:test";
import assert from "node:assert/strict";
import { explainWithModel } from "../src/ai.js";

test("AI explanation cleanly degrades when no API key is configured", async () => {
  const result = await explainWithModel({ status: "succeeded", policy: { decision: "safe" } }, {});
  assert.deepEqual(result, { available: false, explanation: null, model: null });
});

test("Gemini is preferred and receives only the compact deterministic report", async () => {
  let request;
  const fetchStub = async (url, options) => {
    request = { url, options };
    return {
      ok: true,
      async json() {
        return { candidates: [{ content: { parts: [{ text: "The configured checks passed. Review the Token-2022 instruction before signing." }] } }] };
      },
    };
  };

  const result = await explainWithModel({
    status: "succeeded",
    summary: "Verified evidence",
    policy: { decision: "safe", rules: [] },
    privateField: "must not be sent",
  }, {
    GEMINI_API_KEY: "test-gemini-key",
    GEMINI_MODEL: "gemini-test",
    OPENAI_API_KEY: "test-openai-key",
  }, fetchStub);

  assert.deepEqual(result, {
    available: true,
    explanation: "The configured checks passed. Review the Token-2022 instruction before signing.",
    model: "gemini-test",
    provider: "gemini",
  });
  assert.match(request.url, /gemini-test:generateContent$/);
  assert.equal(request.options.headers["x-goog-api-key"], "test-gemini-key");
  const body = JSON.parse(request.options.body);
  assert.equal(body.generationConfig.temperature, 0.2);
  assert.doesNotMatch(body.contents[0].parts[0].text, /privateField/);
  assert.match(body.systemInstruction.parts[0].text, /cannot|Never call/i);
});

test("OpenAI remains available as a fallback provider", async () => {
  const fetchStub = async (url) => {
    assert.equal(url, "https://api.openai.com/v1/responses");
    return {
      ok: true,
      async json() {
        return { output_text: "The policy blocked this transaction because it exceeded the configured limit." };
      },
    };
  };
  const result = await explainWithModel({ policy: { decision: "blocked" } }, {
    OPENAI_API_KEY: "test-openai-key",
    OPENAI_MODEL: "test-openai-model",
  }, fetchStub);
  assert.equal(result.provider, "openai");
  assert.equal(result.model, "test-openai-model");
});

test("empty Gemini responses fail instead of pretending AI is configured", async () => {
  const fetchStub = async () => ({ ok: true, async json() { return { candidates: [] }; } });
  await assert.rejects(
    explainWithModel({ policy: { decision: "safe" } }, { GEMINI_API_KEY: "test-key" }, fetchStub),
    /empty explanation/,
  );
});
