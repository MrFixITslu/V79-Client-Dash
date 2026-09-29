import test from "node:test";
import assert from "node:assert/strict";
import { resolveAgentModelConfig } from "../src/model-provider.js";

test("Ollama is the default local provider", () => {
  const config = resolveAgentModelConfig({});
  assert.deepEqual(config, {
    provider: "ollama",
    model: "qwen2.5:1.5b",
    baseURL: "http://ollama:11434/v1",
  });
});

test("Ollama model and URL are configurable", () => {
  const config = resolveAgentModelConfig({
    V79_AGENT_PROVIDER: "ollama",
    OLLAMA_MODEL: "qwen2.5:3b",
    OLLAMA_OPENAI_BASE_URL: "http://custom-ollama:11434/v1/",
  });
  assert.equal(config.model, "qwen2.5:3b");
  assert.equal(config.baseURL, "http://custom-ollama:11434/v1");
});

test("OpenAI remains an optional provider", () => {
  const config = resolveAgentModelConfig({
    V79_AGENT_PROVIDER: "openai",
    OPENAI_AGENT_MODEL: "gpt-5.6-sol",
  });
  assert.deepEqual(config, { provider: "openai", model: "gpt-5.6-sol" });
});