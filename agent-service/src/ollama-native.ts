export type OllamaNativeRuntime = {
  baseURL: string;
  model: string;
  timeoutMs: number;
};

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function resolveOllamaNativeRuntime(env: NodeJS.ProcessEnv = process.env): OllamaNativeRuntime {
  return {
    baseURL: String(env.OLLAMA_BASE_URL || "http://ollama:11434").trim().replace(/\/+$/, ""),
    model: String(env.OLLAMA_AGENT_MODEL || "qwen2.5:1.5b").trim(),
    timeoutMs: positiveInteger(env.OLLAMA_REQUEST_TIMEOUT_MS, 45_000),
  };
}

type OllamaChatResponse = {
  message?: { role?: string; content?: string };
  error?: string;
};

export async function runOllamaOwnerAssistant(
  groundedMessage: string,
  options: {
    env?: NodeJS.ProcessEnv;
    fetchImpl?: typeof fetch;
  } = {},
) {
  const runtime = resolveOllamaNativeRuntime(options.env);
  const fetchImpl = options.fetchImpl || fetch;
  const response = await fetchImpl(`${runtime.baseURL}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: runtime.model,
      stream: false,
      keep_alive: "10m",
      options: {
        temperature: 0,
        num_predict: 220,
      },
      messages: [
        {
          role: "system",
          content: [
            "You are the private Vision79 Owner Assistant for V79 Digital.",
            "You are in READ-ONLY mode.",
            "Use only the trusted business snapshot supplied in the user message for current facts.",
            "Never invent missing values.",
            "Prioritize exceptions, risks, overdue work, cashflow, customer impact, operational issues, and practical next actions.",
            "Do not claim you changed, sent, deployed, refunded, booked, or edited anything.",
            "Keep answers concise and professional.",
          ].join(" "),
        },
        { role: "user", content: groundedMessage },
      ],
    }),
    signal: AbortSignal.timeout(runtime.timeoutMs),
  });

  const payload = (await response.json().catch(() => ({}))) as OllamaChatResponse;
  if (!response.ok) {
    throw new Error(payload.error || `Ollama returned HTTP ${response.status}.`);
  }
  const output = String(payload.message?.content || "").trim();
  if (!output) throw new Error("Ollama returned an empty response.");
  return {
    output,
    model: runtime.model,
    provider: "ollama" as const,
  };
}