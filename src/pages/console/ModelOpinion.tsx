import { Cpu, Eye } from "lucide-react";
import { Panel } from "../../kit";
import type { Check } from "../../../shared/types";
import { dateTime } from "./fmt";
import { Chip } from "./ui";

/**
 * The on-server text model's read of what the customer said. Declared locally
 * (it mirrors ModelOpinion in shared/types.ts) and read defensively, because the
 * field is new and older checks don't carry it.
 */
interface Opinion {
  source: "evidence" | "transcript";
  band: "likely_scam" | "possible_scam" | "unlikely_scam" | "unknown";
  scam_probability: number | null;
  patterns: { id: string; name: string; p_given_scam: number | null }[];
  cues: string[];
  model_version: string | null;
  disagrees_with_decision?: boolean;
  at: string;
}

export function opinionOf(c: Check): Opinion | null {
  const ml = (c as Check & { ml?: Opinion }).ml;
  return ml && typeof ml === "object" && typeof ml.band === "string" ? ml : null;
}

const BAND: Record<Opinion["band"], string> = {
  likely_scam: "Likely scam",
  possible_scam: "Possible scam",
  unlikely_scam: "Unlikely scam",
  unknown: "No clear read",
};

/** Advisory only: shown beside the policy's decision, never inside it. */
export function ModelOpinionPanel({ c }: { c: Check }) {
  const ml = opinionOf(c);
  if (!ml) return null;
  const tone = ml.band === "likely_scam" ? "var(--stop)" : ml.band === "possible_scam" ? "var(--sev-high)" : ml.band === "unlikely_scam" ? "var(--go)" : "var(--muted)";
  return (
    <Panel
      title={
        <span className="inline-flex items-center gap-2">
          <Cpu className="size-4 text-muted" strokeWidth={1.7} aria-hidden />
          Text model, advisory
        </span>
      }
      description={`Reads the customer's ${ml.source === "transcript" ? "own turns in the transcript" : "words in the agent's evidence quotes"}. Never used by the decision policy.`}
    >
      {ml.disagrees_with_decision && (
        <p className="mb-4 flex gap-2.5 rounded-2xl bg-stop-soft px-3.5 py-3 text-[13px] leading-relaxed text-ink">
          <Eye className="mt-0.5 size-4 shrink-0 text-stop" strokeWidth={1.8} aria-hidden />
          The model leans scam but the payment was released. A person on the fraud team should look at this one.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Chip>
          <span className="size-2 rounded-full" style={{ background: tone }} aria-hidden />
          {BAND[ml.band] ?? ml.band}
        </Chip>
      </div>
      {ml.patterns.length > 0 && (
        <>
          {/* Patterns in the model's order of likelihood; no percentages, which would overstate its precision. */}
          <p className="t-eyebrow mt-4 !text-[10.5px]">Closest patterns, most likely first</p>
          <ol className="mt-2 space-y-1.5 text-[13px] text-ink-2">
            {ml.patterns.map((p, i) => (
              <li key={p.id} className="flex gap-2">
                <span className="t-num text-muted">{i + 1}.</span>
                <span className="min-w-0 truncate">{p.name}</span>
              </li>
            ))}
          </ol>
        </>
      )}
      {ml.cues.length > 0 && (
        <div className="mt-4">
          <p className="t-eyebrow !text-[10.5px]">Cues it saw</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {ml.cues.map((cue) => (
              <span key={cue} lang={/[ऀ-ॿ]/.test(cue) ? "hi" : undefined} className="rounded-md bg-paper-3 px-2 py-0.5 text-[12px] text-ink-2">
                {cue}
              </span>
            ))}
          </div>
        </div>
      )}
      <p className="mt-4 border-t border-hair pt-3 text-[12px] text-muted">
        {ml.model_version ? `Model ${ml.model_version} · ` : ""}
        {dateTime(ml.at)} IST
      </p>
    </Panel>
  );
}
