import { describe, expect, it } from "vitest";
import { analyze, normalize, tokenize } from "../featurize.js";

describe("featurize: PII redaction", () => {
  it("replaces phone numbers, UPI IDs, account numbers, cards and URLs with placeholders", () => {
    const text = "Pay to rahul.k@okdemo or call +91 90000 12345, a/c 123456789012, card 4111 1111 1111 1111, see http://sbi-kyc.xyz/x and bit.ly/abc";
    const toks = tokenize(text).map((t) => t.text);
    expect(toks).toEqual(expect.arrayContaining(["xhandle", "xphone", "xnum", "xurl"]));
    const joined = toks.join(" ");
    for (const raw of ["rahul", "okaxis", "90000", "12345", "123456789012", "4111", "sbi", "bit"]) expect(joined).not.toContain(raw);
  });

  it("keeps APK file names as a single cue token", () => {
    expect(normalize("download PM_Kisan.apk now")).toBe("download xapk now");
  });

  it("returns spans that slice the original text", () => {
    const text = "OTP mat batana, call 9000012345!";
    for (const t of tokenize(text)) expect(text.slice(t.start, t.end).length).toBeGreaterThan(0);
    const phone = tokenize(text).find((t) => t.text === "xphone")!;
    expect(text.slice(phone.start, phone.end)).toBe("9000012345");
  });
});

describe("featurize: normalisation", () => {
  it("lower-cases, maps every script's digits to 0 and turns ₹ into rs", () => {
    expect(normalize("₹5,000 भेजो १२३ ১২")).toBe("rs 0 000 भेजो 000 00");
  });

  it("drops nukta and maps chandrabindu to anusvara so spelling variants match", () => {
    expect(normalize("गिरफ़्तार")).toBe(normalize("गिरफ्तार"));
    expect(normalize("माँ")).toBe(normalize("मां"));
  });

  it("keeps ZWJ conjuncts as one token", () => {
    expect(tokenize("क्‍ष").length).toBe(1);
  });

  it("handles empty and punctuation-only input", () => {
    expect(tokenize("")).toEqual([]);
    expect(analyze("!!! ???")).toEqual([]);
  });

  it("emits word, bigram and char 2..5-gram features", () => {
    const f = analyze("kyc block");
    expect(f).toContain("w:kyc");
    expect(f).toContain("b:kyc_block");
    expect(f).toContain("c: k");
    expect(f).toContain("c:bloc");
    expect(f).toContain("c:lock ");
  });
});
