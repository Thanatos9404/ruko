import type { KV } from "./store/store.js";
import type { CheckService, StoredCheck } from "./engine/checks.js";
import seed from "./data/seed-checks.json" with { type: "json" };

/**
 * Populates the demo bank's console with eval conversations that were replayed
 * through the real engine (synthetic customers, origin "eval-replay"). Built by
 * eval/seed-build.ts from the published eval runs. Written once per store, so a
 * fresh deployment shows a realistic, honest mix instead of an empty console or
 * sandbox debris.
 */
export const SEED_VERSION = (seed as { version: string }).version;

export async function ensureSeeded(checks: CheckService, kv: KV, tenant: string): Promise<number> {
  const flag = `seed:${tenant}:${SEED_VERSION}`;
  if (await kv.get(flag)) return 0;
  // Set the flag first so concurrent requests don't double-seed.
  await kv.set(flag, 1, 14 * 24 * 3600);
  const list = (seed as { checks: StoredCheck[] }).checks;
  for (const c of list) await kv.set(`check:${c.id}`, { ...c, tenant }, 14 * 24 * 3600);
  const idxKey = `index:${tenant}`;
  const existing = (await kv.get<string[]>(idxKey)) ?? [];
  const ids = [...list.map((c) => c.id).reverse(), ...existing.filter((id) => !list.some((c) => c.id === id))];
  await kv.set(idxKey, ids.slice(0, 300), 14 * 24 * 3600);
  void checks;
  return list.length;
}
