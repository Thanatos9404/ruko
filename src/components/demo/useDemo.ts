import { useCallback, useEffect, useRef, useState } from "react";
import type { AppStatus, Lang } from "../../../shared/types";
import { api, ApiError, type DemoCheck } from "../../lib/api";
import { useBolnaCall } from "../../lib/useBolnaCall";

export type Phase = "pay" | "checking" | "allowed" | "hold" | "call" | "outcome";
export type Mode = "replay" | "live" | null;

export interface Caption {
  role: "agent" | "customer";
  text: string;
}

interface ReplayFile {
  recorded_code_word: string | null;
  turns: ({ role: "agent" | "customer"; text: string } | { role: "tool"; tool: string; args: Record<string, unknown> })[];
}

const CODE_KEY = "ruko.access";

export function readAccessCode(): string {
  try {
    return sessionStorage.getItem(CODE_KEY) ?? "";
  } catch {
    return "";
  }
}
export function saveAccessCode(code: string) {
  try {
    sessionStorage.setItem(CODE_KEY, code);
  } catch {
    /* private mode: fine, ask again next time */
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const HI_WORDS: Record<string, string> = {
  NEEM: "नीम", TULSI: "तुलसी", GULAB: "गुलाब", KAMAL: "कमल", MOTI: "मोती", BADAL: "बादल", SURAJ: "सूरज", TARA: "तारा", SAGAR: "सागर", NADI: "नदी",
  PARVAT: "पर्वत", PEEPAL: "पीपल", ASHOK: "अशोक", MOR: "मोर", HIRAN: "हिरन", TOTA: "तोता", AAM: "आम", ANAR: "अनार", KELA: "केला", JAMUN: "जामुन",
  CHANDA: "चंदा", DHOOP: "धूप", BARISH: "बारिश", HAVA: "हवा", DIYA: "दीया", PATANG: "पतंग", KESAR: "केसर", ELAICHI: "इलायची", MOGRA: "मोगरा", CHAMPA: "चंपा",
};
export const codeWordFor = (code: string | undefined, lang: Lang) => {
  if (!code) return "";
  if (lang !== "hi") return code;
  const [w, n] = code.split(" ");
  return `${HI_WORDS[w] ?? w} ${n ?? ""}`.trim();
};

/**
 * Drives one sandbox payment: pay → hold → call (recorded replay or live Bolna
 * web call) → outcome, polling the engine for its live state throughout.
 */
export function useDemo() {
  const [scenario, setScenario] = useState("digital-arrest");
  const [lang, setLang] = useState<Lang>("en");
  const [phase, setPhase] = useState<Phase>("pay");
  const [mode, setMode] = useState<Mode>(null);
  const [check, setCheck] = useState<DemoCheck | null>(null);
  const [status, setStatus] = useState<AppStatus | null>(null);
  const [captions, setCaptions] = useState<Caption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const runToken = useRef(0);
  const checkRef = useRef<DemoCheck | null>(null);
  checkRef.current = check;

  const mint = useCallback(async () => {
    const c = checkRef.current!;
    const res = await fetch(`/api/demo/checks/${c.id}/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Client-Secret": c.client_secret ?? "" },
      body: JSON.stringify({ access_code: readAccessCode() }),
    });
    const j = await res.json();
    if (!res.ok) throw Object.assign(new Error(j?.error?.message ?? "Could not start the call"), { code: j?.error?.code ?? "mint_failed" });
    return j;
  }, []);
  const mintContact = useCallback(async () => {
    const c = checkRef.current!;
    const res = await fetch(`/api/demo/checks/${c.id}/contact-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Client-Secret": c.client_secret ?? "" },
      body: "{}",
    });
    const j = await res.json();
    if (!res.ok) throw Object.assign(new Error(j?.error?.message ?? "Could not ring the contact"), { code: j?.error?.code ?? "mint_failed" });
    return j;
  }, []);
  const call = useBolnaCall(mint);
  const contactCall = useBolnaCall(mintContact);

  // Poll the engine while a check is in flight.
  useEffect(() => {
    if (!check || check.action !== "hold") return;
    let alive = true;
    let quiet = 0;
    let last = "";
    const tick = async () => {
      while (alive) {
        try {
          const s = await api.status(check.id, check.client_secret ?? "");
          if (!alive) return;
          const sig = JSON.stringify([s.events.length, s.decision?.outcome, s.contact?.status, s.call?.status]);
          quiet = sig === last ? quiet + 1 : 0;
          last = sig;
          setStatus(s);
          const settled = s.decision && !["dialing", "ringing_web"].includes(s.contact?.status ?? "") && call.state !== "active" && contactCall.state !== "active";
          if (settled && quiet > 20) return;
        } catch {
          /* transient: keep polling */
        }
        await sleep(900);
      }
    };
    void tick();
    return () => {
      alive = false;
    };
  }, [check, call.state, contactCall.state]);

  // Move to the outcome screen once the policy has decided.
  useEffect(() => {
    if (status?.decision && (phase === "call" || phase === "hold")) {
      const t = setTimeout(() => setPhase("outcome"), mode === "live" ? 2500 : 900);
      return () => clearTimeout(t);
    }
  }, [status?.decision, phase, mode]);

  const reset = useCallback(() => {
    runToken.current++;
    void call.stop();
    void contactCall.stop();
    setPhase("pay");
    setMode(null);
    setCheck(null);
    setStatus(null);
    setCaptions([]);
    setError(null);
    setStartedAt(null);
  }, [call, contactCall]);

  const pay = useCallback(async () => {
    setError(null);
    setPhase("checking");
    try {
      const c = await api.pay(scenario, lang);
      setCheck(c);
      setStartedAt(Date.now());
      await sleep(700);
      setPhase(c.action === "hold" ? "hold" : "allowed");
    } catch (e) {
      const err = e as ApiError;
      setError(
        err.status === 429
          ? err.message
          : err.status >= 500 || !err.status
            ? "The sandbox bank didn't answer. Check your connection and try again."
            : err.message,
      );
      setPhase("pay");
    }
  }, [scenario, lang]);

  const startReplay = useCallback(async () => {
    const c = checkRef.current;
    if (!c) return;
    const token = ++runToken.current;
    setMode("replay");
    setPhase("call");
    setCaptions([]);
    setError(null);
    let file: ReplayFile;
    try {
      const r = await fetch(`/replays/${scenario}-${lang}.json`);
      if (!r.ok) throw new Error("missing");
      file = (await r.json()) as ReplayFile;
    } catch {
      setError("The recorded run for this scenario isn't available.");
      return;
    }
    const newCode = codeWordFor(c.code_word, lang);
    const swap = (t: string) => {
      let out = t;
      if (file.recorded_code_word) out = out.split(file.recorded_code_word).join(newCode);
      return out;
    };
    for (const t of file.turns) {
      if (runToken.current !== token) return;
      if (t.role === "tool") {
        try {
          const r = await api.replay(c.id, c.client_secret ?? "", t.tool, t.args);
          if (runToken.current !== token) return;
          setStatus(r.status);
        } catch (e) {
          if (e instanceof ApiError) setError(e.message);
        }
        await sleep(450);
      } else {
        const text = swap(t.text);
        setCaptions((cs) => [...cs, { role: t.role, text }]);
        const words = text.split(/\s+/).length;
        await sleep(Math.min(5000, Math.max(1200, (words / 3.6) * 1000)));
      }
    }
  }, [scenario, lang]);

  const startLive = useCallback(async () => {
    setMode("live");
    setPhase("call");
    setCaptions([]);
    await call.start();
  }, [call]);

  return {
    scenario,
    setScenario,
    lang,
    setLang,
    phase,
    mode,
    check,
    status,
    captions,
    error,
    startedAt,
    call,
    contactCall,
    pay,
    reset,
    startReplay,
    startLive,
  };
}

export type DemoState = ReturnType<typeof useDemo>;
