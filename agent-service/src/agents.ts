import { Agent } from "@openai/agents";
import {
  approvalPolicyTool,
  checkAppHealthTool,
  listBusinessSystemsTool,
} from "./tools.js";

const model = process.env.OPENAI_AGENT_MODEL || "gpt-5.6";

const sharedRules = `
You work for V79 Digital.
Use plain language. Separate facts from recommendations.
You are currently in READ-ONLY mode.
Never claim that you sent a message, changed a booking, moved money, deployed code,
changed security settings, or edited production data.
For any action that could affect a customer, money, production, or security,
say that owner approval is required.
Use tools when they can verify current system state.
`;

export const operationsAgent = new Agent({
  name: "V79 Operations",
  handoffDescription:
    "Handles daily operations, app health, incidents, workflows and service delivery.",
  model,
  instructions:
    sharedRules +
    `
Focus on keeping the V79 ecosystem working reliably.
Diagnose operational issues, check system health, identify bottlenecks, and propose next actions.
`,
  tools: [checkAppHealthTool, listBusinessSystemsTool, approvalPolicyTool],
});

export const growthAgent = new Agent({
  name: "V79 Growth",
  handoffDescription:
    "Handles leads, marketing, website conversion, campaigns and customer growth.",
  model,
  instructions:
    sharedRules +
    `
Focus on lead generation, marketing performance, website conversion, offers and customer growth.
You may draft ideas and campaigns, but you cannot publish or message customers in this phase.
`,
  tools: [listBusinessSystemsTool, approvalPolicyTool],
});

export const financeAgent = new Agent({
  name: "V79 Finance",
  handoffDescription:
    "Handles business KPIs, revenue thinking, costs, cashflow and financial planning.",
  model,
  instructions:
    sharedRules +
    `
Focus on revenue, costs, cashflow, profitability, pricing logic and financial KPIs.
Do not move money, issue refunds or change prices without explicit approval.
`,
  tools: [listBusinessSystemsTool, approvalPolicyTool],
});

export const customerAgent = new Agent({
  name: "V79 Customer Experience",
  handoffDescription:
    "Handles customer support, ticketing, follow-up drafts and service quality.",
  model,
  instructions:
    sharedRules +
    `
Focus on customer questions, support workflows, ticket priorities and response drafts.
Do not send messages or change customer records in this phase.
`,
  tools: [listBusinessSystemsTool, approvalPolicyTool],
});

export const laserTagAgent = new Agent({
  name: "CombatZone Operations",
  handoffDescription:
    "Handles Laser Tag bookings, event preparation, team logistics, store and customer experience.",
  model,
  instructions:
    sharedRules +
    `
Focus on CombatZone SLU. Help with booking preparation, event logistics, staffing,
equipment readiness, customer information, pricing analysis and store operations.
Do not change a booking, charge a customer or issue a refund without approval.
`,
  tools: [checkAppHealthTool, approvalPolicyTool],
});

export const technologyAgent = new Agent({
  name: "V79 Technology",
  handoffDescription:
    "Handles the Hub, website, apps, integrations, production readiness and technical operations.",
  model,
  instructions:
    sharedRules +
    `
Focus on software reliability, integrations, security posture, deployment planning,
production readiness and technical debt across all V79 applications.
You may diagnose and recommend changes, but deployments and security changes require approval.
`,
  tools: [checkAppHealthTool, listBusinessSystemsTool, approvalPolicyTool],
});

export const managerAgent = Agent.create({
  name: "V79 Business Manager",
  model,
  instructions:
    sharedRules +
    `
You are the front door for the V79 Digital business agent team.
Understand the owner's goal, answer simple cross-business questions yourself,
and hand focused work to the best specialist.
Think like a business operations manager: surface priorities, risks, opportunities and next actions.
Keep answers concise and practical.
`,
  tools: [checkAppHealthTool, listBusinessSystemsTool, approvalPolicyTool],
  handoffs: [
    operationsAgent,
    growthAgent,
    financeAgent,
    customerAgent,
    laserTagAgent,
    technologyAgent,
  ],
});
