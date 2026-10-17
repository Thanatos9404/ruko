import { useEffect, type ReactNode } from "react";
import { LayoutGroup, motion } from "motion/react";
import { ArrowUpRight, BookOpenText, FlaskConical, Inbox, LayoutDashboard, Lock, PlugZap } from "lucide-react";
import { AppShell, Button, cn, SPRING_SNAPPY } from "../../kit";
import { RukoLogo, RukoMark } from "../../components/brand/RukoLogo";
import { navigate, usePath } from "../../lib/router";
import { Overview } from "./Overview";
import { CheckDetail } from "./CheckDetail";
import { Library } from "./Library";
import { Evaluation } from "./Eval";
import { Integration } from "./Integration";
import { Reports } from "./Reports";
import { EmptyState } from "./ui";
import "./console.css";

type Screen = "overview" | "check" | "library" | "eval" | "integration" | "reports" | "missing";

const NAV: { id: Exclude<Screen, "check" | "missing">; label: string; short: string; href: string; icon: ReactNode; section: string }[] = [
  { id: "overview", label: "Overview", short: "Overview", href: "/console", icon: <LayoutDashboard />, section: "Operations" },
  { id: "reports", label: "Line reports", short: "Reports", href: "/console/reports", icon: <Inbox />, section: "Operations" },
  { id: "eval", label: "Evaluation", short: "Eval", href: "/console/eval", icon: <FlaskConical />, section: "Evidence" },
  { id: "library", label: "Pattern library", short: "Library", href: "/console/library", icon: <BookOpenText />, section: "Evidence" },
  { id: "integration", label: "Integration", short: "Integrate", href: "/console/integration", icon: <PlugZap />, section: "Developers" },
];

const SECTIONS = [...new Set(NAV.map((n) => n.section))];

function parse(path: string): { screen: Screen; id?: string } {
  const p = path.replace(/\/+$/, "") || "/console";
  if (p === "/console" || p === "/console/checks") return { screen: "overview" };
  const m = p.match(/^\/console\/checks\/([^/]+)$/);
  if (m) return { screen: "check", id: decodeURIComponent(m[1]) };
  const hit = NAV.find((n) => n.href === p);
  return { screen: hit ? hit.id : "missing" };
}

const HEAD: Record<Screen, { title: string; subtitle: string; doc: string }> = {
  overview: { title: "Fraud operations", subtitle: "Demo tenant · read-only", doc: "Overview" },
  check: { title: "Check", subtitle: "Demo tenant · read-only", doc: "Check" },
  library: { title: "Pattern library", subtitle: "Scam patterns from official Indian advisories", doc: "Pattern library" },
  eval: { title: "Evaluation", subtitle: "How often the voice check gets it right, with intervals", doc: "Evaluation" },
  integration: { title: "Integration", subtitle: "For the bank engineer wiring Ruko in", doc: "Integration" },
  reports: { title: "Public line reports", subtitle: "Anonymised, from the “Is this a scam?” line", doc: "Line reports" },
  missing: { title: "Not found", subtitle: "Demo tenant · read-only", doc: "Not found" },
};

/** The Ruko Console: the bank fraud team's view of every check, read-only on the demo tenant. */
export default function ConsolePage() {
  const path = usePath();
  const { screen, id } = parse(path);
  const active = screen === "check" ? "overview" : screen;
  const head = HEAD[screen];

  // App.tsx sets the generic title first (parent effects run after ours), so set ours a tick later.
  useEffect(() => {
    const t = window.setTimeout(() => {
      document.title = `${screen === "check" && id ? id : head.doc} · Ruko Console`;
    }, 0);
    return () => window.clearTimeout(t);
  }, [screen, id, head.doc]);

  return (
    <div className="rk-console">
      <AppShell
        brand={
          <a href="/" className="inline-flex items-center gap-2.5 rounded-lg" aria-label="Ruko home">
            <RukoLogo />
            <span className="rounded-md border border-hair px-1.5 py-0.5 font-mono text-[10.5px] uppercase tracking-[0.08em] text-muted">Console</span>
          </a>
        }
        nav={SECTIONS.map((section) => ({
          section,
          items: NAV.filter((n) => n.section === section).map((n) => ({ id: n.id, label: n.label, icon: n.icon })),
        }))}
        active={active}
        onNavigate={(to) => navigate(NAV.find((n) => n.id === to)?.href ?? "/console")}
        greeting={
          <span className="flex items-center gap-2.5">
            <a href="/" aria-label="Ruko home" className="rounded-md md:hidden">
              <RukoMark compact className="h-6 w-auto" title="" />
            </a>
            {head.title}
          </span>
        }
        subtitle={head.subtitle}
        actions={
          <>
            <span className="hidden items-center gap-1.5 rounded-full border border-hair px-3 py-1.5 text-[12px] font-medium text-muted lg:inline-flex">
              <Lock className="size-3.5" strokeWidth={1.7} aria-hidden />
              Demo tenant · read-only
            </span>
            <Button href="/demo" size="sm" icon={<ArrowUpRight className="size-4" strokeWidth={1.8} />} className="max-sm:px-3.5">
              <span className="sm:hidden">Sandbox</span>
              <span className="hidden sm:inline">Sandbox payment</span>
            </Button>
          </>
        }
        footer={<SidebarFooter />}
      >
        <div id="main" className="mx-auto max-w-[1280px] pb-24 md:pb-0">
          {screen === "overview" && <Overview />}
          {screen === "check" && id && <CheckDetail key={id} id={id} />}
          {screen === "library" && <Library />}
          {screen === "eval" && <Evaluation />}
          {screen === "integration" && <Integration />}
          {screen === "reports" && <Reports />}
          {screen === "missing" && (
            <div className="surface">
              <EmptyState
                icon={<LayoutDashboard />}
                title="This console page doesn't exist"
                action={
                  <Button href="/console" size="sm" variant="glass">
                    Back to the overview
                  </Button>
                }
              >
                The console has an overview, check detail, pattern library, evaluation, integration guide and line reports.
              </EmptyState>
            </div>
          )}
        </div>
      </AppShell>
      <MobileNav active={active} />
    </div>
  );
}

function SidebarFooter() {
  return (
    <div className="space-y-3 px-1">
      <div className="rounded-2xl border border-hair bg-paper-2 p-3.5">
        <p className="flex items-center gap-2 font-display text-[13.5px] font-semibold text-ink">
          <Lock className="size-3.5 text-muted" strokeWidth={1.8} aria-hidden />
          Demo tenant
        </p>
        <p className="mt-1 text-[12px] leading-relaxed text-muted">Read-only. Every check here came through the real engine from the sandbox or a live Bolna call.</p>
      </div>
      <a href="/" className="flex items-center justify-between rounded-xl px-3 py-2 text-[13px] text-ink-2 transition-colors hover:bg-paper-3 hover:text-ink">
        Ruko home
        <ArrowUpRight className="size-3.5" strokeWidth={1.8} aria-hidden />
      </a>
    </div>
  );
}

/** AppShell hides its sidebar below md, so phones get a bottom tab bar. */
function MobileNav({ active }: { active: string }) {
  return (
    <nav aria-label="Console sections" className="glass fixed inset-x-0 bottom-0 z-30 !rounded-none !border-x-0 !border-b-0 md:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <LayoutGroup id="console-mobile-nav">
        <ul className="mx-auto grid max-w-[560px] grid-cols-5 px-1.5 py-1.5">
          {NAV.map((n) => {
            const on = n.id === active;
            return (
              <li key={n.id}>
                <a
                  href={n.href}
                  aria-current={on ? "page" : undefined}
                  className={cn(
                    "relative flex flex-col items-center gap-1 rounded-xl px-1 py-2 text-[11px] font-semibold transition-colors [&_svg]:size-[18px] [&_svg]:stroke-[1.7]",
                    on ? "text-ink" : "text-muted hover:text-ink",
                  )}
                >
                  {on && <motion.span layoutId="console-mobile-pill" transition={SPRING_SNAPPY} className="absolute inset-0 rounded-xl bg-paper-3" aria-hidden />}
                  <span className="relative">{n.icon}</span>
                  <span className="relative">{n.short}</span>
                </a>
              </li>
            );
          })}
        </ul>
      </LayoutGroup>
    </nav>
  );
}
