import { motion, useReducedMotion } from "motion/react";
import { ArrowDown, ArrowRight } from "lucide-react";
import { Button, CTASection, EASE, Magnetic, Marquee, Reveal, SmoothScroll, WordReveal } from "../kit";
import { SiteFooter, SiteNav } from "../components/SiteNav";
import { RukoIntro } from "../components/brand/RukoLogo";
import { Arcs } from "../components/Arcs";
import { DemoExperience } from "../components/demo/DemoExperience";
import { useEvalResults } from "../lib/useEvalResults";
import { BuiltOnBolna, Business, FreeChecker, HowItWorks, Problem, Results } from "./landing/sections";

function Hero() {
  const reduce = useReducedMotion();
  const ev = useEvalResults();
  const fresh = ev?.current.find((r) => r.clean_holdout);
  const after = (d: number) => ({
    initial: reduce ? { opacity: 0 } : { opacity: 0, y: 12, filter: "blur(6px)" },
    animate: { opacity: 1, y: 0, filter: "blur(0px)" },
    transition: { duration: 0.6, ease: EASE, delay: reduce ? 0 : d },
  });
  return (
    <section id="top" className="relative isolate overflow-hidden pb-16 pt-28 md:pt-32">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(50%_45%_at_50%_30%,color-mix(in_oklab,var(--coral)_12%,transparent),transparent_70%)]" />
      <Arcs className="-z-10 opacity-60 [mask-image:linear-gradient(to_bottom,transparent,black_40%,black)]" />
      <div className="container-x flex flex-col items-center text-center">
        <motion.div {...after(0)} className="glass mb-6 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 font-display text-[13px] font-medium text-ink-2">
          <span className="size-1.5 rounded-full bg-[var(--coral)]" aria-hidden />
          Bolna × YC Symphony Buildathon · voice AI for payment safety
        </motion.div>
        <RukoIntro className="w-[min(230px,52vw)] text-ink" />
        <WordReveal text="Stop the scam before the money *leaves.*" className="t-hero mt-8 max-w-[18ch]" delay={1.9} gap={0.06} />
        <motion.p {...after(2.4)} className="t-lead mt-6 max-w-[58ch]">
          When a payment looks coached, Ruko holds it and a Bolna voice agent calls the customer in their language, names the scam out loud, and stops the money.
        </motion.p>
        <motion.div {...after(2.6)} className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Magnetic>
            <Button href="#demo" size="lg" icon={<ArrowDown size={17} strokeWidth={1.8} />}>
              Watch it stop a scam
            </Button>
          </Magnetic>
          <Button href="/check" size="lg" variant="glass">
            Is this a scam? Free check
          </Button>
        </motion.div>
        <motion.a {...after(2.8)} href="#results" className="mt-10 grid w-full max-w-[640px] grid-cols-3 divide-x divide-[var(--hair)] rounded-2xl border border-hair bg-paper-2/60 py-4 backdrop-blur transition hover:border-[var(--hair-strong)]">
          {[
            [fresh ? `${fresh.scam_catch.k}/${fresh.scam_catch.n}` : "–", "scams caught (held-out)"],
            [fresh ? `${fresh.false_hold.k}/${fresh.false_hold.n}` : "–", "genuine payments held"],
            [ev ? String(ev.totals.otp_requests) : "–", "OTPs ever asked for"],
          ].map(([n, l]) => (
            <span key={l} className="px-3">
              <span className="t-num block text-[24px] text-ink">{n}</span>
              <span className="block text-[12px] leading-tight text-muted">{l}</span>
            </span>
          ))}
        </motion.a>
        <motion.p {...after(2.9)} className="mt-2 text-[11.5px] text-muted">
          Text-mode evaluation; see Results for how it was measured.
        </motion.p>
      </div>
    </section>
  );
}

function DemoSection() {
  return (
    <section id="demo" className="relative scroll-mt-20 pb-10 pt-8">
      <div className="container-x">
        <Reveal className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-[640px]">
            <p className="t-eyebrow mb-3">Try it · Demo Bank (fictional)</p>
            <h2 className="t-h2">Press Pay. Watch Ruko step in.</h2>
          </div>
          <a href="/demo" className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-ink-2 hover:text-ink">
            Full sandbox <ArrowRight size={15} />
          </a>
        </Reveal>
        <DemoExperience compact scenarios={["digital-arrest", "investment-group", "flat-deposit", "rent"]} />
      </div>
    </section>
  );
}

export default function Landing() {
  return (
    <SmoothScroll>
      <SiteNav />
      <main id="main">
        <Hero />
        <DemoSection />
        <div className="py-12">
          <Marquee
            items={[
              "Bolna voice agents",
              "Bolna Web Call SDK",
              "Bolna custom functions",
              "Sarvam (via Bolna)",
              "ElevenLabs (via Bolna)",
              "Deepgram (via Bolna)",
              "gpt-4.1-mini (via Bolna)",
              "Nebius Token Factory (eval and checker)",
              "Vercel",
              "Official advisories: MHA · I4C · RBI · CERT-In · DoT · SEBI · NPCI",
            ]}
          />
        </div>
        <Problem />
        <HowItWorks />
        <Results />
        <BuiltOnBolna />
        <Business />
        <FreeChecker />
        <CTASection
          title={<>Wait, before the money <span className="t-serif">leaves.</span></>}
          lead="Ruko is open source under MIT. Banks and payment apps: the API is ready for a pilot."
          action={
            <div className="flex flex-wrap justify-center gap-3">
              <Button href="/demo" size="lg" icon={<ArrowRight size={17} />}>
                Open the sandbox
              </Button>
              <Button href="/console" size="lg" variant="glass">
                Fraud-ops console
              </Button>
            </div>
          }
        />
      </main>
      <SiteFooter />
    </SmoothScroll>
  );
}
