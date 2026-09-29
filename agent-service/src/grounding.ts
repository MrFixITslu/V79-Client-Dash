type UnknownRecord = Record<string, any>;

const PRODUCTS = ["pos","ffpro","tiquet","marketing","academy","lasertag","website","games"] as const;
const IMPORTANT_KEY = /(status|health|error|fail|risk|exception|overdue|pending|open|critical|stock|reorder|shipment|ticket|booking|player|lead|campaign|revenue|sale|income|expense|cash|balance|profit|enroll|student|course|session|usage|completion|mastered|view|sync|total|count|user|app|tenant)/i;

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
      ...(Object.keys(platformExtra).length ? { extra: platformExtra } : {}),
    };
  }
  return {
    generatedAt: snapshot?.generatedAt || null,
    hubAdmin: compactValue(snapshot?.hubAdmin || {}),
    systems,
  };
}
