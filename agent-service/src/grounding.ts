type UnknownRecord = Record<string, any>;

const PRODUCTS = ["pos","ffpro","tiquet","marketing","academy","lasertag","website","games"] as const;
const IMPORTANT_KEY = /(status|health|error|fail|risk|exception|overdue|pending|open|critical|stock|reorder|shipment|ticket|booking|player|lead|campaign|revenue|sale|income|expense|cash|balance|profit|enroll|student|course|session|usage|completion|mastered|view|sync|total|count|user|app|tenant)/i;


export type PrioritySignal = {
  severity: "high" | "medium" | "info";
  code: string;
  message: string;
  values?: UnknownRecord;
};

function number(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildPrioritySignals(snapshot: UnknownRecord): PrioritySignal[] {
  const signals: PrioritySignal[] = [];
  const business = snapshot?.business || {};
  const ffpro = business.ffpro?.metrics || {};
  const pos = business.pos?.metrics || {};
  const tiquet = business.tiquet?.metrics || {};
  const marketing = business.marketing?.metrics || {};
  const academy = business.academy?.metrics || {};
  const lasertag = business.lasertag?.metrics || {};
  const website = business.website?.metrics || {};

  if (number(ffpro.currentMonthNet) < 0) {
    signals.push({
      severity: "high",
      code: "finance_negative_month_net",
      message: "FFPRO current-month net is negative.",
      values: {
        currentMonthIncome: number(ffpro.currentMonthIncome),
        currentMonthExpenses: number(ffpro.currentMonthExpenses),
        currentMonthNet: number(ffpro.currentMonthNet),
      },
    });
  }
  if (number(pos.criticalReplenishmentItems) > 0) {
    signals.push({
      severity: "high",
      code: "pos_replenishment_risk",
      message: "POS has items requiring critical replenishment.",
      values: { criticalReplenishmentItems: number(pos.criticalReplenishmentItems) },
    });
  }
  if (number(pos.delayedShipments) > 0) {
    signals.push({
      severity: "high",
      code: "pos_delayed_shipments",
      message: "POS has delayed inbound shipments.",
      values: { delayedShipments: number(pos.delayedShipments) },
    });
  }
  if (number(pos.unresolvedInventoryExceptions) > 0) {
    signals.push({
      severity: "high",
      code: "pos_inventory_exceptions",
      message: "POS has unresolved inventory exceptions.",
      values: { unresolvedInventoryExceptions: number(pos.unresolvedInventoryExceptions) },
    });
  }
  if (number(website.followUpsDue) > 0) {
    signals.push({
      severity: "medium",
      code: "website_followups_due",
      message: "Website CRM has lead follow-ups due.",
      values: { followUpsDue: number(website.followUpsDue) },
    });
  }
  if (number(tiquet.unreadNotifications) > 0) {
    signals.push({
      severity: "medium",
      code: "tiquet_unread_notifications",
      message: "Tiquet has unread notifications.",
      values: { unreadNotifications: number(tiquet.unreadNotifications) },
    });
  }
  if (number(pos.sales30d) === 0) {
    signals.push({
      severity: "medium",
      code: "pos_no_recent_sales",
      message: "POS reports no sales in the last 30 days.",
      values: { sales30d: 0, revenue30d: number(pos.revenue30d) },
    });
  }
  if (number(marketing.activeCampaigns) === 0) {
    signals.push({
      severity: "medium",
      code: "marketing_no_active_campaigns",
      message: "Marketing has no active campaigns.",
      values: { campaigns: number(marketing.campaigns), activeCampaigns: 0 },
    });
  }
  if (number(lasertag.upcomingBookings) === 0) {
    signals.push({
      severity: "medium",
      code: "lasertag_no_upcoming_bookings",
      message: "CombatZone has no upcoming bookings.",
      values: { upcomingBookings: 0, upcomingPlayers: number(lasertag.upcomingPlayers) },
    });
  }
  if (number(academy.publishedCourses) > 0 && number(academy.enrolledCourses) <= 1) {
    signals.push({
      severity: "info",
      code: "academy_low_enrollment",
      message: "Academy has published courses but low enrollment.",
      values: {
        publishedCourses: number(academy.publishedCourses),
        enrolledCourses: number(academy.enrolledCourses),
      },
    });
  }

  const severityOrder = { high: 0, medium: 1, info: 2 };
  return signals.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]).slice(0, 8);
}

function compactValue(value: any, depth = 0): any {
  if (depth > 2) return undefined;
  if (Array.isArray(value)) return value.slice(0, 4).map(item => compactValue(item, depth + 1));
  if (!value || typeof value !== "object") return value;
  const result: UnknownRecord = {};
  let kept = 0;
  for (const [key, item] of Object.entries(value)) {
    if (key === "generatedAt" || key === "httpStatus") continue;
    if (depth === 0 && !IMPORTANT_KEY.test(key)) continue;
    const compacted = compactValue(item, depth + 1);
    if (compacted === undefined) continue;
    result[key] = compacted;
    kept += 1;
    if (kept >= 14) break;
  }
  return result;
}

export function compactOwnerSnapshot(snapshot: UnknownRecord) {
  const systems: UnknownRecord = {};
  for (const product of PRODUCTS) {
    const businessMetrics = compactValue(snapshot?.business?.[product]?.metrics || {});
    const platformMetrics = compactValue(snapshot?.platform?.[product]?.metrics || {});
    const platformExtra = Object.fromEntries(
      Object.entries(platformMetrics).filter(([key]) => !(key in businessMetrics)),
    );
    systems[product] = {
      connection: snapshot?.connections?.[product]?.status || "unknown",
      metrics: businessMetrics,
      ...(Object.keys(platformExtra).length ? { platform: platformExtra } : {}),
    };
  }
  return {
    generatedAt: snapshot?.generatedAt || null,
    prioritySignals: buildPrioritySignals(snapshot),
    hubAdmin: compactValue(snapshot?.hubAdmin || {}),
    systems,
  };
}


export function isPriorityBriefRequest(message: string) {
  const normalized = String(message || "").trim().toLowerCase();
  return /\b(attention|priorit(?:y|ies)|focus|urgent|briefing|brief)\b/.test(normalized) ||
    /what\s+(?:do|should)\s+i\s+(?:do|focus)/.test(normalized) ||
    /what\s+needs?\s+my\s+attention/.test(normalized);
}

function formatMetric(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return String(value ?? "");
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(parsed);
}

function formatPrioritySignal(signal: PrioritySignal) {
  const values = signal.values || {};
  switch (signal.code) {
    case "finance_negative_month_net":
      return `Finance: FFPRO month-to-date net is ${formatMetric(values.currentMonthNet)} (income ${formatMetric(values.currentMonthIncome)}; expenses ${formatMetric(values.currentMonthExpenses)}).`;
    case "pos_replenishment_risk":
      return `Inventory: ${formatMetric(values.criticalReplenishmentItems)} item(s) require critical replenishment.`;
    case "pos_delayed_shipments":
      return `Logistics: ${formatMetric(values.delayedShipments)} inbound shipment(s) are delayed.`;
    case "pos_inventory_exceptions":
      return `Inventory: ${formatMetric(values.unresolvedInventoryExceptions)} inventory exception(s) are unresolved.`;
    case "website_followups_due":
      return `Leads: ${formatMetric(values.followUpsDue)} website CRM follow-up(s) are due.`;
    case "tiquet_unread_notifications":
      return `Tiquet: ${formatMetric(values.unreadNotifications)} notification(s) are unread.`;
    case "pos_no_recent_sales":
      return "POS: no sales are recorded in the last 30 days.";
    case "marketing_no_active_campaigns":
      return "Marketing: there are no active campaigns.";
    case "lasertag_no_upcoming_bookings":
      return "CombatZone: there are no upcoming bookings.";
    case "academy_low_enrollment":
      return `Academy: ${formatMetric(values.publishedCourses)} course(s) are published but only ${formatMetric(values.enrolledCourses)} course(s) have enrollment.`;
    default:
      return signal.message;
  }
}

export function formatPriorityBrief(signals: PrioritySignal[], limit = 5) {
  const selected = signals.slice(0, Math.max(1, limit));
  if (!selected.length) return "No priority exceptions are present in the current business snapshot.";
  return selected
    .map((signal, index) => `${index + 1}. ${signal.severity.toUpperCase()} — ${formatPrioritySignal(signal)}`)
    .join("\n");
}
