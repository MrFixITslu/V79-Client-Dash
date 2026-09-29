import { OpenAIProvider, setDefaultModelProvider, setTracingDisabled } from "@openai/agents";

export type AgentProviderName = "ollama" | "openai";

export type AgentModelConfig = {
  provider: AgentProviderName;
  model: string;
  baseURL?: string;
};

export function resolveAgentModelConfig(env: NodeJS.ProcessEnv = process.env): AgentModelConfig {
  const provider = String(env.V79_AGENT_PROVIDER || "ollama").trim().toLowerCase();
  if (provider === "openai") {
    return {
      provider: "openai",
      model: String(env.OPENAI_AGENT_MODEL || "gpt-5.6-sol").trim(),
    };
  }

  return {
    provider: "ollama",
    model: String(env.OLLAMA_MODEL || "qwen2.5:1.5b").trim(),
    baseURL: String(env.OLLAMA_OPENAI_BASE_URL || "http://ollama:11434/v1").replace(/\/$/, ""),
  };
}

export function configureAgentModelProvider(env: NodeJS.ProcessEnv = process.env) {
  const config = resolveAgentModelConfig(env);
  if (config.provider === "ollama") {
    setTracingDisabled(true);
    setDefaultModelProvider(new OpenAIProvider({
      apiKey: "ollama",
      baseURL: config.baseURL,
      useResponses: false,
      strictFeatureValidation: false,
    }));
  }
  return config;
}

export const agentModelConfig = configureAgentModelProvider();