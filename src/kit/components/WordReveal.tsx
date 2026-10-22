import { motion, useReducedMotion } from "motion/react";
import { cn } from "../lib/cn";

type Props = {
  /** Plain text. Wrap words in *asterisks* to set them in the italic serif accent. */
  text: string;
  as?: "h1" | "h2" | "p";
  className?: string;
  delay?: number;
  /** Seconds between words. */
  gap?: number;
};

/** The obliqq hero headline: each word sharpens out of a blur, left to right. */
export function WordReveal({ text, as = "h1", className, delay = 0.15, gap = 0.05 }: Props) {
  const reduce = useReducedMotion();
  const Tag = motion[as];
  const words = text.split(" ");
  return (
    <Tag className={cn(className)} aria-label={text.replace(/\*/g, "")}>
      {words.map((raw, i) => {
        const serif = raw.startsWith("*") && raw.endsWith("*");
        const word = raw.replace(/\*/g, "");
        return (
          <span key={i} aria-hidden className="inline-block whitespace-pre">
            <motion.span
              className={cn("inline-block", serif && "t-serif pr-[0.04em]")}
              initial={reduce ? { opacity: 0 } : { opacity: 0.001, filter: "blur(10px)", y: 10 }}
              animate={reduce ? { opacity: 1 } : { opacity: 1, filter: "blur(0px)", y: 0 }}
              transition={reduce ? { duration: 0.2, delay } : { type: "spring", stiffness: 163, damping: 40, mass: 1, delay: delay + i * gap }}
            >
              {word}
            </motion.span>
            {i < words.length - 1 ? " " : ""}
          </span>
        );
      })}
    </Tag>
  );
}
