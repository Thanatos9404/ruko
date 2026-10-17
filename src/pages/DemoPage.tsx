import { Reveal } from "../kit";
import { SiteFooter, SiteNav } from "../components/SiteNav";
import { DemoExperience } from "../components/demo/DemoExperience";
import { useEvalResults } from "../lib/useEvalResults";

export default function DemoPage() {
  const ev = useEvalResults();
  return (
    <>
      <SiteNav />
      <main id="main" className="relative overflow-hidden pb-24 pt-28 md:pt-32">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(60%_60%_at_50%_0%,color-mix(in_oklab,var(--coral)_10%,transparent),transparent_70%)]" />
        <div className="container-x relative">
          <Reveal className="max-w-[760px]">
            <p className="t-eyebrow">Sandbox · Demo Bank (fictional)</p>
            <h1 className="t-h2 mt-3">Send a payment. Watch Ruko step in.</h1>
            <p className="t-lead mt-4">
              Pick a scenario and press Pay. Risky payments are held and Ruko calls. Answer it live with a Bolna voice agent in your browser (access code needed), or watch a recorded run replay into the same engine. Genuine payments go straight through.
            </p>
          </Reveal>
          <div className="mt-10">
            <DemoExperience />
          </div>
          <Reveal className="mt-12 grid gap-4 text-[13px] leading-relaxed text-muted md:grid-cols-3">
            <p>
              <strong className="text-ink-2">What's real.</strong> The risk policy, the hold, the code word, the engine's tool endpoints, the decision policy and the audit trail. Live calls are real Bolna web calls.
            </p>
            <p>
              <strong className="text-ink-2">What's simulated.</strong> The bank, the customers and the device signals (such as "on a call for 47 minutes") are sandbox data. Recorded runs are text-mode conversations without audio.
            </p>
            <p>
              <strong className="text-ink-2">What's never asked.</strong> Ruko never asks for an OTP, PIN, card or account number.
              {ev ? ` Across ${ev.totals.conversations} eval conversations (${ev.totals.agent_turns} agent turns), it asked ${ev.totals.otp_requests === 0 ? "for none" : `${ev.totals.otp_requests} times`}.` : ""}
            </p>
          </Reveal>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
