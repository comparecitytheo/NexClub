import { describe, it, expect } from "vitest";
import {
  optionalText,
  optionalEmail,
  optionalNumber,
  optionalDate,
  optionalId,
  optionalTags,
} from "@/server/validators/shared";

describe("optionalText", () => {
  const s = optionalText(10);
  it("passes through non-empty text", () => expect(s.parse("hi")).toBe("hi"));
  it("turns empty, null, undefined into undefined", () => {
    expect(s.parse("")).toBeUndefined();
    expect(s.parse(null)).toBeUndefined();
    expect(s.parse(undefined)).toBeUndefined();
  });
  it("enforces the max length", () => {
    expect(() => s.parse("12345678901")).toThrow();
  });
});

describe("optionalEmail", () => {
  const e = optionalEmail();
  it("accepts a valid email", () => expect(e.parse("a@b.com")).toBe("a@b.com"));
  it("treats blank as undefined", () => expect(e.parse("")).toBeUndefined());
  it("rejects a malformed email", () => expect(() => e.parse("nope")).toThrow());
});

describe("optionalNumber", () => {
  const n = optionalNumber();
  it("coerces numeric strings", () => expect(n.parse("42")).toBe(42));
  it("passes numbers through", () => expect(n.parse(7)).toBe(7));
  it("treats blank as undefined", () => expect(n.parse("")).toBeUndefined());
});

describe("optionalDate", () => {
  const d = optionalDate();
  it("parses a date string into a Date", () => expect(d.parse("2026-03-09")).toBeInstanceOf(Date));
  it("treats blank as undefined", () => expect(d.parse("")).toBeUndefined());
});

describe("optionalId", () => {
  const id = optionalId();
  it("passes ids through and blanks to undefined", () => {
    expect(id.parse("abc")).toBe("abc");
    expect(id.parse("")).toBeUndefined();
  });
});

describe("optionalTags", () => {
  const t = optionalTags();
  it("splits a comma string into trimmed tags", () => expect(t.parse("a, b , c")).toEqual(["a", "b", "c"]));
  it("passes arrays through", () => expect(t.parse(["x", "y"])).toEqual(["x", "y"]));
  it("drops empty entries", () => expect(t.parse("a,,b,")).toEqual(["a", "b"]));
});
