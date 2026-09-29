export type AgentContext = {
  userId: string;
  email: string;
  organizationId: string;
  organizationName: string;
  allowedSystems: string[];
  ownerAgent: boolean;
  hubAdmin: boolean;
};

export const OWNER_AGENT_EMAIL = "vision79slu@gmail.com";

export function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function isValidOwnerContext(context: AgentContext) {
  return Boolean(
    context.ownerAgent &&
      context.hubAdmin &&
      normalizeEmail(context.email) === OWNER_AGENT_EMAIL &&
      context.userId &&
      context.organizationId,
  );
}

export function canUseSystem(context: AgentContext, system: string) {
  return context.ownerAgent || context.allowedSystems.includes(system);
}