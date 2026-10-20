import { describe, expect, it } from "vitest";
import { arrotondaCentesimi, eurCent, formatEuro, inEuro } from "./money";

describe("arrotondaCentesimi — metà allontanata dallo zero", () => {
  it("arrotonda 234,5 verso l'alto", () => {
    expect(arrotondaCentesimi(234.5)).toBe(235);
  });
  it("arrotonda 234,4 verso il basso", () => {
    expect(arrotondaCentesimi(234.4)).toBe(234);
  });
  it("è simmetrico sui negativi: −234,5 → −235", () => {
    expect(arrotondaCentesimi(-234.5)).toBe(-235);
  });
  it("zero resta zero", () => {
    expect(arrotondaCentesimi(0)).toBe(0);
  });
});

describe("conversioni euro/centesimi", () => {
  it("eurCent: 5.000 € → 500000", () => {
    expect(eurCent(5_000)).toBe(500000);
  });
  it("eurCent: 45,12 € → 4512", () => {
    expect(eurCent(45.12)).toBe(4512);
  });
  it("inEuro: 4512 → 45,12", () => {
    expect(inEuro(4512)).toBeCloseTo(45.12, 10);
  });
  it("formatEuro usa il formato italiano", () => {
    expect(formatEuro(123456)).toBe("1.234,56 €");
    expect(formatEuro(9_876_543)).toBe("98.765,43 €");
    expect(formatEuro(-14400)).toBe("-144,00 €");
    expect(formatEuro(5)).toBe("0,05 €");
  });
});
