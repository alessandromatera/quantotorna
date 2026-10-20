import { describe, expect, it } from "vitest";
import { euroInInput, formatMeseIT, formatPrezzoMot, numeroInInput, parseEuroInCentesimi, parseNumeroIT, parseQuantitaIT } from "./format";

describe("lettura degli importi scritti all'italiana", () => {
  it.each([
    ["1.234,56", 123456],
    ["5.000", 500000],
    ["5.000,00", 500000],
    ["1.250.000", 125000000],
    ["1234.56", 123456],
    ["9.5", 950],
    ["19", 1900],
    ["  12,30 € ", 1230],
  ])("%s → %d centesimi", (testo, atteso) => {
    expect(parseEuroInCentesimi(testo)).toBe(atteso);
  });
  it("rifiuta testo non numerico e il vuoto", () => {
    expect(parseEuroInCentesimi("")).toBeNull();
    expect(parseEuroInCentesimi("abc")).toBeNull();
  });
  it("i prezzi a tre decimali col punto restano decimali, le quantità no", () => {
    expect(parseNumeroIT("99.875")).toBe(99.875);
    expect(parseNumeroIT("98,45")).toBe(98.45);
    expect(parseQuantitaIT("10.000")).toBe(10000);
    expect(parseQuantitaIT("1,5")).toBe(1.5);
    expect(parseQuantitaIT("17")).toBe(17);
  });
  it("riscrive i valori per i campi senza perdere precisione", () => {
    expect(euroInInput(123450)).toBe("1234,50");
    expect(numeroInInput(98.7600000001)).toBe("98,76");
  });
});

describe("formatPrezzoMot", () => {
  it("due decimali, tre quando servono, mai di più", () => {
    expect(formatPrezzoMot(96)).toBe("96,00");
    expect(formatPrezzoMot(100.118)).toBe("100,118");
    // Prezzo ufficiale dell'OAT Sep29 il 19/10/2026: a tre decimali è 96,130, cioè 96,13.
    expect(formatPrezzoMot(96.12994)).toBe("96,13");
    expect(formatPrezzoMot(96.0333333)).toBe("96,033");
  });
});

describe("formatMeseIT", () => {
  it("scrive il mese per esteso", () => {
    expect(formatMeseIT("2026-09")).toBe("settembre 2026");
    expect(formatMeseIT("2027-01")).toBe("gennaio 2027");
    expect(formatMeseIT("2026-12")).toBe("dicembre 2026");
  });

  it("lascia com'è un mese che non riconosce", () => {
    expect(formatMeseIT("2026-13")).toBe("2026-13");
    expect(formatMeseIT("settembre")).toBe("settembre");
  });
});
