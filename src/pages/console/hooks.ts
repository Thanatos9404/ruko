import { useCallback, useEffect, useRef, useState } from "react";

export interface Resource<T> {
  data: T | null;
  error: Error | null;
  loading: boolean;
  /** When the last successful response arrived. */
  updatedAt: number | null;
  reload: () => void;
}

/**
 * Fetches once, and again every `intervalMs` while the tab is visible. Keeps the
 * last good data on a failed refresh, so a blip shows a banner instead of a blank.
 */
export function useResource<T>(fetcher: () => Promise<T>, deps: unknown[], intervalMs?: number | null): Resource<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [nonce, setNonce] = useState(0);
  const fetchRef = useRef(fetcher);
  fetchRef.current = fetcher;

  useEffect(() => {
    let alive = true;
    let timer: number | undefined;
    let inFlight = false;
    const run = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const d = await fetchRef.current();
        if (!alive) return;
        setData(d);
        setError(null);
        setUpdatedAt(Date.now());
      } catch (e) {
        if (alive) setError(e instanceof Error ? e : new Error(String(e)));
      } finally {
        inFlight = false;
        if (alive) setLoading(false);
      }
    };
    setLoading(true);
    void run();
    if (intervalMs) {
      timer = window.setInterval(() => {
        if (document.visibilityState === "visible") void run();
      }, intervalMs);
    }
    return () => {
      alive = false;
      if (timer) window.clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, intervalMs, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { data, error, loading, updatedAt, reload };
}

/** A clock that ticks, for "12 s ago" labels. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(t);
  }, [intervalMs]);
  return now;
}

/** Static JSON from /public (the eval results). */
export async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok) throw new Error(res.status === 404 ? `${url} has not been published yet.` : `Couldn't load ${url} (${res.status}).`);
  return (await res.json()) as T;
}

/** Copies text, falling back to a hidden textarea where the async API is blocked. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}

/** One query-string value that follows pushState/popstate (usePath only tracks the pathname). */
export function useSearchParam(name: string): string | null {
  const read = useCallback(() => new URLSearchParams(window.location.search).get(name), [name]);
  const [value, setValue] = useState(read);
  useEffect(() => {
    const on = () => setValue(read());
    window.addEventListener("popstate", on);
    return () => window.removeEventListener("popstate", on);
  }, [read]);
  return value;
}
