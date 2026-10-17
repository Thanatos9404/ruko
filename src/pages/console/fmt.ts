/** Formatting helpers for the console. Money and phone helpers live in shared/format.ts. */

const IST = "Asia/Kolkata";

export function clockTime(iso: string | undefined, withSeconds = false): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: withSeconds ? "2-digit" : undefined,
    hour12: false,
    timeZone: IST,
  }).format(d);
}

export function dateTime(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: IST,
  }).format(d);
}

export function shortDate(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: IST }).format(d);
}

/** "just now", "42 s ago", "6 min ago", "3 h ago", "2 d ago". */
export function ago(iso: string | number | undefined, now = Date.now()): string {
  if (iso === undefined) return "";
  const t = typeof iso === "number" ? iso : Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 5) return "just now";
  if (s < 60) return `${s} s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
}

/** Human duration from seconds: "0.4 s", "42 s", "1 m 05 s", "2 h 10 m". */
export function duration(sec: number | null | undefined): string {
  if (sec === null || sec === undefined || Number.isNaN(sec)) return "–";
  if (sec < 1) return `${sec < 0.1 ? "<0.1" : sec.toFixed(1)} s`;
  if (sec < 60) return `${Math.round(sec)} s`;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  if (m < 60) return `${m} m ${String(s).padStart(2, "0")} s`;
  const h = Math.floor(m / 60);
  return `${h} h ${String(m % 60).padStart(2, "0")} m`;
}

/** Offset from the check's creation, for the audit trail: "+0.04 s", "+12.3 s", "+1:05". */
export function offset(fromIso: string, atIso: string): string {
  const ms = Date.parse(atIso) - Date.parse(fromIso);
  if (Number.isNaN(ms)) return "";
  const sec = Math.max(0, ms / 1000);
  if (sec < 10) return `+${sec.toFixed(2)} s`;
  if (sec < 60) return `+${sec.toFixed(1)} s`;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  if (m < 60) return `+${m}:${String(s).padStart(2, "0")}`;
  return `+${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")} m`;
}

export function pct(rate: number | null | undefined, digits = 1): string {
  if (rate === null || rate === undefined || Number.isNaN(rate)) return "–";
  const v = rate * 100;
  if (v === 0 || v === 100) return `${v.toFixed(0)}%`;
  return `${v.toFixed(digits)}%`;
}

export function int(n: number | null | undefined): string {
  if (n === null || n === undefined) return "–";
  return new Intl.NumberFormat("en-IN").format(n);
}

export function usd(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "–";
  return `$${(cents / 100).toFixed(2)}`;
}

/** "coached_on_call" → "Coached on call". */
export function humanize(id: string): string {
  const s = id.replace(/[_-]+/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export const LANG_NAME: Record<string, string> = {
  en: "English",
  hi: "Hindi",
  hinglish: "Hinglish",
  ta: "Tamil",
  bn: "Bengali",
  mr: "Marathi",
};
