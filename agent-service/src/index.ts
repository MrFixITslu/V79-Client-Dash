import "dotenv/config";
import express from "express";
import fs from "node:fs";
import { run } from "@openai/agents";
import { managerAgent } from "./agents.js";
import { agentModelConfig } from "./model-provider.js";
import { BUSINESS_SYSTEMS } from "./business.js";
import { checkApproval, type ActionRisk } from "./policy.js";
import { isValidOwnerContext, type AgentContext } from "./context.js";

const app = express();
const port = Number(process.env.PORT || 3055);
const tokenFile = process.env.V79_AGENT_TOKEN_FILE || "/run/secrets/v79-agent-token";
function readApiToken() {
  const direct = String(process.env.V79_AGENT_API_TOKEN || "").trim();
  if (direct) return direct;
  try { return fs.readFileSync(tokenFile, "utf8").trim(); } catch { return ""; }
}

app.disable("x-powered-by");
app.use(express.json({ limit: "128kb" }));

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "v79-business-agent",
    mode: "read-only",
    systemsKnown: BUSINESS_SYSTEMS.length,
    modelProvider: agentModelConfig.provider,
    model: agentModelConfig.model,
  });
});
app.use("/api", (req, res, next) => {
  const apiToken = readApiToken();
  if (!apiToken) {
    if (process.env.NODE_ENV === "production") {
      return res.status(503).json({ error: "Owner Assistant internal token is not configured." });
    }
    return next();
  }
  if (req.header("x-v79-agent-token") !== apiToken) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
});

app.get("/api/agent/capabilities", (_req, res) => {
  res.json({
    mode: "read-only",
    ownerOnly: true,
    can: [
      "answer business questions",
      "route work to specialist agents",
      "check permitted application health",
      "prepare drafts and recommendations",
      "explain whether an action needs owner approval",
    ],
    cannotYet: [
      "send email",
      "change bookings",
      "charge or refund customers",
      "change production data",
      "deploy code",
      "change security settings",
    ],
  });
});
app.post("/api/policy/check", (req, res) => {
  const risk = String(req.body?.risk || "") as ActionRisk;
  const valid: ActionRisk[] = [
    "read",
    "draft",
    "external_communication",
    "booking_change",
    "financial",
    "deployment",
    "security",
  ];
  if (!valid.includes(risk)) {
    return res.status(400).json({ error: "Unknown risk category." });
  }
  return res.json(checkApproval(risk));
});

app.post("/api/agent/chat", async (req, res) => {
  const message = String(req.body?.message || "").trim();
  const context = req.body?.context as AgentContext | undefined;

  if (!message) return res.status(400).json({ error: "message is required" });
  if (message.length > 12000) return res.status(413).json({ error: "message is too long" });
  if (!context || !isValidOwnerContext(context)) {
    return res.status(403).json({ error: "Vision79 Owner Assistant access required." });
  }
  try {
    const result = await run(managerAgent, message, { context });
    return res.json({
      output:
        typeof result.finalOutput === "string"
          ? result.finalOutput
          : JSON.stringify(result.finalOutput),
      specialist: result.lastAgent?.name || managerAgent.name,
      mode: "read-only",
      modelProvider: agentModelConfig.provider,
      model: agentModelConfig.model,
    });
  } catch (error) {
    console.error("agent run failed", error);
    return res.status(500).json({ error: "The agent could not complete this request." });
  }
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Vision79 Owner Assistant listening on :${port} in read-only mode using ${agentModelConfig.provider}/${agentModelConfig.model}`);
});