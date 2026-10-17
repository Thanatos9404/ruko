import type { Lang } from "../shared/types.js";
import { PATTERNS, patternById, patternSources, matchText, truthFor } from "../shared/patterns.js";
import { DEMO_SCENARIOS, scenarioById } from "../shared/scenarios.js";
import { SIGNALS } from "../shared/signals.js";
import { loadConfig, BOLNA_IPS, type Config } from "./config.js";
import { Router, json, readJson, HttpError, clientIp, bearer } from "./http.js";
import type { KV } from "./store/store.js";
import { noArchive, type Archive } from "./store/archive.js";
import { CheckService, publicCheck, validateCreate, type StoredCheck } from "./engine/checks.js";
import { runTool, type ContactDialer, type ToolDeps } from "./engine/toolHandlers.js";
import { computeMetrics } from "./engine/metrics.js";
import { checkGate, gateStatus, accessCodeValid } from "./engine/gate.js";
import { safeEqual, sha256 } from "./engine/ids.js";
import { BolnaClient, BolnaError } from "./bolna/client.js";
import { checkUserData, contactUserData, lineUserData } from "./bolna/agents.js";
import { handleExecutionWebhook, logSpend, type SpendEntry } from "./bolna/webhook.js";
import { publicChat, publicStatsView, readStats } from "./public.js";

export interface AppDeps {
  kv: KV;
  config?: Config;
  bolna?: BolnaClient;
  archive?: Archive;
  now?: () => Date;
  /** Background work after the response (Vercel waitUntil); defaults to fire-and-forget. */
  defer?: (p: Promise<unknown>) => void;
}

const REPLAY_TOOLS = new Set(["record_signal", "call_trusted_contact", "set_decision", "get_check_context", "check_trusted_contact"]);

export function createApp(deps: AppDeps) {
  const cfg = deps.config ?? loadConfig();
  const kv = deps.kv;
  const checks = new CheckService(kv, undefined, deps.now);
  const bolna = deps.bolna ?? (cfg.bolnaApiKey ? new BolnaClient(cfg.bolnaApiKey) : undefined);
  const archive = deps.archive ?? noArchive;
  const defer = deps.defer ?? ((p: Promise<unknown>) => void p.catch((e) => console.error("[ruko] deferred", e)));

  const dialer: ContactDialer | undefined =
    cfg.agents.contact && (cfg.allowPhoneCalls || cfg.contactWebRing)
      ? {
          async dial(c) {
            if (c.mode === "eval") return { status: "not_configured" };
            if (cfg.allowPhoneCalls && bolna && c.customer.trusted_contact && c.mode === "live") {
              const r = await bolna.makeCall({
                agent_id: cfg.agents.contact!,
                recipient_phone_number: c.customer.trusted_contact.phone_e164,
                user_data: contactUserData(c, cfg.bankName),
              });
              return { status: "dialing", channel: "phone", execution_id: r.execution_id };
            }
            // Demo: phone calls are off to protect the credit budget, so the
            // contact's call rings in a browser tab instead.
            return { status: "ringing_web", channel: "web" };
          },
        }
      : undefined;

  const toolDeps: ToolDeps = { checks, kv, contact: dialer };

  const archiveIfDecided = (c: StoredCheck) => {
    if (c.decision && archive.enabled) defer(archive.put(publicCheck(c)));
  };

  // ---- auth helpers -------------------------------------------------------

  function tenantFor(req: Request): string {
    const key = bearer(req);
    if (!key) throw new HttpError(401, "Send your Ruko API key as 'Authorization: Bearer <key>'.", "unauthorized");
    for (const [k, tenant] of cfg.apiKeys) if (safeEqual(k, key)) return tenant;
    throw new HttpError(401, "Unknown API key.", "unauthorized");
  }

  async function checkForApp(req: Request, url: URL, id: string): Promise<StoredCheck> {
    const c = await checks.get(id);
    const secret = req.headers.get("x-client-secret") ?? url.searchParams.get("cs");
    if (!c || !checks.verifyClientSecret(c, secret)) throw new HttpError(404, "Check not found.", "not_found");
    return c;
  }

  function verifyBolnaTool(req: Request) {
    if (!cfg.toolToken) throw new HttpError(503, "Tool endpoint not configured (RUKO_TOOL_TOKEN).", "not_configured");
    const tok = bearer(req);
    if (!tok || !safeEqual(tok, cfg.toolToken)) throw new HttpError(401, "Bad tool token.", "unauthorized");
    if (cfg.enforceBolnaIps) {
      const ip = clientIp(req);
      if (!BOLNA_IPS.includes(ip)) throw new HttpError(403, "Request did not come from Bolna's published IPs.", "forbidden");
    }
  }

  async function mintCheckSession(c: StoredCheck, opts: { code?: string | null; visitor: string }) {
    const gate = await checkGate(kv, cfg, bolna, { code: opts.code, visitor: opts.visitor });
    if (!gate.ok) throw new HttpError(gate.reason === "access_code_invalid" ? 403 : 429, gate.message ?? "Live call unavailable.", gate.reason ?? "unavailable");
    const wallet = await bolna!.me().then((m) => m.wallet).catch(() => null);
    try {
      const session = await bolna!.mintWebSession({ agent_id: cfg.agents.check!, user_data: checkUserData(c, cfg.bankName) });
      await checks.attachCall(c.id, { channel: "web", status: "queued", execution_id: session.run_id, agent_id: cfg.agents.check });
      await checks.mutate(c.id, (cc) => {
        cc.events.push({ at: new Date().toISOString(), type: "live.authorized", detail: "Live web call authorised by access code." });
      });
      await logSpend(kv, { kind: "mint", check_id: c.id, execution_id: session.run_id, cost_cents: null, duration_s: null, wallet_before: wallet });
      return session;
    } catch (e) {
      if (e instanceof BolnaError) throw new HttpError(502, `Voice service error: ${e.message}`, "bolna_error");
      throw e;
    }
  }

  // ---- routes -------------------------------------------------------------

  const r = new Router();

  r.on("GET", "/v1/health", async () =>
    json({
      ok: true,
      service: "ruko",
      store: kv.kind,
      archive: archive.enabled,
      bolna: { configured: Boolean(bolna), agents: { check: Boolean(cfg.agents.check), contact: Boolean(cfg.agents.contact), line: Boolean(cfg.agents.line) } },
      tools_configured: Boolean(cfg.toolToken),
      phone_calls: cfg.allowPhoneCalls,
      env: cfg.env,
    }),
  );

  // Bank API -----------------------------------------------------------------

  r.on("POST", "/v1/checks", async (req) => {
    const tenant = tenantFor(req);
    const input = validateCreate(await readJson(req));
    const { created, replayed } = await checks.create(tenant, input, req.headers.get("idempotency-key") ?? undefined);
    return json(created, replayed ? 200 : 201, replayed ? { "Idempotent-Replayed": "true" } : {});
  });

  r.on("GET", "/v1/checks", async (req, _p, url) => {
    const tenant = tenantFor(req);
    const limit = Math.min(200, Number(url.searchParams.get("limit") ?? 50));
    return json({ data: (await checks.list(tenant, limit)).map(publicCheck) });
  });

  r.on("GET", "/v1/checks/:id", async (req, p) => {
    const tenant = tenantFor(req);
    const c = await checks.get(p.id);
    if (!c || c.tenant !== tenant) throw new HttpError(404, "Check not found.", "not_found");
    return json(publicCheck(c));
  });

  r.on("GET", "/v1/metrics", async (req) => {
    const tenant = tenantFor(req);
    return json(computeMetrics(await checks.list(tenant, 300)));
  });

  // Customer app (client secret) -------------------------------------------------

  r.on("GET", "/v1/checks/:id/app-status", async (req, p, url) => {
    const c = await checkForApp(req, url, p.id);
    return json(checks.appStatus(c));
  });

  r.on("POST", "/v1/checks/:id/web-session", async (req, p, url) => {
    const c = await checkForApp(req, url, p.id);
    if (c.risk.action !== "hold") throw new HttpError(409, "This payment was not held; no call needed.", "not_held");
    if (c.decision) throw new HttpError(409, "This check is already decided.", "already_decided");
    const body = (await readJson(req)) as { access_code?: string };
    const session = await mintCheckSession(c, { code: body.access_code ?? req.headers.get("x-access-code"), visitor: visitorKey(req) });
    return json(session);
  });

  // Patterns (public) ----------------------------------------------------------

  r.on("GET", "/v1/patterns", () =>
    json({
      data: PATTERNS.map((pt) => ({ ...pt, sources: patternSources(pt) })),
      signals: SIGNALS,
    }),
  );

  r.on("GET", "/v1/patterns/:id", (_req, p) => {
    const pt = patternById(p.id);
    if (!pt) throw new HttpError(404, "Pattern not found.", "not_found");
    return json({ ...pt, sources: patternSources(pt) });
  });

  // Bolna: custom functions and webhooks -----------------------------------------

  r.on("POST", "/v1/bolna/tools/:name", async (req, p) => {
    verifyBolnaTool(req);
    const args = (await readJson(req)) as Record<string, unknown>;
    const { status, body } = await runTool(toolDeps, p.name, args);
    if (p.name === "set_decision" || p.name === "report_contact_outcome") {
      const id = String(args.check_id ?? "").replace(/["'{}\s]/g, "");
      const c = await checks.get(id);
      if (c) archiveIfDecided(c);
    }
    return json(body, status);
  });

  r.on("POST", "/v1/bolna/webhook", async (req, _p, url) => {
    if (!cfg.webhookToken) throw new HttpError(503, "Webhook not configured (RUKO_WEBHOOK_TOKEN).", "not_configured");
    const tok = url.searchParams.get("token") ?? "";
    if (!safeEqual(tok, cfg.webhookToken)) throw new HttpError(401, "Bad webhook token.", "unauthorized");
    if (cfg.enforceBolnaIps && !BOLNA_IPS.includes(clientIp(req))) throw new HttpError(403, "Not from Bolna's published IPs.", "forbidden");
    const result = await handleExecutionWebhook({ checks, kv, bolna, agents: cfg.agents }, await readJson(req, 512_000));
    if (result.check_id) {
      const c = await checks.get(result.check_id);
      if (c) archiveIfDecided(c);
    }
    return json(result);
  });

  // Demo bank backend (sandbox) ---------------------------------------------------

  r.on("GET", "/api/demo/scenarios", () =>
    json({
      data: DEMO_SCENARIOS.map(({ id, title, blurb, truth, payment, customer, device }) => ({
        id,
        title,
        blurb,
        truth,
        payment,
        customer: { name: customer.name, language: customer.language, trusted_contact: customer.trusted_contact ? { name: customer.trusted_contact.name, relation: customer.trusted_contact.relation } : null },
        device,
      })),
    }),
  );

  r.on("POST", "/api/demo/pay", async (req) => {
    const body = (await readJson(req)) as { scenario?: string; language?: Lang; amount_inr?: number };
    const sc = scenarioById(String(body.scenario ?? ""));
    if (!sc) throw new HttpError(400, "Unknown scenario.", "invalid_request");
    // The free sandbox has its own generous bucket, separate from the paid live-call gate.
    await rateLimit(kv, `rl:sandbox:${visitorKey(req)}`, cfg.env === "production" ? 240 : 5000, "sandbox");
    const customer = { ...sc.customer, language: body.language === "hi" || body.language === "en" ? body.language : sc.customer.language };
    const payment = { ...sc.payment, amount_inr: body.amount_inr && body.amount_inr > 0 ? Math.min(body.amount_inr, 10_00_000) : sc.payment.amount_inr, initiated_at: new Date().toISOString() };
    const input = validateCreate({ payment, customer, device: sc.device, mode: "demo" });
    const { created } = await checks.create(cfg.demoTenant, input);
    return json({ ...created, scenario: sc.id, bank_name: cfg.bankName }, 201);
  });

  r.on("GET", "/api/demo/checks/:id", async (req, p, url) => {
    const c = await checkForApp(req, url, p.id);
    return json(checks.appStatus(c));
  });

  r.on("POST", "/api/demo/checks/:id/session", async (req, p, url) => {
    const c = await checkForApp(req, url, p.id);
    if (c.risk.action !== "hold" || c.decision) throw new HttpError(409, "No call needed for this check.", "not_needed");
    const body = (await readJson(req)) as { access_code?: string };
    return json(await mintCheckSession(c, { code: body.access_code, visitor: visitorKey(req) }));
  });

  /** The trusted contact's "phone" in the demo: a second browser tab answers the contact agent's web call. */
  r.on("POST", "/api/demo/checks/:id/contact-session", async (req, p, url) => {
    const c = await checkForApp(req, url, p.id);
    if (c.contact?.status !== "ringing_web" || !cfg.agents.contact || !bolna) throw new HttpError(409, "No contact call is ringing.", "not_ringing");
    const authorised = c.events.some((e) => e.type === "live.authorized");
    const gate = await checkGate(kv, cfg, bolna, { visitor: visitorKey(req), preauthorized: authorised });
    if (!gate.ok) throw new HttpError(429, gate.message ?? "Unavailable.", gate.reason ?? "unavailable");
    const session = await bolna.mintWebSession({ agent_id: cfg.agents.contact, user_data: contactUserData(c, cfg.bankName) });
    await checks.setContact(c.id, { status: "ringing_web", execution_id: session.run_id });
    await logSpend(kv, { kind: "mint", check_id: c.id, execution_id: session.run_id, cost_cents: null, duration_s: null });
    return json(session);
  });

  /**
   * Replays one tool call from a recorded text-mode eval conversation against a
   * demo check, so the recorded demo still runs through the real engine and
   * policy. Demo checks only; never touches Bolna.
   */
  r.on("POST", "/api/demo/checks/:id/replay", async (req, p, url) => {
    const c = await checkForApp(req, url, p.id);
    if (c.mode !== "demo") throw new HttpError(403, "Replay is only for demo checks.", "forbidden");
    const body = (await readJson(req)) as { tool?: string; args?: Record<string, unknown> };
    if (!body.tool || !REPLAY_TOOLS.has(body.tool)) throw new HttpError(400, "Tool not allowed in replay.", "invalid_request");
    const replayDeps: ToolDeps = {
      ...toolDeps,
      contact: { dial: async () => ({ status: "simulated", channel: "text-eval" }) },
    };
    if (c.call?.channel !== "text-eval") await checks.attachCall(c.id, { channel: "text-eval", status: "in-progress" });
    const { body: out } = await runTool(replayDeps, body.tool, { ...(body.args ?? {}), check_id: c.id });
    if (body.tool === "set_decision") await checks.attachCall(c.id, { channel: "text-eval", status: "completed" });
    return json({ result: out, status: checks.appStatus(await checks.require(c.id)) });
  });

  // Live-call availability (no secrets exposed) ----------------------------------

  r.on("GET", "/api/live/status", async () => json(await gateStatus(kv, cfg)));

  r.on("POST", "/api/live/verify", async (req) => {
    const body = (await readJson(req)) as { access_code?: string };
    await rateLimit(kv, `rl:verify:${visitorKey(req)}`, 20);
    return json({ valid: accessCodeValid(cfg, body.access_code) });
  });

  // Public "Is this a scam?" line -------------------------------------------------

  r.on("POST", "/api/public/text-check", async (req) => {
    const body = (await readJson(req, 8_000)) as { text?: string; language?: Lang };
    await rateLimit(kv, `rl:text:${visitorKey(req)}`, 120);
    const lang: Lang = body.language === "hi" ? "hi" : "en";
    const text = String(body.text ?? "").slice(0, 2000);
    if (text.trim().length < 12) throw new HttpError(400, "Describe what happened in a sentence or two.", "invalid_request");
    const matches = matchText(text).map((m) => ({
      id: m.pattern.id,
      name: m.pattern.name[lang],
      score: m.score,
      matched: m.matched,
      truth: truthFor(m.pattern, lang),
      advice: m.pattern.advice[lang],
      sources: patternSources(m.pattern),
    }));
    return json({ method: "rule-based keyword match against the pattern library (no AI, nothing stored)", matches });
  });

  r.on("POST", "/api/public/chat", async (req) => {
    const body = await readJson(req, 16_000);
    const host = new URL(req.url).hostname;
    const count = cfg.countPublicStats && !req.headers.get("x-ruko-test") && !/^(localhost|127\.|\[::1\])/.test(host);
    const reply = await publicChat(kv, body, { visitorKey: visitorKey(req), dailyCap: cfg.chatDailyCap, perHour: cfg.env === "production" ? 40 : 1000, count });
    return json(reply);
  });

  r.on("GET", "/api/public/stats", async () => {
    const s = await readStats(kv);
    return json({
      ...publicStatsView(s, cfg.statsMinPerPattern),
      counting: cfg.countPublicStats,
      note: "Anonymous counts of real checks on Ruko's public checker since launch. Test, preview and local traffic is not counted; patterns with fewer than the minimum are grouped.",
    });
  });

  r.on("POST", "/api/public/session", async (req) => {
    const body = (await readJson(req)) as { access_code?: string; language?: Lang };
    if (!cfg.agents.line) throw new HttpError(503, "The public line is not configured.", "not_configured");
    const gate = await checkGate(kv, { ...cfg, agents: { ...cfg.agents, check: cfg.agents.line } }, bolna, { code: body.access_code, visitor: visitorKey(req) });
    if (!gate.ok) throw new HttpError(gate.reason === "access_code_invalid" ? 403 : 429, gate.message ?? "Unavailable.", gate.reason ?? "unavailable");
    const lang: Lang = body.language === "hi" ? "hi" : "en";
    const session = await bolna!.mintWebSession({ agent_id: cfg.agents.line, user_data: lineUserData(lang) });
    await logSpend(kv, { kind: "mint", execution_id: session.run_id, cost_cents: null, duration_s: null });
    return json(session);
  });

  // Console (demo tenant, read-only) -----------------------------------------------

  r.on("GET", "/api/console/overview", async () => {
    const list = await checks.list(cfg.demoTenant, 300);
    const spend = (await kv.get<SpendEntry[]>("spend:log")) ?? [];
    return json({
      tenant: cfg.demoTenant,
      metrics: computeMetrics(list),
      spend_cents_logged: spend.reduce((s, e) => s + (e.cost_cents ?? 0), 0),
      live: await gateStatus(kv, cfg),
    });
  });

  r.on("GET", "/api/console/checks", async (_req, _p, url) => {
    const limit = Math.min(200, Number(url.searchParams.get("limit") ?? 60));
    const list = await checks.list(cfg.demoTenant, limit);
    return json({ data: list.map(publicCheck) });
  });

  r.on("GET", "/api/console/checks/:id", async (_req, p) => {
    const c = await checks.get(p.id);
    if (!c || c.tenant !== cfg.demoTenant) throw new HttpError(404, "Check not found.", "not_found");
    return json(publicCheck(c));
  });

  r.on("GET", "/api/console/reports", async () => {
    const ids = (await kv.get<string[]>("index:reports")) ?? [];
    const reports = [];
    for (const id of ids.slice(0, 100)) {
      const rep = await kv.get(`report:${id}`);
      if (rep) reports.push(rep);
    }
    return json({ data: reports });
  });

  return {
    router: r,
    handle: (req: Request) => r.handle(req),
    checks,
    kv,
    config: cfg,
    toolDeps,
  };
}

async function rateLimit(kv: KV, key: string, perHour: number, kind: "sandbox" | "default" = "default"): Promise<void> {
  const k = `${key}:${new Date().toISOString().slice(0, 13)}`;
  const n = (await kv.get<number>(k)) ?? 0;
  if (n >= perHour)
    throw new HttpError(
      429,
      kind === "sandbox"
        ? "Lots of sandbox payments from your network in the last hour. Give it a minute and try again."
        : "Too many requests from your network. Please try again in a minute.",
      "rate_limited",
    );
  await kv.set(k, n + 1, 3600);
}

/**
 * Per-visitor key for rate limits. On Vercel the client address is the first
 * entry of x-forwarded-for (or x-real-ip); the user agent is mixed in so a
 * shared office or campus IP doesn't collapse everyone into one bucket.
 */
function visitorKey(req: Request): string {
  const ip = clientIp(req);
  const ua = req.headers.get("user-agent") ?? "";
  return sha256(`${ip}|${ua}`).slice(0, 20);
}

export type RukoApp = ReturnType<typeof createApp>;
