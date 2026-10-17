import { AnimatePresence, motion } from "motion/react";
import { KeyRound, Loader2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api } from "../../lib/api";
import { EASE } from "../../kit";
import { saveAccessCode } from "./useDemo";

/**
 * Live calls spend real Bolna credits, so they need an access code (given to
 * judges). Everyone else gets the recorded run, which still goes through the
 * real engine.
 */
export function AccessDialog({ open, onClose, onOk }: { open: boolean; onClose: () => void; onOk: () => void }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setErr(null);
      setTimeout(() => input.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const r = await api.verifyCode(code.trim());
      if (r.valid) {
        saveAccessCode(code.trim());
        onOk();
      } else setErr("That code isn't valid. Use the recorded run instead, or ask the team for a code.");
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[80] grid place-items-center bg-black/60 px-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.form
            role="dialog"
            aria-modal="true"
            aria-labelledby="access-title"
            onSubmit={submit}
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, y: 16, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.4, ease: EASE }}
            className="card w-full max-w-[420px] p-6"
          >
            <div className="flex items-start justify-between">
              <span className="grid size-10 place-items-center rounded-full bg-[var(--accent-soft)] text-accent">
                <KeyRound size={18} />
              </span>
              <button type="button" onClick={onClose} aria-label="Close" className="ring-focus grid size-9 place-items-center rounded-full text-muted hover:text-ink">
                <X size={18} />
              </button>
            </div>
            <h2 id="access-title" className="t-h3 mt-4">
              Talk to Ruko live
            </h2>
            <p className="mt-2 text-[14px] leading-relaxed text-ink-2">
              Live calls use a real Bolna voice agent in your browser, and the demo runs on a small, fixed credit budget. Enter the access code you were given. Without one, the recorded run shows the same flow through the real engine.
            </p>
            <label htmlFor="access-code" className="t-eyebrow mt-5 block">
              Access code
            </label>
            <input
              ref={input}
              id="access-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              className="mt-2 h-11 w-full rounded-xl border border-hair bg-paper-2 px-3 font-mono text-[15px] text-ink outline-none focus:border-[var(--hair-strong)]"
            />
            {err && <p className="mt-2 text-[13px] text-stop">{err}</p>}
            <p className="mt-3 text-[12px] text-muted">Your browser will ask for the microphone. Headphones work best.</p>
            <button
              disabled={busy || code.trim().length < 3}
              className="ring-focus mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-ink font-display text-[15px] font-semibold text-paper transition hover:-translate-y-px disabled:opacity-50"
            >
              {busy && <Loader2 size={16} className="animate-spin" />} Start the live call
            </button>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
