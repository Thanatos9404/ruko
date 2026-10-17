import { Nav } from "../kit";
import { RukoLogo } from "./brand/RukoLogo";

export function SiteNav() {
  return (
    <Nav
      brand={<RukoLogo />}
      links={[
        { label: "How it works", href: "/#how" },
        { label: "Results", href: "/#results" },
        { label: "Built on Bolna", href: "/#bolna" },
        { label: "Is this a scam?", href: "/check" },
      ]}
      cta={{ label: "Try the sandbox", href: "/demo" }}
    />
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-hair bg-paper">
      <div className="container-x grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <RukoLogo />
          <p className="mt-4 max-w-[38ch] text-[14px] leading-relaxed text-ink-2">
            Ruko holds a risky payment and calls the customer in their language, using a Bolna voice agent, before the money leaves. Built for the Bolna × YC Symphony Buildathon, Oct 2026.
          </p>
          <p className="mt-4 text-[12.5px] text-muted">Logo concept by Yashvardhan Thanvi. Code under the MIT licence.</p>
        </div>
        <div>
          <p className="t-eyebrow mb-4">Product</p>
          <ul className="space-y-2.5 text-[14px] text-ink-2">
            <li><a className="hover:text-ink" href="/demo">Sandbox payment</a></li>
            <li><a className="hover:text-ink" href="/check">Is this a scam? (free)</a></li>
            <li><a className="hover:text-ink" href="/console">Fraud-ops console</a></li>
            <li><a className="hover:text-ink" href="/console/eval">Evaluation</a></li>
          </ul>
        </div>
        <div>
          <p className="t-eyebrow mb-4">If it's happening now</p>
          <ul className="space-y-2.5 text-[14px] text-ink-2">
            <li>Call <strong className="text-ink">1930</strong>, the national cyber crime helpline</li>
            <li><a className="hover:text-ink underline-offset-2 hover:underline" href="https://cybercrime.gov.in" target="_blank" rel="noreferrer">cybercrime.gov.in</a></li>
            <li><a className="hover:text-ink underline-offset-2 hover:underline" href="https://sancharsaathi.gov.in/sfc/" target="_blank" rel="noreferrer">Report a fraud call on Chakshu</a></li>
          </ul>
        </div>
      </div>
      <div className="container-x border-t border-hair py-5 text-[12px] text-muted">
        Demo Bank is fictional. People, payees and numbers in the demo are invented; phone numbers use the reserved UK drama range. Ruko is not affiliated with Bolna, RBI, NPCI or any bank.
      </div>
    </footer>
  );
}
