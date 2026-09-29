type UnknownRecord = Record<string, any>;

const PRODUCTS = ["pos","ffpro","tiquet","marketing","academy","lasertag","website","games"] as const;

function stripVolatile(value: any): any {
  if (Array.isArray(value)) return value.map(stripVolatile);
  if (!value || typeof value !== "object") return value;
  const result: UnknownRecord = {};
  for (const [key, item] of Object.entries(value)) {
    if (key === "generatedAt" || key === "httpStatus") continue;
    result[key] = stripVolatile(item);
  }
  return result;
}

export function compactOwnerSnapshot(snapshot: UnknownRecord) {
  const systems: UnknownRecord = {};
  for (const product of PRODUCTS) {
    const businessMetrics = stripVolatile(snapshot?.business?.[product]?.metrics || {});
    const platformMetrics = stripVolatile(snapshot?.platform?.[product]?.metrics || {});
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
    hubAdmin: stripVolatile(snapshot?.hubAdmin || {}),
    systems,
  };
}
