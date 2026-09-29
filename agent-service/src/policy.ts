export type ActionRisk =
  | "read"
  | "draft"
  | "external_communication"
  | "booking_change"
  | "financial"
  | "deployment"
  | "security";

export type ApprovalDecision = {
  risk: ActionRisk;
  approvalRequired: boolean;
  reason: string;
};

const APPROVAL_REQUIRED = new Set<ActionRisk>([
  "external_communication",
  "booking_change",
  "financial",
  "deployment",
  "security",
]);

export function checkApproval(risk: ActionRisk): ApprovalDecision {
  if (APPROVAL_REQUIRED.has(risk)) {
    return {
      risk,
      approvalRequired: true,
      reason:
        "This action can affect customers, money, production systems, or security, so a human must approve it first.",
    };
  }

  return {
    risk,
    approvalRequired: false,
    reason:
      risk === "read"
        ? "Reading approved business data does not change anything."
        : "Creating a draft is reversible because nothing is sent or changed yet.",
  };
}
