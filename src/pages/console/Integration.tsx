import { useState, type ReactNode } from "react";
import { BellRing, Fingerprint, Gavel, KeyRound, ListChecks, Lock, PauseCircle, PhoneCall, Radio, ShieldCheck, Webhook, Wrench } from "lucide-react";
import { Panel, Reveal, Segmented, cn } from "../../kit";
import { DEMO_SCENARIOS } from "../../../shared/scenarios";
import { CodeBlock } from "./code";
import { Chip, SectionTitle } from "./ui";

/* -------------------------------------------------------------- snippets */

const BOLNA_IPS = ["13.203.39.153", "13.126.9.249", "13.202.133.53"];

function origin(): string {
  return typeof window === "undefined" ? "https://ruko.example" : window.location.origin;
}

/** The request body, built from the sandbox's digital-arrest scenario so it matches what the engine really scores. */
function createBody(): string {
  const sc = DEMO_SCENARIOS.find((s) => s.id === "digital-arrest") ?? DEMO_SCENARIOS[0];
  return JSON.stringify(
    {
      payment: { ...sc.payment, initiated_at: "2026-10-17T10:42:00Z" },
      customer: sc.customer,
      device: sc.device,
    },
    null,
    2,
  );
}

const indent = (s: string, n: number) => s.replace(/\n/g, `\n${" ".repeat(n)}`);

function curlCreate(base: string, body: string) {
  return `curl -X POST ${base}/v1/checks \\
  -H "Authorization: Bearer rk_test_..." \\
  -H "Idempotency-Key: pay_8c41f2" \\
  -H "Content-Type: application/json" \\
  -d '${body}'`;
}

function nodeCreate(base: string, body: string) {
  return `const res = await fetch("${base}/v1/checks", {
  method: "POST",
  headers: {
    Authorization: \`Bearer \${process.env.RUKO_API_KEY}\`,
    "Idempotency-Key": payment.id, // your own payment ID: retries never create a second check
    "Content-Type": "application/json",
  },
  body: JSON.stringify(${indent(body, 2)}),
});
const check = await res.json();
if (check.action === "hold") showHoldScreen(check.code_word, check.id, check.client_secret);
else releasePayment();`;
}

// Shape and values from a real POST /v1/checks against this engine for the body
// above; the reasons list is trimmed to the first two of six, the secret masked.
const CREATE_RESPONSE = `{
  "id": "chk_F43R2DDU98",
  "action": "hold",
  "risk": {
    "score": 100,
    "band": "high",
    "action": "hold",
    "reasons": [
      {
        "code": "ACTIVE_CALL_DURING_PAYMENT",
        "weight": 37,
        "title": "On a call while paying",
        "detail": "A phone call was active on the device during the payment, for 47 minutes, with a number not in the customer's contacts."
      },
      {
        "code": "SAFE_ACCOUNT_PAYEE",
        "weight": 35,
        "hard": true,
        "title": "Payee looks like a 'safe account'",
        "detail": "The payee name \\"Safe Custody Account RBI\\" reads like a custody, verification or agency account."
      }
    ],
    "policy_version": "2026-10-16.1"
  },
  "code_word": "CHANDA 47",
  "client_secret": "cs_••••••••••••",
  "hold_expires_at": "2026-10-17T10:57:00.000Z",
  "links": {
    "self": "/v1/checks/chk_F43R2DDU98",
    "app_status": "/v1/checks/chk_F43R2DDU98/app-status"
  }
}`;

const curlGet = (base: string) => `curl ${base}/v1/checks/chk_F43R2DDU98 \\
  -H "Authorization: Bearer rk_test_..."`;

const curlAppStatus = (base: string) => `# From the customer's app. No tenant key: the per-check client secret only.
curl ${base}/v1/checks/chk_F43R2DDU98/app-status \\
  -H "X-Client-Secret: cs_..."`;

const DECISION_EXCERPT = `{
  "status": "decided",
  "decision": {
    "outcome": "block",
    "reasons": [
      {
        "code": "MULTIPLE_STRONG_SIGNS",
        "text": "2 strong warning signs, including 2 critical: coached on call, authority threat.",
        "signal_ids": ["sig_KMFV85QL", "sig_RNQDQ9J3"]
      }
    ],
    "pattern": { "id": "digital_arrest", "name": "Digital arrest" },
    "agent_recommendation": "block",
    "escalated_over_agent": false,
    "customer_message": "For your safety, this payment is stopped. Your money is safe in your account. If someone has been pressuring you, call 1930.",
    "policy_version": "2026-10-16.1"
  }
}`;

const TOOL_EXCHANGE = (base: string) => `curl -X POST ${base}/v1/bolna/tools/record_signal \\
  -H "Authorization: Bearer $RUKO_TOOL_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"check_id":"chk_F43R2DDU98","signal":"coached_on_call","evidence":"officer on video call","confidence":"high","pattern_hint":"digital_arrest"}'

# 200, read back to the agent mid-call. Once the evidence is enough,
# decide_now is "yes" and the next step comes first:
# { "recorded": true, "decide_now": "yes",
#   "next": "Call set_decision now. Do not ask another question.",
#   "likely_pattern": "Digital arrest",
#   "say_this": "There's no 'digital arrest' in Indian law. Police or CBI never question anyone on a video call.",
#   "tip": "..." }
# Otherwise: { "recorded": true, "decide_now": "no", "ask_next": "...", ... }

curl -X POST ${base}/v1/bolna/tools/set_decision \\
  -H "Authorization: Bearer $RUKO_TOOL_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"check_id":"chk_F43R2DDU98","recommendation":"block","reason":"coached on a video call"}'

# { "final_decision": "block",
#   "tell_customer": "For your safety, this payment is stopped. ...",
#   "pattern": "Digital arrest",
#   "offer_contact": "Shall I call Ravi, your son, so you can talk it over?",
#   "then": "Read tell_customer as it is, then ask offer_contact once. ..." }`;

/* -------------------------------------------------------------------- page */

const STEPS: { icon: ReactNode; title: string; body: string; api: string }[] = [
  {
    icon: <Fingerprint />,
    title: "Score",
    body: "Before releasing a payment, your backend sends it to Ruko. The pre-call policy scores it in milliseconds and answers allow or hold.",
    api: "POST /v1/checks",
  },
  {
    icon: <PauseCircle />,
    title: "Hold",
    body: "On hold, your app shows the one-time code word from the response and polls the check's status with its client secret.",
    api: "GET /v1/checks/:id/app-status",
  },
  {
    icon: <PhoneCall />,
    title: "Call",
    body: "A Bolna voice agent calls the customer within seconds, says the code word first, in English or Hindi. It never asks for an OTP or PIN.",
    api: "Bolna agent",
  },
  {
    icon: <ListChecks />,
    title: "Listen",
    body: "The agent records what it hears as signals, each with an evidence quote and a confidence, and can call a trusted contact with consent.",
    api: "POST /v1/bolna/tools/*",
  },
  {
    icon: <Gavel />,
    title: "Decide",
    body: "A deterministic policy turns the signals into release, delay or block, with reasons. Your backend reads it and acts.",
    api: "GET /v1/checks/:id",
  },
];

const ENDPOINTS: { method: string; path: string; auth: string; what: string }[] = [
  { method: "POST", path: "/v1/checks", auth: "API key", what: "Score a payment; returns allow or hold, and a code word on hold. Honours Idempotency-Key." },
  { method: "GET", path: "/v1/checks/:id", auth: "API key", what: "The full check: risk, call, signals, contact, decision and audit trail." },
  { method: "GET", path: "/v1/checks", auth: "API key", what: "Your tenant's recent checks, newest first (limit up to 200)." },
  { method: "GET", path: "/v1/metrics", auth: "API key", what: "Hold rate, outcomes, money held back and signal counts for your tenant." },
  { method: "GET", path: "/v1/checks/:id/app-status", auth: "Client secret", what: "The minimal status your app polls during a hold. Safe on the device." },
  { method: "POST", path: "/v1/checks/:id/web-session", auth: "Client secret + access code", what: "Mints a Bolna Web Call SDK session server-side, behind the live-call gate." },
  { method: "GET", path: "/v1/patterns", auth: "Public", what: "The scam pattern library and signal taxonomy." },
  { method: "POST", path: "/v1/bolna/tools/:name", auth: "Tool token + Bolna IPs", what: "Custom functions the Bolna agents call mid-conversation." },
  { method: "POST", path: "/v1/bolna/webhook?token=…", auth: "Webhook token + Bolna IPs", what: "Execution status updates; terminal ones are verified with Bolna's API." },
];

const TOOLS: { name: string; agent: string; what: string }[] = [
  { name: "get_check_context", agent: "Check agent", what: "Payment details, why it was held, whether a contact is on file, and the first question to ask." },
  { name: "record_signal", agent: "Check agent", what: "One signal with evidence and confidence. Returns the likely pattern, the sentence to say, and decide_now once the evidence is enough." },
  { name: "call_trusted_contact", agent: "Check agent", what: "Dials the customer's chosen contact, only with their consent on the call." },
  { name: "check_trusted_contact", agent: "Check agent", what: "Whether the contact has been reached yet, if the customer asks." },
  { name: "set_decision", agent: "Check agent", what: "The agent's recommendation. The policy may escalate it, never soften it; the reply says what to tell the customer and offers the trusted contact once." },
  { name: "report_contact_outcome", agent: "Contact agent", what: "What the trusted contact said: knew about it, worried, will call back." },
  { name: "lookup_pattern", agent: "Public line", what: "Matches a caller's story to the library and returns the truth and advice." },
  { name: "log_report", agent: "Public line", what: "Stores an anonymised summary; numbers and emails are scrubbed first." },
];

export function Integration() {
  const base = origin();
  const body = createBody();
  const [lang, setLang] = useState<"curl" | "node">("curl");

  return (
    <div className="space-y-10">
      <Reveal>
        <section className="surface p-5 md:p-7" aria-labelledby="int-intro">
          <p className="t-eyebrow !text-[11px]">For the bank engineer</p>
          <h2 id="int-intro" className="mt-2 max-w-[30ch] font-display text-[24px] font-semibold leading-tight tracking-[-0.02em] text-ink md:text-[28px]">
            One call before the money moves.
          </h2>
          <p className="mt-3 max-w-[72ch] text-[15px] leading-relaxed text-ink-2">
            Ruko sits between your payment switch and the release. Send each payment you'd normally release; most come back <span className="font-semibold text-ink">allow</span> at once. The
            risky ones come back <span className="font-semibold text-ink">hold</span>, and a voice check decides them within about a minute.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Chip>
              Base URL <span className="font-mono text-[11.5px] text-ink">{base}</span>
            </Chip>
            <Chip>JSON over HTTPS</Chip>
            <Chip>Amounts in whole rupees</Chip>
            <Chip>Times in UTC, ISO 8601</Chip>
          </div>
        </section>
      </Reveal>

      <section aria-labelledby="int-flow" className="space-y-4">
        <SectionTitle id="int-flow" eyebrow="The flow" title="Five steps, two of them yours" />
        <Reveal>
          <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {STEPS.map((s, i) => (
              <li key={s.title} className="surface relative flex flex-col p-4">
                <div className="flex items-center justify-between">
                  <span className="grid size-9 place-items-center rounded-full border border-hair bg-paper-2 text-ink [&>svg]:size-4 [&>svg]:stroke-[1.7]">{s.icon}</span>
                  <span className="t-num text-[13px] text-muted">0{i + 1}</span>
                </div>
                <p className="mt-4 font-display text-[15.5px] font-semibold text-ink">{s.title}</p>
                <p className="mt-1.5 flex-1 text-[13px] leading-relaxed text-ink-2">{s.body}</p>
                <code className="mt-3 block truncate rounded-lg bg-paper-2 px-2 py-1 font-mono text-[11px] text-muted" title={s.api}>
                  {s.api}
                </code>
                <span className={cn("mt-3 text-[11.5px] font-semibold", i === 0 || i === 4 ? "text-ink" : "text-muted")}>{i === 0 || i === 4 ? "Your backend" : i === 1 ? "Your app" : "Ruko + Bolna"}</span>
              </li>
            ))}
          </ol>
        </Reveal>
      </section>

      <section aria-labelledby="int-create" className="space-y-4">
        <SectionTitle
          id="int-create"
          eyebrow="Step 1"
          title="Create a check"
          action={
            <Segmented
              id="int-lang"
              value={lang}
              onChange={setLang}
              options={[
                { value: "curl", label: <span className="text-[13px]">curl</span> },
                { value: "node", label: <span className="text-[13px]">Node</span> },
              ]}
            />
          }
        >
          Send the payment, the customer profile your bank already holds, and what the device can see. Never a full account number, never an OTP.
        </SectionTitle>
        <Reveal className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div className="min-w-0 space-y-3">
            <CodeBlock
              code={lang === "curl" ? curlCreate(base, body) : nodeCreate(base, body)}
              lang={lang === "curl" ? "bash" : "js"}
              title={
                <>
                  <span className="rounded bg-paper-3 px-1.5 py-0.5 font-semibold text-ink">POST</span> /v1/checks
                </>
              }
              maxHeight={560}
            />
            <p className="px-1 text-[12.5px] leading-relaxed text-muted">
              Body from the sandbox's digital-arrest scenario. Every person and number is invented; phones use the UK Ofcom drama range (+44 7700 900xxx), which is never assigned.
            </p>
          </div>
          <div className="min-w-0 space-y-3">
            <CodeBlock code={CREATE_RESPONSE} lang="json" title={<span>Response</span>} meta={<span className="font-mono text-[11.5px] text-go">201 Created</span>} maxHeight={560} />
            <ul className="space-y-1.5 px-1 text-[12.5px] leading-relaxed text-muted">
              <li>
                <span className="font-semibold text-ink-2">Idempotency-Key</span>: send the same key again and you get the original response with <code className="kbd">Idempotent-Replayed: true</code>{" "}
                and a 200, never a second check.
              </li>
              <li>
                <span className="font-semibold text-ink-2">Errors</span> are <code className="kbd">{`{"error":{"code","message"}}`}</code>: 400 invalid_request names the field, 401 unauthorized for a missing or unknown key.
              </li>
              <li>Reasons trimmed to two of six here, and the client secret masked.</li>
            </ul>
          </div>
        </Reveal>
      </section>

      <section aria-labelledby="int-read" className="space-y-4">
        <SectionTitle id="int-read" eyebrow="Steps 2 and 5" title="Follow the hold, then act on the decision">
          Your app polls the light status with the client secret. Your backend reads the full check with its API key and releases or stops the payment.
        </SectionTitle>
        <Reveal className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div className="min-w-0 space-y-4">
            <CodeBlock code={curlAppStatus(base)} lang="bash" title={<><span className="rounded bg-paper-3 px-1.5 py-0.5 font-semibold text-ink">GET</span> /v1/checks/:id/app-status</>} />
            <CodeBlock code={curlGet(base)} lang="bash" title={<><span className="rounded bg-paper-3 px-1.5 py-0.5 font-semibold text-ink">GET</span> /v1/checks/:id</>} />
          </div>
          <CodeBlock code={DECISION_EXCERPT} lang="json" title={<span>Decision, excerpt</span>} meta={<span className="font-mono text-[11.5px] text-go">200 OK</span>} className="min-w-0" />
        </Reveal>
        <Reveal>
          <Panel title="Decision policy, in order" description="Deterministic and explained. The voice agent labels what it hears; this policy decides. The agent can make an outcome stricter, never more lenient.">
            <ol className="mt-1 list-decimal space-y-2 pl-5 text-[13.5px] leading-relaxed text-ink-2">
              <li>Nobody answered: retry once, then <b className="text-ink">delay</b> with an in-app confirm; high-risk holds go to the fraud desk. Never block someone we couldn't talk to.</li>
              <li>The customer asks to cancel: <b className="text-ink">block</b>.</li>
              <li>A critical warning sign (coached on a call, authority threat, secrecy, remote access) plus another strong sign: <b className="text-ink">block</b>.</li>
              <li>One critical sign: <b className="text-ink">delay 24 h</b>. Two high signs, or one with nothing to offset it: <b className="text-ink">delay 4 h</b>.</li>
              <li>The assistant matched a known scam pattern but heard no confirming sign: <b className="text-ink">delay</b> (PATTERN_SUSPECTED).</li>
              <li>
                <b className="text-ink">Safe default.</b> Critical pre-call risk (a hard rule such as a "safe account" payee, the customer on a call while paying, or a very large payment to a first-time payee) releases only on positive evidence: the customer checked the payee themselves, or knows the payee personally and the purpose fits. Otherwise <b className="text-ink">delay</b> with an in-app confirm, a call-back and the fraud desk (SAFE_DEFAULT_CRITICAL_RISK). A cover story alone never releases.
              </li>
              <li>The trusted contact raising a concern escalates; their confirmation can lift a delay that had no critical sign.</li>
            </ol>
          </Panel>
        </Reveal>
        <Reveal>
          <Panel title="Endpoints" className="!p-0 [&>div:first-child]:px-5 [&>div:first-child]:pt-5 md:[&>div:first-child]:px-6 md:[&>div:first-child]:pt-6">
            <div className="rk-scroll-x relative hidden overflow-x-auto lg:block">
              <table className="w-full border-collapse text-left">
                <caption className="sr-only">Ruko API endpoints</caption>
                <thead>
                  <tr className="border-y border-hair text-[11px] uppercase tracking-[0.08em] text-muted [&>th]:px-3 [&>th]:py-2.5 [&>th]:font-mono [&>th]:font-normal">
                    <th scope="col" className="!pl-6">
                      Endpoint
                    </th>
                    <th scope="col">Auth</th>
                    <th scope="col" className="!pr-6">
                      What it does
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {ENDPOINTS.map((e) => (
                    <tr key={e.method + e.path} className="border-b border-hair align-top text-[13.5px] last:border-b-0 [&>td]:px-3 [&>td]:py-3">
                      <td className="!pl-6">
                        <span className="inline-flex items-center gap-2 whitespace-nowrap font-mono text-[12.5px]">
                          <span className={cn("w-11 font-semibold", e.method === "GET" ? "text-ink-2" : "text-ink")}>{e.method}</span>
                          <span className="text-ink">{e.path}</span>
                        </span>
                      </td>
                      <td className="whitespace-nowrap text-ink-2">{e.auth}</td>
                      <td className="!pr-6 leading-relaxed text-muted">{e.what}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="divide-y divide-[var(--hair)] border-t border-hair lg:hidden">
              {ENDPOINTS.map((e) => (
                <li key={e.method + e.path} className="px-5 py-3.5">
                  <p className="break-all font-mono text-[12.5px] text-ink">
                    <span className="mr-2 font-semibold">{e.method}</span>
                    {e.path}
                  </p>
                  <p className="mt-1 text-[12.5px] text-ink-2">{e.auth}</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-muted">{e.what}</p>
                </li>
              ))}
            </ul>
          </Panel>
        </Reveal>
      </section>

      <section aria-labelledby="int-bolna" className="space-y-4">
        <SectionTitle id="int-bolna" eyebrow="The Bolna side" title="How the voice agent talks to Ruko">
          Three Bolna agents (check, trusted contact, public line) call Ruko's custom functions mid-conversation. Ruko verifies every request and never trusts a webhook's word on its own.
        </SectionTitle>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Reveal className="min-w-0">
            <Panel title={<TitleIcon icon={<Wrench />}>Custom functions</TitleIcon>} description="POST /v1/bolna/tools/:name, one per tool." className="h-full">
              <ul className="divide-y divide-[var(--hair)]">
                {TOOLS.map((t) => (
                  <li key={t.name} className="grid grid-cols-1 gap-x-4 gap-y-0.5 py-2.5 first:pt-0 last:pb-0 sm:grid-cols-[190px_minmax(0,1fr)]">
                    <span>
                      <code className="font-mono text-[12.5px] text-ink">{t.name}</code>
                      <span className="block text-[11.5px] text-muted">{t.agent}</span>
                    </span>
                    <span className="text-[13px] leading-relaxed text-ink-2">{t.what}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          </Reveal>
          <Reveal delay={0.05} className="min-w-0 space-y-4">
            <Panel title={<TitleIcon icon={<Lock />}>Verifying a tool call</TitleIcon>}>
              <ul className="space-y-3 text-[13.5px] leading-relaxed text-ink-2">
                <Check>
                  A bearer token, <code className="kbd">RUKO_TOOL_TOKEN</code>, set in each Bolna custom function and compared in constant time.
                </Check>
                <Check>
                  The source IP must be one of Bolna's published addresses (enforced in production):
                  <span className="mt-1.5 flex flex-wrap gap-1.5">
                    {BOLNA_IPS.map((ip) => (
                      <code key={ip} className="kbd">
                        {ip}
                      </code>
                    ))}
                  </span>
                </Check>
                <Check>The check ID in the arguments must exist. Any run of four or more digits in the evidence is removed before it is stored.</Check>
              </ul>
            </Panel>
            <CodeBlock code={TOOL_EXCHANGE(base)} lang="bash" title={<span>record_signal and set_decision, request and reply</span>} maxHeight={420} />
          </Reveal>
          <Reveal className="min-w-0">
            <Panel title={<TitleIcon icon={<Webhook />}>Execution webhook</TitleIcon>} description="POST /v1/bolna/webhook?token=…" className="h-full">
              <ul className="space-y-3 text-[13.5px] leading-relaxed text-ink-2">
                <Check>The token in the query string is compared in constant time, and the same Bolna IP list applies.</Check>
                <Check>
                  On a final status, Ruko fetches the execution back from Bolna's API before trusting its transcript, duration or cost. Those checks show{" "}
                  <span className="whitespace-nowrap font-semibold text-go">Verified with Bolna</span>.
                </Check>
                <Check>
                  Idempotent per (execution, status): a repeat delivery is acknowledged and ignored. Only processed deliveries are remembered, so a failed verification can be retried.
                </Check>
                <Check>Every final status writes the call's cost to a spend log.</Check>
              </ul>
            </Panel>
          </Reveal>
          <Reveal delay={0.05} className="min-w-0">
            <Panel title={<TitleIcon icon={<Radio />}>Web Call SDK sessions</TitleIcon>} description="POST /v1/checks/:id/web-session" className="h-full">
              <ul className="space-y-3 text-[13.5px] leading-relaxed text-ink-2">
                <Check>Minted server-side, so the browser never sees the Bolna API key. Each session is short-lived and single-use.</Check>
                <Check>Behind a gate, in order: an access code, a daily cap, a per-visitor cap, and a wallet floor checked against Bolna's balance before each session.</Check>
                <Check>Defaults: 12 live calls a day, 3 per visitor. Past the gate, the sandbox replays a recorded call through the real engine instead.</Check>
              </ul>
            </Panel>
          </Reveal>
        </div>
      </section>

      <section aria-labelledby="int-keys" className="space-y-4">
        <SectionTitle id="int-keys" eyebrow="Access" title="API keys" />
        <Reveal>
          <Panel>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:gap-10">
              <div className="space-y-3 text-[13.5px] leading-relaxed text-ink-2">
                <p>
                  Keys are issued per bank tenant through <code className="kbd">RUKO_API_KEYS</code>, as comma-separated <code className="kbd">tenant:key</code> pairs. A key only ever reads and
                  writes its own tenant's checks.
                </p>
                <p className="text-muted">To rotate, add the new pair, deploy, move your backend over, then remove the old pair. The console never shows a full key.</p>
              </div>
              <div className="overflow-hidden rounded-2xl border border-hair">
                <div className="flex items-center justify-between gap-3 border-b border-hair bg-paper-2 px-4 py-2.5">
                  <span className="flex items-center gap-2 text-[13px] font-semibold text-ink">
                    <KeyRound className="size-4 text-muted" strokeWidth={1.7} aria-hidden />
                    Demo bank
                  </span>
                  <span className="rounded-full bg-paper-3 px-2 py-0.5 text-[11px] font-semibold text-ink-2">Test</span>
                </div>
                <dl className="grid grid-cols-1 gap-x-6 gap-y-3 p-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <dt className="t-eyebrow !text-[10.5px]">Key</dt>
                    <dd className="mt-1 break-all font-mono text-[13px] text-ink">rk_test_••••••••••••••••••••</dd>
                  </div>
                  <div>
                    <dt className="t-eyebrow !text-[10.5px]">Tenant</dt>
                    <dd className="mt-1 font-mono text-[13px] text-ink-2">demo-bank</dd>
                  </div>
                  <div>
                    <dt className="t-eyebrow !text-[10.5px]">Can</dt>
                    <dd className="mt-1 text-[13px] text-ink-2">Create and read checks, read metrics</dd>
                  </div>
                </dl>
              </div>
            </div>
          </Panel>
        </Reveal>
      </section>

      <Reveal>
        <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-[var(--hair-strong)] p-5 text-[13.5px] leading-relaxed text-muted sm:flex-row sm:items-center">
          <BellRing className="size-5 shrink-0 text-ink-2" strokeWidth={1.6} aria-hidden />
          <p>
            Ruko doesn't push decisions to your backend yet; read <code className="kbd">GET /v1/checks/:id</code> when the app reports the hold is over, or poll it. Every decision carries its
            reasons, so your own case-management screen can show why.
          </p>
        </div>
      </Reveal>
    </div>
  );
}

function TitleIcon({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 [&>svg]:size-4 [&>svg]:stroke-[1.7] [&>svg]:text-muted">
      {icon}
      {children}
    </span>
  );
}

function Check({ children }: { children: ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <ShieldCheck className="mt-[3px] size-4 shrink-0 text-muted" strokeWidth={1.7} aria-hidden />
      <span className="min-w-0">{children}</span>
    </li>
  );
}
