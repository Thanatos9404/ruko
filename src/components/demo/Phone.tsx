import type { ReactNode } from "react";
import { cn } from "../../kit";

/** A phone-sized frame for the sandbox bank app. Purely presentational. */
export function Phone({ children, className, label }: { children: ReactNode; className?: string; label: string }) {
  return (
    <div className={cn("relative mx-auto w-full max-w-[340px]", className)}>
      <div
        role="region"
        aria-label={label}
        className="relative overflow-hidden rounded-[44px] border border-[var(--hair-strong)] bg-[#0a0f18] p-[10px] shadow-[0_50px_120px_-40px_rgba(0,0,0,0.95),0_0_0_1px_rgba(255,255,255,0.03)_inset]"
      >
        <div className="relative h-[620px] overflow-hidden rounded-[34px] bg-[#0e1522]">
          <div aria-hidden className="absolute left-1/2 top-2.5 z-30 h-[22px] w-[92px] -translate-x-1/2 rounded-full bg-black" />
          <div className="relative z-10 flex h-full flex-col">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function StatusBar({ tone = "light" }: { tone?: "light" | "dark" }) {
  return (
    <div className={cn("flex items-center justify-between px-6 pb-1 pt-3 text-[12px] font-semibold tabular-nums", tone === "light" ? "text-ink" : "text-black")} aria-hidden>
      <span>9:41</span>
      <span className="flex items-center gap-1">
        <span className="inline-block h-2 w-3 rounded-[2px] bg-current opacity-80" />
        <span className="inline-block h-2.5 w-5 rounded-[3px] border border-current p-[1px]">
          <span className="block h-full w-3/4 rounded-[1px] bg-current" />
        </span>
      </span>
    </div>
  );
}
