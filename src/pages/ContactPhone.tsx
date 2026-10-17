import { useCallback, useEffect, useState } from "react";
import { PhoneIncoming, PhoneOff } from "lucide-react";
import type { AppStatus } from "../../shared/types";
import { api } from "../lib/api";
import { useBolnaCall } from "../lib/useBolnaCall";
import { Phone, StatusBar } from "../components/demo/Phone";
import { RukoMark } from "../components/brand/RukoLogo";

/**
 * The trusted contact's "phone" for the demo, opened on a second device:
 * /contact/<check id>?cs=<client secret>. When Ruko asks to call the contact
 * (and phone calls are off), the call rings here as a Bolna web call.
 */
export default function ContactPhone() {
  const id = window.location.pathname.split("/")[2] ?? "";
  const cs = new URLSearchParams(window.location.search).get("cs") ?? "";
  const [status, setStatus] = useState<AppStatus | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      while (alive) {
        try {
          setStatus(await api.status(id, cs));
        } catch (e) {
          setErr((e as Error).message);
        }
        await new Promise((r) => setTimeout(r, 1500));
      }
    };
    void tick();
    return () => {
      alive = false;
    };
  }, [id, cs]);

  const mint = useCallback(async () => {
    const res = await fetch(`/api/demo/checks/${id}/contact-session`, { method: "POST", headers: { "Content-Type": "application/json", "X-Client-Secret": cs }, body: "{}" });
    const j = await res.json();
    if (!res.ok) throw Object.assign(new Error(j?.error?.message ?? "Could not connect"), { code: j?.error?.code });
    return j;
  }, [id, cs]);
  const call = useBolnaCall(mint);
  const ringing = status?.contact?.status === "ringing_web" && call.state !== "active" && call.state !== "ended";
  const tc = status?.trusted_contact;

  return (
    <main id="main" className="grid min-h-[100dvh] place-items-center bg-paper px-4 py-10">
      <div className="w-full max-w-[360px]">
        <p className="t-eyebrow mb-4 text-center">Trusted contact's phone · demo</p>
        <Phone label="Trusted contact's phone">
          <StatusBar />
          <div className="flex flex-1 flex-col items-center px-6 pb-8 pt-10 text-center">
            <RukoMark motion={ringing || call.state === "active" ? "live" : "none"} className="h-24 w-24 text-ink" />
            <p className="mt-5 font-display text-[22px] font-semibold text-ink">{tc ? tc.name : "Waiting"}</p>
            <p className="mt-1 text-[13.5px] text-ink-2">
              {call.state === "active"
                ? "On a call with Ruko"
                : ringing
                  ? `Ruko is calling about ${status?.customer_name}'s payment`
                  : status?.contact?.status === "reached"
                    ? "Thanks. Ruko has noted your answer."
                    : "Ruko will ring here if the customer asks for you."}
            </p>
            {err && <p className="mt-3 text-[12.5px] text-stop">{err}</p>}
            {call.error && <p className="mt-3 text-[12.5px] text-stop">{call.error.message}</p>}
            <div className="mt-auto flex gap-6">
              {ringing && (
                <button onClick={() => void call.start()} aria-label="Answer" className="ring-focus grid size-16 place-items-center rounded-full bg-go text-[#0b111c] hover:brightness-110">
                  <PhoneIncoming size={24} />
                </button>
              )}
              {call.state === "active" && (
                <button onClick={() => void call.stop()} aria-label="Hang up" className="ring-focus grid size-16 place-items-center rounded-full bg-stop text-white hover:brightness-110">
                  <PhoneOff size={24} />
                </button>
              )}
            </div>
          </div>
        </Phone>
      </div>
    </main>
  );
}
