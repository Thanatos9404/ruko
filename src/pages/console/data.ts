import { ApiError, type ConsoleOverview } from "../../lib/api";
import type { Check } from "../../../shared/types";

/**
 * Console reads with a tenant switch. The shared api helpers only know the demo
 * bank; the server also serves the public sandbox's checks as their own tenant.
 */
export type TenantView = "bank" | "sandbox";

export const TENANT_LABEL: Record<TenantView, string> = { bank: "Demo bank", sandbox: "Sandbox" };

async function get<T>(path: string): Promise<T> {
  const res = await fetch(path);
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    const err = (data as { error?: { message?: string; code?: string } } | null)?.error;
    throw new ApiError(err?.message ?? `Request failed (${res.status})`, res.status, err?.code ?? "error");
  }
  return data as T;
}

const q = (t: TenantView) => (t === "sandbox" ? "tenant=sandbox" : "");

export const consoleData = {
  overview: (t: TenantView) => get<ConsoleOverview>(`/api/console/overview${t === "sandbox" ? `?${q(t)}` : ""}`),
  checks: (t: TenantView, limit = 60) => get<{ data: Check[] }>(`/api/console/checks?limit=${limit}${t === "sandbox" ? `&${q(t)}` : ""}`),
};

/** Where a check came from. Older checks predate the field. */
export function originOf(c: Check): "api" | "sandbox" | "eval-replay" | null {
  const o = (c as Check & { origin?: string }).origin;
  return o === "api" || o === "sandbox" || o === "eval-replay" ? o : null;
}
