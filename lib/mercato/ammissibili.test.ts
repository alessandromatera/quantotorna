import { describe, expect, it } from "vitest";
import {
  quantiScartati,
  rendimentoAccettabile,
  soloRendimentiAccettabili,
} from "./ammissibili";

describe("rendimentoAccettabile", () => {
  it("scarta un rendimento netto negativo", () => {
    expect(rendimentoAccettabile(-0.01)).toBe(false);
    expect(rendimentoAccettabile(-2.5)).toBe(false);
  });

  it("tiene lo zero: è un pareggio, non una perdita", () => {
    expect(rendimentoAccettabile(0)).toBe(true);
  });

  it("tiene i rendimenti positivi", () => {
    expect(rendimentoAccettabile(3.12)).toBe(true);
  });

  it("tiene il rendimento non calcolabile: null non è negativo", () => {
    expect(rendimentoAccettabile(null)).toBe(true);
  });
});

describe("soloRendimentiAccettabili", () => {
  const righe = [
    { isin: "A", ytmNettoPct: 3 },
    { isin: "B", ytmNettoPct: -0.4 },
    { isin: "C", ytmNettoPct: null },
    { isin: "D", ytmNettoPct: 0 },
    { isin: "E", ytmNettoPct: -12 },
  ];

  it("toglie solo i negativi e conserva l'ordine", () => {
    expect(soloRendimentiAccettabili(righe).map((r) => r.isin)).toEqual([
      "A",
      "C",
      "D",
    ]);
  });

  it("non muta l'array in ingresso", () => {
    soloRendimentiAccettabili(righe);
    expect(righe).toHaveLength(5);
  });

  it("conta quanti ne ha tolti", () => {
    expect(quantiScartati(righe)).toBe(2);
    expect(quantiScartati([])).toBe(0);
  });
});
