export const ACADEMY_ADMIN_API = "/api/admin/academy";

export async function academyAdminApi<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${ACADEMY_ADMIN_API}${path}`, {
    ...options,
    cache: "no-store",
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload?.error || `Academy request failed (${response.status})`;
    const details = Array.isArray(payload?.details) ? "\n" + payload.details.join("\n") : "";
    throw new Error(message + details);
  }
  return payload as T;
}
