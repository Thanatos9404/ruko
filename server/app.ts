import type { Lang } from "../shared/types.js";
import { PATTERNS, patternById, patternSources, matchText, truthFor } from "../shared/patterns.js";
import { DEMO_SCENARIO_VIEWS, scenarioById } from "../shared/scenarios.js";
import { maskPhone } from "../shared/format.js";
import { analyzeText, getLibrary, getSources, mlStatus } from "./ml/index.js";
import { readModelResults } from "./ml-results.js";
import { SIGNALS } from "../shared/signals.js";
import { loadConfig, BOLNA_IPS, type Config } from "./config.js";
import { Router, json, readJson, HttpError, clientIp, bearer, rateLimitAddress } from "./http.js";
import type { KV } from "./store/store.js";
import { noArchive, type Archive } from "./store/archive.js";
import { CheckService, publicCheck, validateCreate, type StoredCheck } from "./engine/checks.js";
import { runTool, type ContactDialer, type ToolDeps } from "./engine/toolHandlers.js";
import { computeMetrics } from "./engine/metrics.js";
import { checkGate, gateStatus, accessCodeValid, holdSlot, refundSlot, withLock, bump, type GateKind } from "./engine/gate.js";
import { safeEqual, sha256 } from "./engine/ids.js";
import { BolnaClient, BolnaError } from "./bolna/client.js";
import { checkUserData, contactUserData, lineUserData } from "./bolna/agents.js";
import { handleExecutionWebhook, logSpend, type SpendEntry } from "./bolna/webhook.js";
import { publicChat, publicStatsView, readStats } from "./public.js";
import { redactPII } from "./llm/nebius.js";
import { ensureSeeded } from "./seed.js";

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

  /**
   * Wrong access codes are budgeted per client IP per day, shared by /api/live/verify and
   * every route that mints with a code. Once spent, every attempt from that address gets
   * the same 429 (a right code too), so the answer stops being an oracle. A right code
   * never uses the budget.
   */
  const failKey = (visitor: string) => `fail:code:${new Date().toISOString().slice(0, 10)}:${visitor}`;
  async function assertCodeBudget(visitor: string): Promise<void> {
    if (((await kv.get<number>(failKey(visitor))) ?? 0) >= cfg.codeFailuresPerDay)
      throw new HttpError(429, "Too many wrong access codes from your network today. Watch the recorded run instead, or try again tomorrow.", "rate_limited");
  }
  async function noteCodeFailure(visitor: string): Promise<void> {
    const k = failKey(visitor);
    await withLock(k, () => bump(kv, k, 1, 26 * 3600));
  }

  /**
   * Gate, then mint a Bolna web-call session. A slot is reserved by the gate and
   * refunded if minting fails or the call never connects (see /api/live/release
   * and the webhook). Bolna's own 429 comes back as at_capacity with its scope.
   */
  async function mintGated(
    kind: GateKind,
    agentId: string,
    userData: Record<string, unknown>,
    opts: { code?: string | null; preauthorized?: boolean; checkId?: string; visitor?: string },
  ) {
    const usesCode = kind !== "contact" && !opts.preauthorized && Boolean(opts.code);
    if (usesCode && opts.visitor) await assertCodeBudget(opts.visitor);
    const gate = await checkGate(kv, { ...cfg, agents: { ...cfg.agents, check: agentId } }, bolna, { code: opts.code, kind, preauthorized: opts.preauthorized });
    if (!gate.ok && gate.reason === "access_code_invalid" && usesCode && opts.visitor) await noteCodeFailure(opts.visitor);
    if (!gate.ok) throw new HttpError(gate.reason === "access_code_invalid" ? 403 : 429, gate.message ?? "Live call unavailable.", gate.reason ?? "unavailable");
    try {
      const session = await bolna!.mintWebSession({ agent_id: agentId, user_data: userData });
      await holdSlot(kv, session.run_id, gate.slot);
      await logSpend(kv, { kind: "mint", check_id: opts.checkId, execution_id: session.run_id, cost_cents: null, duration_s: null, wallet_before: gate.wallet ?? null });
      return session;
    } catch (e) {
      await refundSlot(kv, gate.slot);
      if (e instanceof BolnaError && e.status === 429) {
        const scope = typeof e.body === "object" && e.body && "scope" in e.body ? String((e.body as { scope: unknown }).scope) : "global";
        throw new HttpError(429, "The voice service is at capacity right now. Watch the recorded run, or try again in a minute.", "at_capacity", { scope });
      }
      if (e instanceof BolnaError) throw new HttpError(502, `Voice service error: ${e.message}`, "bolna_error");
      if ((e as Error).name === "AbortError") throw new HttpError(504, "The voice service took too long to answer. Try again, or watch the recorded run.", "mint_timeout");
      throw e;
    }
  }

  async function mintCheckSession(c: StoredCheck, opts: { code?: string | null; visitor: string }) {
    const session = await mintGated("customer", cfg.agents.check ?? "", checkUserData(c, cfg.bankName), { code: opts.code, checkId: c.id, visitor: opts.visitor });
    await checks.attachCall(c.id, { channel: "web", status: "queued", execution_id: session.run_id, agent_id: cfg.agents.check, started_at: new Date().toISOString() });
    await checks.extendHold(c.id, 90 + 120);
    await checks.mutate(c.id, (cc) => {
      cc.events.push({ at: new Date().toISOString(), type: "live.authorized", detail: "Live web call authorised by access code." });
    });
    return session;
  }

  // ---- routes -------------------------------------------------------------

  // Paid-call, access-code and sandbox routes answer browsers on Ruko's own origins only.
  const r = new Router({
    restricted: (path) => path.startsWith("/api/live/") || path.startsWith("/api/demo/") || path === "/api/public/session",
    origins: [...new Set([...cfg.allowedOrigins, new URL(cfg.baseUrl).origin])],
  });

  // A liveness check only: deployment details (store, agents, tokens) are not public.
  r.on("GET", "/v1/health", async () => json({ ok: true, service: "ruko" }));

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
    const visitor = visitorKey(req);
    await rateLimit(kv, `rl:mint:${visitor}`, 30);
    const session = await mintCheckSession(c, { code: body.access_code ?? req.headers.get("x-access-code"), visitor });
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
    // Bolna's webhook URL carries the token in the query string; a header is accepted too
    // (Authorization: Bearer or X-Ruko-Webhook-Token) so it can stay out of request logs.
    const header = req.headers.get("x-ruko-webhook-token") ?? (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    const tok = header || (url.searchParams.get("token") ?? "");
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

  r.on("GET", "/api/demo/scenarios", () => json({ data: DEMO_SCENARIO_VIEWS }));

  r.on("POST", "/api/demo/pay", async (req) => {
    const body = (await readJson(req)) as { scenario?: string; language?: Lang; amount_inr?: number };
    const sc = scenarioById(String(body.scenario ?? ""));
    if (!sc) throw new HttpError(400, "Unknown scenario.", "invalid_request");
    // The free sandbox has its own generous bucket, separate from the paid live-call gate.
    await rateLimit(kv, `rl:sandbox:${visitorKey(req)}`, cfg.env === "production" ? 240 : 5000, "sandbox");
    const customer = { ...sc.customer, language: body.language === "hi" || body.language === "en" ? body.language : sc.customer.language };
    const payment = { ...sc.payment, amount_inr: body.amount_inr && body.amount_inr > 0 ? Math.min(body.amount_inr, 10_00_000) : sc.payment.amount_inr, initiated_at: new Date().toISOString() };
    const input = validateCreate({ payment, customer, device: sc.device, mode: "demo", origin: "sandbox" });
    const { created } = await checks.create(cfg.sandboxTenant, input);
    return json({ ...created, scenario: sc.id, bank_name: cfg.bankName }, 201);
  });

  r.on("GET", "/api/demo/checks/:id", async (req, p, url) => {
    const c = await checkForApp(req, url, p.id);
    return json(checks.appStatus(c));
  });

  r.on("POST", "/api/demo/checks/:id/session", async (req, p, url) => {
    const c = await checkForApp(req, url, p.id);
    if (c.risk.action !== "hold" || c.decision) throw new HttpError(409, "No call needed for this check.", "not_needed");
    const body = (await readJson(req)) as { access_code?: string; scripted_test?: boolean };
    const visitor = visitorKey(req);
    await rateLimit(kv, `rl:mint:${visitor}`, 30);
    const session = await mintCheckSession(c, { code: body.access_code, visitor });
    // Our own scripted test runs (scripts/live-call.mjs, owner's code only) are tagged so the
    // console can say plainly that the "customer" was a text-to-speech voice.
    if (body.scripted_test === true && cfg.ownerCode && typeof body.access_code === "string" && safeEqual(body.access_code.trim(), cfg.ownerCode)) {
      await checks.mutate(c.id, (cc) => {
        cc.test_run = "scripted-tts";
        cc.events.push({ at: new Date().toISOString(), type: "test.scripted", detail: "Scripted test run: the customer is a text-to-speech voice, not a person." });
      });
    }
    return json(session);
  });

  /** The trusted contact's "phone" in the demo: a second browser tab answers the contact agent's web call. */
  r.on("POST", "/api/demo/checks/:id/contact-session", async (req, p, url) => {
    const c = await checkForApp(req, url, p.id);
    if (c.contact?.status !== "ringing_web" || !cfg.agents.contact || !bolna) throw new HttpError(409, "No contact call is ringing.", "not_ringing");
    // Part of an authorised live demo, so it doesn't use a judge's slot; at most two tries per check.
    // The try is reserved before minting (and given back if minting fails), so two
    // simultaneous requests can't both take the last one.
    const authorised = c.events.some((e) => e.type === "live.authorized");
    const agentId = cfg.agents.contact;
    const tryKey = `contact-tries:${c.id}`;
    const tries = await withLock(tryKey, async () => {
      const n = ((await kv.get<number>(tryKey)) ?? c.events.filter((e) => e.type === "contact.minted").length) + 1;
      await kv.set(tryKey, Math.min(n, 3), 6 * 3600);
      return n;
    });
    const giveBack = () => withLock(tryKey, () => bump(kv, tryKey, -1, 6 * 3600));
    if (tries > 2) {
      await giveBack();
      throw new HttpError(429, "The contact call was already tried twice for this payment.", "contact_tries");
    }
    let session: Awaited<ReturnType<typeof mintGated>>;
    try {
      session = await mintGated("contact", agentId, contactUserData(c, cfg.bankName), { preauthorized: authorised, checkId: c.id });
    } catch (e) {
      await giveBack();
      throw e;
    }
    await checks.setContact(c.id, { status: "ringing_web", execution_id: session.run_id });
    await checks.noteEvent(c.id, "contact.minted", "Trusted contact answered in the browser (web call).");
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
    const args = { ...(body.args ?? {}), check_id: c.id };
    delete (args as Record<string, unknown>).execution_id;
    const { body: out } = await runTool(replayDeps, body.tool, args);
    if (body.tool === "set_decision") await checks.attachCall(c.id, { channel: "text-eval", status: "completed" });
    return json({ result: out, status: checks.appStatus(await checks.require(c.id)) });
  });

  // Live-call availability (no secrets exposed) ----------------------------------

  r.on("GET", "/api/live/status", async () => json(await gateStatus(kv, cfg)));

  /**
   * The browser reports a call that failed before connecting (mic denied, network,
   * timeout). The slot is refunded only if Bolna confirms no conversation happened.
   */
  r.on("POST", "/api/live/release", async (req) => {
    const body = (await readJson(req)) as { run_id?: string };
    const runId = String(body.run_id ?? "");
    if (!/^[0-9a-zA-Z-]{8,80}$/.test(runId)) throw new HttpError(400, "run_id is required.", "invalid_request");
    await rateLimit(kv, `rl:release:${visitorKey(req)}`, 30);
    if (!(await kv.get(`slot:${runId}`))) return json({ refunded: false, reason: "no_open_slot" });
    let connected = false;
    try {
      const ex = await bolna!.getExecution(runId);
      connected = ["in-progress", "in_progress", "ongoing"].includes(String(ex.status)) || Number(ex.conversation_duration ?? 0) > 0 || Boolean(ex.transcript && String(ex.transcript).trim());
    } catch (e) {
      // Bolna has no record of a call that never connected; anything else, keep the slot.
      if (!(e instanceof BolnaError && e.status === 404)) return json({ refunded: false, reason: "unverified" });
    }
    if (connected) return json({ refunded: false, reason: "connected" });
    return json({ refunded: await refundSlot(kv, runId) });
  });

  r.on("POST", "/api/live/verify", async (req) => {
    const body = (await readJson(req)) as { access_code?: string };
    const visitor = visitorKey(req);
    await rateLimit(kv, `rl:verify:${visitor}`, 20);
    await assertCodeBudget(visitor);
    const valid = accessCodeValid(cfg, body.access_code);
    if (!valid) await noteCodeFailure(visitor);
    return json({ valid });
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
    // The on-server text model (advisory): a calibrated probability, ranked patterns and cue spans.
    let model: Record<string, unknown> | null = null;
    try {
      const a = analyzeText(redactPII(text), { topK: 3 });
      if (a.engine.mode !== "none")
        model = {
          band: a.band,
          scam_probability: a.scam_probability,
          version: a.engine.model_version,
          patterns: a.band === "unlikely_scam" ? [] : a.patterns.map((m) => ({ id: m.id, name: m.name, p_given_scam: m.p_given_scam })),
        };
    } catch {
      model = null;
    }
    return json({
      method: model
        ? "keyword rules plus an on-server text classifier (no LLM, nothing stored)"
        : "rule-based keyword match against the pattern library (no AI, nothing stored)",
      matches,
      model,
    });
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
    const visitor = visitorKey(req);
    await rateLimit(kv, `rl:mint:${visitor}`, 30);
    const lang: Lang = body.language === "hi" ? "hi" : "en";
    return json(await mintGated("line", cfg.agents.line, lineUserData(lang), { code: body.access_code, visitor }));
  });

  // Console (demo tenant, read-only) -----------------------------------------------

  const consoleTenant = (url: URL) => (url.searchParams.get("tenant") === "sandbox" ? cfg.sandboxTenant : cfg.demoTenant);
  // The demo bank shows only the synthetic eval conversations, never test or visitor traffic.
  const consoleList = async (tenant: string, limit: number) => {
    const list = await checks.list(tenant, Math.max(limit, 300));
    return (tenant === cfg.demoTenant ? list.filter((c) => c.origin === "eval-replay") : list).slice(0, limit);
  };

  r.on("GET", "/api/console/overview", async (_req, _p, url) => {
    if (consoleTenant(url) === cfg.demoTenant) await ensureSeeded(checks, kv, cfg.demoTenant);
    const list = await consoleList(consoleTenant(url), 300);
    const spend = (await kv.get<SpendEntry[]>("spend:log")) ?? [];
    return json({
      tenant: consoleTenant(url),
      metrics: computeMetrics(list),
      spend_cents_logged: spend.reduce((s, e) => s + (e.cost_cents ?? 0), 0),
      live: await gateStatus(kv, cfg),
    });
  });

  r.on("GET", "/api/console/checks", async (_req, _p, url) => {
    const limit = Math.min(200, Number(url.searchParams.get("limit") ?? 60));
    if (consoleTenant(url) === cfg.demoTenant) await ensureSeeded(checks, kv, cfg.demoTenant);
    const list = await consoleList(consoleTenant(url), limit);
    return json({ data: list.map(consoleView) });
  });

  r.on("GET", "/api/console/checks/:id", async (_req, p) => {
    const c = await checks.get(p.id);
    if (!c || (c.tenant !== cfg.demoTenant && c.tenant !== cfg.sandboxTenant)) throw new HttpError(404, "Check not found.", "not_found");
    if (c.tenant === cfg.demoTenant && c.origin !== "eval-replay") throw new HttpError(404, "Check not found.", "not_found");
    return json(consoleView(c));
  });

  // The research pattern library (72 patterns, India and global), compacted for the console.
  r.on("GET", "/api/console/library", async () => {
    const lib = getLibrary();
    if (!lib) throw new HttpError(503, "The pattern library isn't bundled with this deployment.", "unavailable");
    const src = getSources();
    const used = new Set<string>();
    const patterns = lib.patterns.map((p) => {
      p.sources.forEach((id) => used.add(id));
      return {
        id: p.id,
        aliases: p.aliases ?? [],
        name: { en: p.name.en, hi: p.name.hi },
        category: p.category,
        region: p.region,
        summary: p.summary,
        channel: p.channel,
        payment_rails: p.payment_rails,
        victim_profile: p.victim_profile,
        red_flag_questions: { en: p.red_flag_questions.en, hi: p.red_flag_questions.hi ?? [] },
        coaching_phrases: { en: p.coaching_phrases.en, hi: p.coaching_phrases.hi ?? [] },
        truth: { en: p.truth.en, hi: p.truth.hi },
        advice: { en: p.advice.en, hi: p.advice.hi },
        first_seen: p.first_seen?.value ?? null,
        trend: p.trend ? { status: p.trend.status, note: p.trend.note } : null,
        ruko_applicability: p.ruko_applicability,
        translation_status: p.translation_status,
        core: Boolean(patternById(p.id)),
        sources: p.sources,
      };
    });
    const sources = Object.fromEntries(
      [...used].map((id) => src.get(id)).filter((x): x is NonNullable<typeof x> => Boolean(x)).map((x) => [x.id, { title: x.title, publisher: x.publisher, date: x.date, url: x.url, accessed: x.accessed, kind: x.kind }]),
    );
    return json({ version: lib.version, generated: lib.generated, categories: lib.categories, patterns, sources }, 200, { "Cache-Control": "public, max-age=300" });
  });

  // The text model's status and its published evaluation (ml/results/summary.json).
  r.on("GET", "/api/console/model", async () => json({ status: mlStatus(), results: readModelResults() }));

  r.on("GET", "/api/console/reports", async (req) => {
    // Line reports are anonymised, but still private to the operator: a bank API key is required.
    const tok = bearer(req);
    if (!tok || !cfg.apiKeys.has(tok)) throw new HttpError(401, "Line reports are private to the operator. Send a bank API key.", "unauthorized");
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
  // Count first (under the per-process lock), so concurrent requests can't all slip under the limit.
  const n = await withLock(k, async () => {
    const cur = (await kv.get<number>(k)) ?? 0;
    if (cur < perHour) await kv.set(k, cur + 1, 3600);
    return cur;
  });
  if (n >= perHour)
    throw new HttpError(
      429,
      kind === "sandbox"
        ? "Lots of sandbox payments from your network in the last hour. Give it a minute and try again."
        : "Too many requests from your network. Please try again in a minute.",
      "rate_limited",
    );
}

/**
 * Rate-limit key: the client IP alone (IPv6 by its /64), hashed so raw addresses never sit
 * in the store. Headers a client controls, such as the user agent, are deliberately left
 * out, so changing them can't reset a limit. A shared office or venue NAT shares one
 * bucket; the per-hour limits are sized for that, and live calls are capped per access
 * code rather than per IP (see engine/gate.ts).
 */
export function visitorKey(req: Request): string {
  return sha256(`ip|${rateLimitAddress(clientIp(req))}`).slice(0, 20);
}

export type RukoApp = ReturnType<typeof createApp>;

/**
 * Our five scripted live test calls on 23 Oct 2026 (docs/BOLNA_SPEND.md), made before
 * test runs were tagged at mint time. Each had a text-to-speech customer, not a person.
 */
const SCRIPTED_TEST_EXECUTIONS = new Set([
  "ddc9026c-e7f1-4cdc-8ee1-34431deb822b",
  "b6818362-8118-49fd-8f76-146432254c27",
  "152e968b-2386-46d8-8dc5-3fddaff8ae1f",
  "2bfbdec6-4bab-440b-be19-8fbb9a7d4a37",
  "9f893617-24cd-4d04-a693-5ae88ee06554",
]);

export function isScriptedTestRun(c: Pick<StoredCheck, "test_run" | "call">): boolean {
  return c.test_run === "scripted-tts" || SCRIPTED_TEST_EXECUTIONS.has(c.call?.execution_id ?? "");
}

/**
 * What the public console may show about a check: no code word, masked phone numbers,
 * and a transcript only for eval conversations and our scripted test runs (never a real caller's words).
 */
function consoleView(c: StoredCheck) {
  const v = publicCheck(c) as Record<string, unknown> & ReturnType<typeof publicCheck>;
  const scripted = isScriptedTestRun(c);
  // Eval replays (an LLM customer) and our scripted test runs (a TTS customer) involve no real person.
  const synthetic = c.origin === "eval-replay" || scripted;
  const mask = (p?: string) => (p ? maskPhone(p) : p);
  return {
    ...v,
    test_run: scripted ? ("scripted-tts" as const) : undefined,
    code_word: undefined,
    customer: {
      ...v.customer,
      phone_e164: mask(v.customer.phone_e164),
      trusted_contact: v.customer.trusted_contact ? { ...v.customer.trusted_contact, phone_e164: mask(v.customer.trusted_contact.phone_e164) } : v.customer.trusted_contact,
    },
    call: v.call
      ? { ...v.call, agent_id: undefined, transcript: synthetic ? v.call.transcript : undefined, transcript_withheld: !synthetic && Boolean(v.call.transcript?.length) }
      : v.call,
  };
}
