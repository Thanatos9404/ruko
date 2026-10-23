import { motion, useReducedMotion, useScroll, useSpring, useTransform } from "motion/react";
import { ArrowDown, ArrowRight } from "lucide-react";
import { useRef, useState } from "react";
import { Button, EASE, Magnetic, Marquee, Reveal, SmoothScroll, WordReveal } from "../kit";
import { SiteFooter, SiteNav } from "../components/SiteNav";
import { RukoIntro } from "../components/brand/RukoLogo";
import { Arcs } from "../components/Arcs";
import { StopLine } from "../components/brand/StopLine";
import { RealCallPlayer, useRealCall } from "../components/RealCallPlayer";
import { DemoExperience } from "../components/demo/DemoExperience";
import { useEvalResults } from "../lib/useEvalResults";
import { BuiltOnBolna, Business, FreeChecker, HowItWorks, Problem, Results } from "./landing/sections";

function Hero() {
  const reduce = useReducedMotion();
  const ev = useEvalResults();
  const fresh = ev?.current.find((r) => r.clean_holdout);
  // On phones the logo beat plays alongside the copy instead of before it, so the
  // headline and the buttons are on screen at once.
  const [phone] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches);
  // Copy never waits on the logo beat: everything is on screen within half a second.
  const at = phone ? { word: 0.1, lead: 0.3, cta: 0.4, stats: 0.5, note: 0.5 } : { word: 0.15, lead: 0.3, cta: 0.4, stats: 0.5, note: 0.5 };
  const after = (d: number) => ({
    initial: reduce ? { opacity: 0 } : { opacity: 0, y: 12, filter: "blur(6px)" },
    animate: { opacity: 1, y: 0, filter: "blur(0px)" },
    transition: { duration: phone ? 0.45 : 0.6, ease: EASE, delay: reduce ? 0 : d },
  });
  return (
    <section id="top" className="relative isolate overflow-hidden pb-16 pt-24 md:pt-32">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(50%_45%_at_50%_30%,color-mix(in_oklab,var(--coral)_12%,transparent),transparent_70%)]" />
      <Arcs className="-z-10 opacity-60 [mask-image:linear-gradient(to_bottom,transparent,black_40%,black)]" />
      <div className="container-x flex flex-col items-center text-center">
        <motion.div {...after(0)} className="glass mb-5 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 font-display text-[13px] font-medium text-ink-2 md:mb-6">
          <span className="size-1.5 rounded-full bg-[var(--coral)]" aria-hidden />
          Bolna × YC Symphony Buildathon<span className="hidden sm:inline"> · voice AI for payment safety</span>
        </motion.div>
        <RukoIntro className="w-[clamp(118px,34vw,150px)] text-ink md:w-[230px]" />
        <WordReveal text="Stop the scam before the money *leaves.*" className="t-hero mt-5 max-w-[18ch] md:mt-8" delay={reduce ? 0 : at.word} gap={phone ? 0.035 : 0.06} />
        <motion.p {...after(at.lead)} className="t-lead mt-5 max-w-[58ch] md:mt-6">
          When a payment looks coached, Ruko holds it and a Bolna voice agent calls the customer in their language, names the scam out loud, and stops the money.
        </motion.p>
        <motion.div {...after(at.cta)} className="mt-7 flex flex-wrap items-center justify-center gap-3 md:mt-9">
          <Magnetic>
            <Button href="#demo" size="lg" icon={<ArrowDown size={17} strokeWidth={1.8} />}>
              Watch it stop a scam
            </Button>
          </Magnetic>
          <Button href="/check" size="lg" variant="glass">
            Is this a scam? Free check
          </Button>
        </motion.div>
        <motion.a {...after(at.stats)} href="#results" className="mt-10 grid w-full max-w-[640px] grid-cols-3 divide-x divide-[var(--hair)] rounded-2xl border border-hair bg-paper-2/60 py-4 backdrop-blur transition hover:border-[var(--hair-strong)]">
          {[
            [fresh ? `${fresh.scam_catch.k}/${fresh.scam_catch.n}` : "–", "scams caught (held-out)"],
            [fresh ? `${fresh.false_hold.k}/${fresh.false_hold.n}` : "–", "genuine payments held"],
            [ev ? String((ev.totals_current ?? ev.totals).otp_requests) : "–", `OTP asks in ${ev?.version ?? "current"} evals`],
          ].map(([n, l]) => (
            <span key={l} className="px-3">
              <span className="t-num block text-[24px] text-ink">{n}</span>
              <span className="block text-[12px] leading-tight text-muted">{l}</span>
            </span>
          ))}
        </motion.a>
        <motion.p {...after(at.note)} className="mt-2 text-[11.5px] text-muted">
          Text-mode evaluation; see Results for how it was measured.
        </motion.p>
      </div>
    </section>
  );
}

function DemoSection() {
  // The demo tilts up into place as it scrolls in (REA motion spec: scroll-linked, spring-smoothed).
  const stage = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: stage, offset: ["start end", "start 35%"] });
  const spring = { stiffness: 400, damping: 100, mass: 1 };
  const call = useRealCall();
  const rotateX = useSpring(useTransform(scrollYProgress, [0, 1], [14, 0]), spring);
  const scale = useSpring(useTransform(scrollYProgress, [0, 1], [0.92, 1]), spring);
  const y = useSpring(useTransform(scrollYProgress, [0, 1], [48, 0]), spring);
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
        <div ref={stage} style={{ perspective: 1200 }}>
          <motion.div style={reduce ? undefined : { rotateX, scale, y, transformOrigin: "top center" }}>
            <DemoExperience compact scenarios={["digital-arrest", "investment-group", "flat-deposit", "rent"]} />
          </motion.div>
        </div>
        {call && <RealCallPlayer call={call} className="mt-6" />}
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
        <section aria-labelledby="cta-title" className="relative isolate overflow-hidden border-t border-hair pb-24 pt-16 md:pb-28 md:pt-20">
          <StopLine className="mx-auto h-[120px] w-full max-w-[1200px] md:h-[170px]" />
          <div className="container-x">
            <Reveal className="mx-auto mt-6 max-w-[680px] text-center">
              <h2 id="cta-title" className="t-h2">
                Wait, before the money <span className="t-serif">leaves.</span>
              </h2>
              <p className="t-lead mt-4">Ruko is open source under MIT. Banks and payment apps: the API is ready for a pilot.</p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Button href="/demo" size="lg" icon={<ArrowRight size={17} />}>
                  Open the sandbox
                </Button>
                <Button href="/console" size="lg" variant="glass">
                  Fraud-ops console
                </Button>
              </div>
            </Reveal>
          </div>
        </section>
      </main>
      <SiteFooter />
    </SmoothScroll>
  );
}
