import { describe, expect, it } from "vitest";
import { isScriptedTestRun } from "../server/app.js";
import { fakeBolna, makeApp, req } from "./helpers.js";

/**
 * Our own scripted live test calls (scripts/live-call.mjs) have a text-to-speech
 * "customer", so the console may say so and show their transcript. Only the owner's
 * access code can tag a call that way; a judge's or visitor's call never is.
 */
const OWNER = "RUKO-OWNERTESTCODE";
const JUDGE = "JUDGE1-TESTCODE";
let runs = 0;
function liveApp() {
  const fb = fakeBolna({
    "GET /user/me": () => ({ wallet: 480 }),
    "POST /web-call/freeswitch-session": () => ({
      run_id: `run-scr-${String(++runs).padStart(6, "0")}`,
      agent_id: "agent-check",
      sip_username: "u",
      sip_password: "p",
      sip_domain: "d",
      wss_url: "wss://x",
      sip_register: false,
      expires_in: 60,
      ice_servers: [],
    }),
  });
  return makeApp(
    { bolnaApiKey: "bn-test", agents: { check: "agent-check", contact: "agent-contact", line: "agent-line" }, accessCodes: [OWNER, JUDGE], ownerCode: OWNER, dailyCallCap: 10, perCodeDailyCap: 10 },
    fb.client,
  );
}

async function payAndMint(app: ReturnType<typeof makeApp>, code: string, scripted: boolean, ip: string) {
  const c = (await (await app.handle(req("POST", "/api/demo/pay", { scenario: "digital-arrest", language: "en" }, { "x-forwarded-for": ip }))).json()) as {
    id: string;
    client_secret: string;
  };
  const body = scripted ? { access_code: code, scripted_test: true } : { access_code: code };
  expect((await app.handle(req("POST", `/api/demo/checks/${c.id}/session`, body, { "X-Client-Secret": c.client_secret, "x-forwarded-for": ip }))).status).toBe(200);
  return (await (await app.handle(req("GET", `/api/console/checks/${c.id}?tenant=sandbox`))).json()) as { test_run?: string; events: { type: string }[] };
}

describe("scripted test runs", () => {
  it("the owner's code with scripted_test tags the check", async () => {
    const view = await payAndMint(liveApp(), OWNER, true, "198.51.100.70");
    expect(view.test_run).toBe("scripted-tts");
    expect(view.events.some((e) => e.type === "test.scripted")).toBe(true);
  });

  it("a judge's code cannot tag a call, and neither can the owner's without the flag", async () => {
    const app = liveApp();
    expect((await payAndMint(app, JUDGE, true, "198.51.100.71")).test_run).toBeUndefined();
    expect((await payAndMint(app, OWNER, false, "198.51.100.72")).test_run).toBeUndefined();
  });

  it("recognises the five scripted calls of 23 Oct by execution id", () => {
    expect(isScriptedTestRun({ call: { execution_id: "9f893617-24cd-4d04-a693-5ae88ee06554" } as never })).toBe(true);
    expect(isScriptedTestRun({ call: { execution_id: "some-visitor-call" } as never })).toBe(false);
    expect(isScriptedTestRun({ test_run: "scripted-tts" })).toBe(true);
  });
});
