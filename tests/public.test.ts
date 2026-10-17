import { describe, expect, it } from "vitest";
import { MemoryStore } from "../server/store/store.js";
import { publicChat, readStats } from "../server/public.js";
import { redactPII } from "../server/llm/nebius.js";
import { makeApp, req } from "./helpers.js";

describe("public text checker", () => {
  it("redacts numbers, UPI IDs, emails and links before anything leaves the server", () => {
    const s = redactPII("He called from +91 98765 43210, asked me to pay rk.desk@okaxis, mail me at a.b@gmail.com, see https://evil.example/x, OTP 482913");
    expect(s).not.toMatch(/98765|43210|rk\.desk|okaxis|gmail|evil\.example|482913/);
    expect(s).toMatch(/\[number\]/);
    expect(s).toMatch(/\[upi id\]|\[email\]/);
    expect(s).toMatch(/\[link\]/);
  });

  it("sends only redacted text to the LLM, returns the library's official wording, and counts anonymously", async () => {
    const kv = new MemoryStore();
    const seen: string[] = [];
    const fakeLlm = async (messages: { role: string; content: string }[]) => {
      seen.push(...messages.map((m) => m.content));
      return JSON.stringify({ reply: "This is a digital arrest fraud. Hang up and call 1930.", risk: "likely_scam", pattern_id: "digital_arrest", next_question: "" });
    };
    const r = await publicChat(
      kv,
      { language: "en", messages: [{ role: "user", content: "A CBI officer on video call from +91 98765 43210 says I am under digital arrest and must pay to rk.safe@okicici" }] },
      { visitorKey: "v1", dailyCap: 10, perHour: 10, llm: fakeLlm as never },
    );
    expect(r.method).toBe("llm+library");
    expect(r.pattern?.id).toBe("digital_arrest");
    expect(r.truth).toMatch(/no 'digital arrest' in Indian law/);
    expect(r.sources.length).toBeGreaterThan(0);
    expect(seen.join(" ")).not.toMatch(/98765|rk\.safe|okicici/);
    const stats = await readStats(kv);
    expect(stats.checks).toBe(1);
    expect(stats.conversations).toBe(1);
    expect(stats.by_pattern.digital_arrest).toBe(1);
    const reports = (await kv.get<string[]>("index:reports")) ?? [];
    const rep = await kv.get<{ summary: string }>(`report:${reports[0]}`);
    expect(rep?.summary).not.toMatch(/98765|okicici/);
  });

  it("falls back to the rule-based library when the LLM is unavailable or over its daily cap", async () => {
    const kv = new MemoryStore();
    const broken = async () => {
      throw new Error("down");
    };
    const r = await publicChat(kv, { language: "hi", messages: [{ role: "user", content: "Someone says my parcel from FedEx has drugs and customs will arrest me" }] }, { visitorKey: "v2", dailyCap: 10, perHour: 10, llm: broken as never });
    expect(r.method).toBe("library-only");
    expect(r.pattern).not.toBeNull();
  });

  it("rate-limits per visitor with a friendly message", async () => {
    const kv = new MemoryStore();
    const llm = async () => JSON.stringify({ reply: "ok", risk: "unclear", pattern_id: "none" });
    const body = { language: "en", messages: [{ role: "user", content: "Someone asked me to pay a fee for a prize" }] };
    await publicChat(kv, body, { visitorKey: "v3", dailyCap: 10, perHour: 2, llm: llm as never });
    await publicChat(kv, body, { visitorKey: "v3", dailyCap: 10, perHour: 2, llm: llm as never });
    await expect(publicChat(kv, body, { visitorKey: "v3", dailyCap: 10, perHour: 2, llm: llm as never })).rejects.toThrow(/try again/);
    // A different visitor is unaffected.
    await expect(publicChat(kv, body, { visitorKey: "v4", dailyCap: 10, perHour: 2, llm: llm as never })).resolves.toBeTruthy();
  });
});

describe("free sandbox", () => {
  it("is never throttled by the paid-call gate or by normal use", async () => {
    const app = makeApp();
    for (let i = 0; i < 60; i++) {
      const r = await app.handle(req("POST", "/api/demo/pay", { scenario: "digital-arrest", language: "en" }, { "X-Forwarded-For": "203.0.113.7" }));
      expect(r.status).toBe(201);
    }
  });

  it("keys visitors by x-forwarded-for, so one visitor can't exhaust another's bucket", async () => {
    const app = makeApp({ env: "production" });
    let last = 201;
    for (let i = 0; i < 241; i++) last = (await app.handle(req("POST", "/api/demo/pay", { scenario: "rent" }, { "X-Forwarded-For": "198.51.100.1" }))).status;
    expect(last).toBe(429);
    const other = await app.handle(req("POST", "/api/demo/pay", { scenario: "rent" }, { "X-Forwarded-For": "198.51.100.2" }));
    expect(other.status).toBe(201);
  });
});
