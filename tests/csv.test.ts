import { describe, it, expect } from "vitest";
import { toCsv, parseCsv, pick } from "@/lib/csv";

describe("toCsv", () => {
  it("joins headers and rows with CRLF", () => {
    expect(toCsv(["a", "b"], [[1, 2], [3, 4]])).toBe("a,b\r\n1,2\r\n3,4");
  });
  it("quotes fields containing commas", () => {
    expect(toCsv(["x"], [["a,b"]])).toBe('x\r\n"a,b"');
  });
  it("escapes embedded quotes by doubling", () => {
    expect(toCsv(["x"], [['he said "hi"']])).toBe('x\r\n"he said ""hi"""');
  });
  it("renders null and undefined as empty", () => {
    expect(toCsv(["x", "y"], [[null, undefined]])).toBe("x,y\r\n,");
  });
});

describe("parseCsv", () => {
  it("parses rows into objects keyed by header", () => {
    expect(parseCsv("name,age\nAlice,30\nBob,25")).toEqual([
      { name: "Alice", age: "30" },
      { name: "Bob", age: "25" },
    ]);
  });
  it("handles quoted commas and embedded newlines", () => {
    const rows = parseCsv('name,note\n"Smith, John","a\nb"');
    expect(rows[0].name).toBe("Smith, John");
    expect(rows[0].note).toBe("a\nb");
  });
  it("unescapes doubled quotes", () => {
    expect(parseCsv('q\n"say ""hi"""')[0].q).toBe('say "hi"');
  });
  it("strips a BOM and skips blank lines", () => {
    expect(parseCsv("\uFEFFa\n1\n\n2")).toEqual([{ a: "1" }, { a: "2" }]);
  });
  it("returns an empty array for empty input", () => {
    expect(parseCsv("")).toEqual([]);
  });
});

describe("pick", () => {
  const row = { "First Name": "Jane", Email: "jane@x.com" };
  it("matches header names case-insensitively", () => {
    expect(pick(row, "first name")).toBe("Jane");
  });
  it("tries fallback names in order", () => {
    expect(pick(row, "contactName", "First Name")).toBe("Jane");
  });
  it("returns an empty string when nothing matches", () => {
    expect(pick(row, "phone")).toBe("");
  });
});
