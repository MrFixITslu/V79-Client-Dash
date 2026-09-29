import { tool } from "@openai/agents";
import { z } from "zod";
import { BUSINESS_SYSTEMS, getBusinessSystem } from "./business.js";
import { checkApproval } from "./policy.js";

type HealthResult = {
  key: string;
  name: string;
  status: "healthy" | "unhealthy" | "not_configured";
  httpStatus?: number;
  latencyMs?: number;
  detail?: string;
};

async function checkOne(key: string): Promise<HealthResult> {
  const system = getBusinessSystem(key);

  if (!system) {
    return {
      key,
      name: key,
      status: "unhealthy",
      detail: "Unknown system.",
    };
  }

  if (!system.healthUrl) {
    return {
      key: system.key,
      name: system.name,
      status: "not_configured",
      detail: "No health URL is configured yet.",
    };
  }

  const started = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(system.healthUrl, {
      signal: controller.signal,
      headers: { "user-agent": "v79-business-agent/0.1" },
    });

    const latencyMs = Date.now() - started;
    return {
      key: system.key,
      name: system.name,
      status: response.ok ? "healthy" : "unhealthy",
      httpStatus: response.status,
      latencyMs,
      detail: response.ok ? "Health check succeeded." : "Health check returned an error status.",
    };
  } catch (error) {
    return {
      key: system.key,
      name: system.name,
      status: "unhealthy",
      latencyMs: Date.now() - started,
      detail: error instanceof Error ? error.message : "Health check failed.",
    };
  } finally {
    clearTimeout(timeout);
  }
}

export const listBusinessSystemsTool = tool({
  name: "list_business_systems",
  description:
    "List the V79 business systems the agent knows about and what each one is for.",
  parameters: z.object({}),
  async execute() {
    return BUSINESS_SYSTEMS.map(({ key, name, purpose, healthUrl }) => ({
      key,
      name,
      purpose,
      healthConfigured: Boolean(healthUrl),
    }));
  },
});

export const checkAppHealthTool = tool({
  name: "check_app_health",
  description:
    "Check the configured health endpoint for one V79 app or all V79 apps. This is read-only.",
  parameters: z.object({
    system: z
      .string()
      .default("all")
      .describe("Use a system key such as hub, lasertag, marketing, pos, or all."),
  }),
  async execute({ system }) {
    if (system.toLowerCase() === "all") {
      return Promise.all(BUSINESS_SYSTEMS.map((item) => checkOne(item.key)));
    }

    return checkOne(system);
  },
});

export const approvalPolicyTool = tool({
  name: "check_action_approval",
  description:
    "Check whether a proposed business action requires owner approval before it can happen.",
  parameters: z.object({
    risk: z.enum([
      "read",
      "draft",
      "external_communication",
      "booking_change",
      "financial",
      "deployment",
      "security",
    ]),
  }),
  async execute({ risk }) {
    return checkApproval(risk);
  },
});
