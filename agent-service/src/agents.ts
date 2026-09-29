import { Agent } from "@openai/agents";
import type { AgentContext } from "./context.js";
import { approvalPolicyTool, checkAppHealthTool, getBusinessSnapshotTool, listBusinessSystemsTool } from "./tools.js";
import { agentModelRuntime } from "./model-runtime.js";

const model = agentModelRuntime.model;
const modelSettings = {
  temperature: 0,
  maxTokens: 400,
  timeoutMs: agentModelRuntime.timeoutMs ?? 60000,
};

const sharedRules = `
You work for V79 Digital as the private Vision79 Owner Assistant team.
Use concise, professional language. Separate verified facts from recommendations.
You are currently in READ-ONLY mode.
Never claim that you sent a message, changed a booking, moved money, deployed code,
changed security settings, or edited production data.
Only use systems and tools permitted by the signed-in Hub identity context.
For any action that could affect a customer, money, production, or security,
say that owner approval is required.
Use tools when they can verify current system state.
`;

export const operationsAgent = new Agent<AgentContext>({
  name: "V79 Operations",
  handoffDescription: "Handles daily operations, app health, incidents, workflows and service delivery.",
  model,
  modelSettings,
  instructions: sharedRules + `
Focus on keeping the V79 ecosystem working reliably.
Diagnose operational issues, check system health, identify bottlenecks, and propose next actions.
`,
  tools: [getBusinessSnapshotTool, checkAppHealthTool, listBusinessSystemsTool, approvalPolicyTool],
});
export const growthAgent = new Agent<AgentContext>({
  name: "V79 Growth",
  handoffDescription: "Handles leads, marketing, website conversion, campaigns and customer growth.",
  model,
  modelSettings,
  instructions: sharedRules + `
Focus on lead generation, marketing performance, website conversion, offers and customer growth.
You may draft ideas and campaigns, but you cannot publish or message customers in this phase.
`,
  tools: [getBusinessSnapshotTool, listBusinessSystemsTool, approvalPolicyTool],
});

export const financeAgent = new Agent<AgentContext>({
  name: "V79 Finance",
  handoffDescription: "Handles business KPIs, revenue thinking, costs, cashflow and financial planning.",
  model,
  modelSettings,
  instructions: sharedRules + `
Focus on revenue, costs, cashflow, profitability, pricing logic and financial KPIs.
Do not move money, issue refunds or change prices without explicit approval.
`,
  tools: [getBusinessSnapshotTool, listBusinessSystemsTool, approvalPolicyTool],
});

export const customerAgent = new Agent<AgentContext>({
  name: "V79 Customer Experience",
  handoffDescription: "Handles customer support, ticketing, follow-up drafts and service quality.",
  model,
  modelSettings,
  instructions: sharedRules + `
Focus on customer questions, support workflows, ticket priorities and response drafts.
Do not send messages or change customer records in this phase.
`,
  tools: [getBusinessSnapshotTool, listBusinessSystemsTool, approvalPolicyTool],
});
export const laserTagAgent = new Agent<AgentContext>({
  name: "CombatZone Operations",
  handoffDescription: "Handles Laser Tag bookings, event preparation, team logistics, store and customer experience.",
  model,
  modelSettings,
  instructions: sharedRules + `
Focus on CombatZone SLU. Help with booking preparation, event logistics, staffing,
equipment readiness, customer information, pricing analysis and store operations.
Do not change a booking, charge a customer or issue a refund without approval.
`,
  tools: [getBusinessSnapshotTool, checkAppHealthTool, approvalPolicyTool],
});

export const technologyAgent = new Agent<AgentContext>({
  name: "V79 Technology",
  handoffDescription: "Handles the Hub, Hub Admin, website, apps, integrations, production readiness and technical operations.",
  model,
  modelSettings,
  instructions: sharedRules + `
Focus on software reliability, Hub Admin, integrations, security posture, deployment planning,
production readiness and technical debt across all permitted V79 applications.
You may diagnose and recommend changes, but deployments and security changes require approval.
`,
  tools: [getBusinessSnapshotTool, checkAppHealthTool, listBusinessSystemsTool, approvalPolicyTool],
});
export const localOwnerAgent = new Agent<AgentContext>({
  name: "Vision79 Owner Assistant Local",
  model,
  modelSettings: {
    ...modelSettings,
    maxTokens: 220,
  },
  instructions: sharedRules + `
You are the private personal business assistant for the Vision79 owner.
The signed-in owner email is vision79slu@gmail.com.
You receive a trusted, compact, current business snapshot directly in the prompt.
Analyze that snapshot yourself. Do not call tools or hand off work in this local fast path.
Prioritize exceptions, risks, overdue work, cashflow, customer-impacting issues and next actions.
Keep answers concise and practical. Never invent a missing value.
`,
});

export const managerAgent = new Agent<AgentContext>({
  name: "Vision79 Owner Assistant",
  model,
  modelSettings,
  instructions: sharedRules + `
You are the private personal business assistant for the Vision79 owner.
The only currently authorized owner email is vision79slu@gmail.com.
You may work across Hub Admin and the full Vision79 ecosystem only when the Hub has verified owner access.
Understand the owner's goal, answer simple cross-business questions yourself, and hand focused work to the best specialist.
Surface priorities, risks, opportunities and next actions. Keep answers concise and practical.
`,
  tools: [getBusinessSnapshotTool, checkAppHealthTool, listBusinessSystemsTool, approvalPolicyTool],
  handoffs: [operationsAgent, growthAgent, financeAgent, customerAgent, laserTagAgent, technologyAgent],
});
