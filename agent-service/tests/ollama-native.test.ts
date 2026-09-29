import test from "node:test";
import assert from "node:assert/strict";
import { resolveOllamaNativeRuntime, runOllamaOwnerAssistant } from "../src/ollama-native.js";

test("native Ollama defaults to the local 3B model", () => {
  assert.deepEqual(resolveOllamaNativeRuntime({}), {
    baseURL: "http://ollama:11434",
    model: "qwen2.5:3b",
    timeoutMs: 45000,
  });
});

test("native Ollama returns assistant content without requiring an OpenAI key", async () => {
  let requestBody: any;
  const fetchImpl = async (_url: string | URL | Request, init?: RequestInit) => {
    requestBody = JSON.parse(String(init?.body || "{}"));
    return new Response(JSON.stringify({
      message: { role: "assistant", content: "1. Check stockout risk.\n2. Review open tickets." },
    }), { status: 200, headers: { "content-type": "application/json" } });
  };

  const result = await runOllamaOwnerAssistant("trusted snapshot", {
    env: {
      OLLAMA_BASE_URL: "http://ollama:11434/",
      OLLAMA_AGENT_MODEL: "qwen2.5:3b",
      OLLAMA_REQUEST_TIMEOUT_MS: "30000",
    },
    fetchImpl: fetchImpl as typeof fetch,
  });

  assert.equal(result.provider, "ollama");
  assert.equal(result.model, "qwen2.5:3b");
  assert.match(result.output, /stockout risk/);
  assert.equal(requestBody.model, "qwen2.5:3b");
  assert.equal(requestBody.stream, false);
  assert.equal(requestBody.options.temperature, 0);
});

test("native Ollama fails closed on empty model responses", async () => {
  const fetchImpl = async () =>
    new Response(JSON.stringify({ message: { role: "assistant", content: "" } }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  await assert.rejects(
    runOllamaOwnerAssistant("trusted snapshot", { fetchImpl: fetchImpl as typeof fetch }),
    /empty response/i,
  );
});