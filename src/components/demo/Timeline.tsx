import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Activity, BookOpenCheck, CircleCheck, Gavel, PhoneCall, PhoneForwarded, ShieldAlert, ShieldCheck, Users } from "lucide-react";
import type { ReactNode } from "react";
import type { AppStatus, AuditEvent } from "../../../shared/types";
import { signalDef } from "../../../shared/signals";
import { cn, EASE } from "../../kit";

type Tone = "neutral" | "accent" | "go" | "stop";

interface Row {
  key: string;
  t: number;
  tool?: string;
  icon: ReactNode;
  title: string;
  detail?: string;
  tone: Tone;
}

const toneCls: Record<Tone, string> = {
  neutral: "text-ink-2 border-hair",
  accent: "text-accent border-[color-mix(in_oklab,var(--accent)_40%,transparent)]",
  go: "text-go border-[color-mix(in_oklab,var(--go)_40%,transparent)]",
  stop: "text-stop border-[color-mix(in_oklab,var(--stop)_40%,transparent)]",
};

function rows(status: AppStatus): Row[] {
  const t0 = Date.parse(status.created_at);
  const out: Row[] = [];
  let sigIdx = 0;
  status.events.forEach((e: AuditEvent, i) => {
    const t = Math.max(0, (Date.parse(e.at) - t0) / 1000);
    const key = `${e.type}-${i}`;
    switch (e.type) {
      case "check.created":
        out.push({
          key,
          t,
          icon: <ShieldAlert />,
          title: `Payment held · risk ${status.risk.score}/100`,
          detail: status.risk.reasons.filter((r) => r.weight > 0).slice(0, 3).map((r) => r.title).join(" · "),
          tone: "accent",
        });
        break;
      case "call.updated":
        if (/queued/.test(e.detail) && /web/.test(e.detail)) out.push({ key, t, icon: <PhoneCall />, title: "Bolna web call started", tone: "neutral" });
        else if (/text-eval in-progress/.test(e.detail)) out.push({ key, t, icon: <PhoneCall />, title: "Recorded conversation started", tone: "neutral" });
        break;
      case "call.retry":
        out.push({ key, t, icon: <PhoneCall />, title: "No answer · retrying once", detail: "The app tells the customer their bank is calling.", tone: "accent" });
        break;
      case "context.read":
        out.push({ key, t, tool: "get_check_context", icon: <BookOpenCheck />, title: "Agent read the check", tone: "neutral" });
        break;
      case "signal.recorded": {
        const s = status.signals[sigIdx++];
        if (!s) break;
        const def = signalDef(s.type);
        const tone: Tone = s.severity === "critical" ? "stop" : s.severity === "high" || s.severity === "medium" ? "accent" : s.severity === "mitigating" ? "go" : "neutral";
        out.push({ key, t, tool: "record_signal", icon: <Activity />, title: def?.label ?? s.type, detail: `“${s.evidence}”`, tone });
        break;
      }
      case "contact.updated":
        out.push({
          key,
          t,
          tool: "call_trusted_contact",
          icon: <PhoneForwarded />,
          title: /ringing_web|dialing/.test(e.detail)
            ? "Calling the trusted contact"
            : /simulated/.test(e.detail)
              ? "Trusted contact call (simulated in the recorded run)"
              : e.detail.replace(/_/g, " "),
          tone: "neutral",
        });
        break;
      case "contact.outcome":
        out.push({ key, t, icon: <Users />, title: "Trusted contact answered", detail: e.detail, tone: /Concern: yes|Knew about payment: no/.test(e.detail) ? "stop" : "go" });
        break;
      case "agent.recommendation":
        out.push({ key, t, tool: "set_decision", icon: <Gavel />, title: e.detail.split(":")[0], detail: e.detail.split(":").slice(1).join(":").trim(), tone: "neutral" });
        break;
      case "decision.made":
      case "decision.updated": {
        // "Hold expired; policy applied: block." and "delay → block (…)" both name the outcome in words.
        const applied = e.detail.match(/policy applied:\s*(block|release|delay)/i)?.[1]?.toLowerCase();
        const head = (e.detail.split(":")[0].split("→").pop() ?? "").trim();
        const outc = (applied ?? head.match(/(block|release|delay)/gi)?.pop()?.toLowerCase() ?? "delay") as "block" | "release" | "delay";
        out.push({
          key,
          t,
          icon: outc === "release" ? <ShieldCheck /> : <CircleCheck />,
          title: `Policy: ${outc.toUpperCase()}${e.type === "decision.updated" ? " (updated)" : ""}`,
          detail: e.detail.split(": ").slice(1).join(": ").replace(/_/g, " ").toLowerCase(),
          tone: outc === "release" ? "go" : outc === "block" ? "stop" : "accent",
        });
        break;
      }
    }
  });
  return out;
}

/** The engine's live view of a check: every tool call and policy step as it lands, with real timings. */
export function Timeline({ status, className, hideCreated = false }: { status: AppStatus | null; className?: string; hideCreated?: boolean }) {
  const reduce = useReducedMotion();
  const list = (status ? rows(status) : []).filter((r) => !(hideCreated && r.key.startsWith("check.created")));
  return (
    <ol className={cn("relative space-y-2", className)} aria-live="polite" aria-label="Engine timeline">
      {!list.length && <li className="text-[13px] text-muted">{status ? "Waiting for the call to start…" : "Waiting for a payment…"}</li>}
      <AnimatePresence initial={false}>
        {list.map((r) => (
          <motion.li
            key={r.key}
            layout={!reduce}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.5, ease: EASE }}
            className="flex gap-3"
          >
            <span className={cn("mt-0.5 grid size-7 shrink-0 place-items-center rounded-full border bg-surface [&>svg]:size-3.5 [&>svg]:stroke-[1.8]", toneCls[r.tone])}>{r.icon}</span>
            <div className="min-w-0 flex-1 border-b border-hair pb-2">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className={cn("text-[13.5px] font-semibold", r.tone === "neutral" ? "text-ink" : toneCls[r.tone].split(" ")[0])}>{r.title}</span>
                {r.tool && <code className="font-mono text-[11px] text-muted">{r.tool}()</code>}
                <span className="ml-auto font-mono text-[11px] tabular-nums text-muted">+{r.t.toFixed(1)}s</span>
              </div>
              {r.detail && <p className="mt-0.5 line-clamp-2 text-[12.5px] leading-snug text-ink-2">{r.detail}</p>}
            </div>
          </motion.li>
        ))}
      </AnimatePresence>
    </ol>
  );
}
