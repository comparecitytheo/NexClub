import { describe, it, expect } from "vitest";
import { buildRedaction, NO_REDACTION } from "@/server/ai-redact";

// The AI provider is overseas, so identifiable values are swapped for tokens on
// the way out and swapped back on the way in (APP 8). These tests pin both
// directions, and the cases where naive find-and-replace would corrupt the text.

describe("redact", () => {
  it("replaces a contact name with its token", () => {
    const r = buildRedaction([{ token: "[CONTACT]", value: "Jordan Reyes" }]);
    expect(r.redact("Jordan Reyes is ready to proceed.")).toBe("[CONTACT] is ready to proceed.");
  });

  it("replaces emails and phone numbers", () => {
    const r = buildRedaction([
      { token: "[EMAIL]", value: "jordan@example.com" },
      { token: "[PHONE]", value: "+61 400 123 456" },
    ]);
    const out = r.redact("Reach them on +61 400 123 456 or jordan@example.com.");
    expect(out).not.toContain("jordan@example.com");
    expect(out).not.toContain("+61 400 123 456");
    expect(out).toContain("[EMAIL]");
    expect(out).toContain("[PHONE]");
  });

  it("matches regardless of case", () => {
    const r = buildRedaction([{ token: "[CONTACT]", value: "Jordan Reyes" }]);
    expect(r.redact("spoke to JORDAN REYES today")).toBe("spoke to [CONTACT] today");
  });

  it("replaces the full name before its parts, so nothing is half-tokenised", () => {
    const r = buildRedaction([
      { token: "[CONTACT_FIRST]", value: "Jordan" },
      { token: "[CONTACT]", value: "Jordan Reyes" },
    ]);
    expect(r.redact("Jordan Reyes called")).toBe("[CONTACT] called");
  });

  it("does not match a short name inside an unrelated word", () => {
    // "Ann" must not turn "Announcement" into "[CONTACT]ouncement".
    const r = buildRedaction([{ token: "[CONTACT]", value: "Ann Lee" }]);
    expect(r.redact("Announcement: Ann Lee joined")).toBe("Announcement: [CONTACT] joined");
  });

  it("ignores values too short to match safely", () => {
    const r = buildRedaction([{ token: "[X]", value: "Jo" }]);
    expect(r.redact("Jo and Joanne and jog")).toBe("Jo and Joanne and jog");
  });

  it("ignores empty, whitespace and missing values", () => {
    const r = buildRedaction([
      { token: "[A]", value: null },
      { token: "[B]", value: undefined },
      { token: "[C]", value: "   " },
    ]);
    expect(r.redact("nothing to do here")).toBe("nothing to do here");
  });

  it("gives one token to a value that appears under two labels", () => {
    const r = buildRedaction([
      { token: "[OWNER]", value: "Sam Patel" },
      { token: "[REFERRER]", value: "Sam Patel" },
    ]);
    const out = r.redact("Sam Patel referred it to Sam Patel");
    expect(out).toBe("[OWNER] referred it to [OWNER]");
  });

  it("treats regex characters in a name literally", () => {
    const r = buildRedaction([{ token: "[CONTACT]", value: "O'Brien (Jr.)" }]);
    expect(r.redact("Met O'Brien (Jr.) today")).toContain("[CONTACT]");
  });
});

describe("restore", () => {
  it("puts the real value back into the model's reply", () => {
    const r = buildRedaction([{ token: "[CONTACT]", value: "Jordan Reyes" }]);
    expect(r.restore("[CONTACT] is ready to proceed.")).toBe("Jordan Reyes is ready to proceed.");
  });

  it("restores every occurrence, not just the first", () => {
    const r = buildRedaction([{ token: "[CONTACT]", value: "Jordan Reyes" }]);
    expect(r.restore("[CONTACT] called. Ring [CONTACT] back.")).toBe(
      "Jordan Reyes called. Ring Jordan Reyes back."
    );
  });

  it("round-trips a realistic context block unchanged", () => {
    const original =
      "Lead contact: Jordan Reyes\nEmail: jordan@example.com\nPhone: 0400 123 456\n" +
      "Referred by Sam Patel, assigned to Ann Lee\nNotes: Jordan Reyes wants a call Friday.";
    const r = buildRedaction([
      { token: "[CONTACT]", value: "Jordan Reyes" },
      { token: "[EMAIL]", value: "jordan@example.com" },
      { token: "[PHONE]", value: "0400 123 456" },
      { token: "[REFERRER]", value: "Sam Patel" },
      { token: "[OWNER]", value: "Ann Lee" },
    ]);
    const redacted = r.redact(original);
    expect(redacted).not.toContain("Jordan Reyes");
    expect(redacted).not.toContain("jordan@example.com");
    expect(redacted).not.toContain("Sam Patel");
    expect(r.restore(redacted)).toBe(original);
  });

  it("leaves text alone when there is nothing to redact", () => {
    expect(NO_REDACTION.redact("as-is")).toBe("as-is");
    expect(NO_REDACTION.restore("as-is")).toBe("as-is");
  });
});
