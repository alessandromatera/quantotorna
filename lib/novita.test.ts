import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isDataISO } from "./date";
import { changelogMarkdown, NOVITA } from "./novita";

describe("novità", () => {
  it("CHANGELOG.md è quello che si genera da lib/novita.ts (npm run changelog)", () => {
    const file = readFileSync(new URL("../CHANGELOG.md", import.meta.url), "utf8");
    expect(file).toBe(changelogMarkdown());
  });

  it("date vere, dalla più recente, una sola volta, e nessun giorno vuoto", () => {
    const date = NOVITA.map((n) => n.data);
    expect(date.every(isDataISO)).toBe(true);
    expect([...date].sort().reverse()).toEqual(date);
    expect(new Set(date).size).toBe(date.length);
    expect(NOVITA.every((n) => n.voci.length > 0)).toBe(true);
  });
});
