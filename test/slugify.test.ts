import { describe, it, expect } from "vitest";
import { slugifyFilename, slugifyUnique } from "../src/utils/slugify";

describe("slugifyFilename", () => {
  it("strips extension and lowercases", () => {
    expect(slugifyFilename("m_h_01.PNG")).toBe("m_h_01");
  });

  it("collapses spaces and hyphens into underscores", () => {
    expect(slugifyFilename("Male Happy 01.png")).toBe("male_happy_01");
    expect(slugifyFilename("male-happy-01.png")).toBe("male_happy_01");
  });

  it("collapses consecutive separators", () => {
    expect(slugifyFilename("foo   bar___baz.png")).toBe("foo_bar_baz");
  });

  it("strips leading and trailing underscores", () => {
    expect(slugifyFilename("---weird_.JPG")).toBe("weird");
  });

  it("preserves digits", () => {
    expect(slugifyFilename("123.png")).toBe("123");
  });

  it("falls back deterministically when nothing usable remains", () => {
    const a = slugifyFilename("___.png");
    const b = slugifyFilename("___.png");
    expect(a).toBe(b);
    expect(a).toMatch(/^img_[0-9a-f]+$/);
  });
});

describe("slugifyUnique", () => {
  it("returns base when unused", () => {
    const used = new Set<string>();
    const r = slugifyUnique("m_h_01.png", used);
    expect(r.id).toBe("m_h_01");
    expect(r.taken).toBe(false);
    expect(used.has("m_h_01")).toBe(true);
  });

  it("appends _2, _3 on collisions", () => {
    const used = new Set(["m_h_01"]);
    const r1 = slugifyUnique("m_h_01.png", used);
    expect(r1.id).toBe("m_h_01_2");
    expect(r1.taken).toBe(true);
    const r2 = slugifyUnique("m_h_01.png", used);
    expect(r2.id).toBe("m_h_01_3");
  });
});
