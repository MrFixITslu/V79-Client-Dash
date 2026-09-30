import { OpenAIProvider, setDefaultModelProvider, setTracingDisabled } from "@openai/agents";
import { OpenAI } from "openai";

export type AgentModelProvider = "ollama" | "openai";

export type AgentModelRuntime = {
  provider: AgentModelProvider;
  model: string;
  baseURL?: string;
  timeoutMs?: number;
};

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function resolveAgentModelRuntime(env: NodeJS.ProcessEnv = process.env): AgentModelRuntime {
  const provider = String(env.V79_AGENT_MODEL_PROVIDER || "ollama").trim().toLowerCase();
  if (provider === "ollama") {
    return {
      provider: "ollama",
      model: String(env.OLLAMA_AGENT_MODEL || "qwen2.5:1.5b").trim(),
      baseURL: String(env.OLLAMA_OPENAI_BASE_URL || "http://ollama:11434/v1").trim().replace(/\/+$/, ""),
      timeoutMs: positiveInteger(env.OLLAMA_REQUEST_TIMEOUT_MS, 90_000),
    };
  }
  if (provider === "openai") {
    return {
      provider: "openai",
      model: String(env.OPENAI_AGENT_MODEL || "gpt-5.6-sol").trim(),
    };
  }
  throw new Error("V79_AGENT_MODEL_PROVIDER must be either 'ollama' or 'openai'.");
}

export function configureAgentModelRuntime(env: NodeJS.ProcessEnv = process.env) {
  const runtime = resolveAgentModelRuntime(env);

  if (runtime.provider === "ollama") {
    const client = new OpenAI({
      apiKey: String(env.OLLAMA_API_KEY || "ollama-local"),
      baseURL: runtime.baseURL,
      timeout: runtime.timeoutMs,
      maxRetries: 0,
    });
    setDefaultModelProvider(new OpenAIProvider({
      openAIClient: client,
      useResponses: false,
      strictFeatureValidation: false,
    }));
    setTracingDisabled(true);
  }

  return runtime;
}

export const agentModelRuntime = configureAgentModelRuntime();