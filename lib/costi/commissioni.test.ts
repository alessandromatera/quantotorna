import { describe, expect, it } from "vitest";
import { TARIFFA_NULLA, commissione, leggiTariffa, type TariffaMercato } from "./commissioni";

/** Tariffa d'esempio, inventata: 0,15% con minimo 2,50 € e massimo 15 €. */
const proporzionale: TariffaMercato = { percentuale: 0.15, minimo: 250, massimo: 1500, fisso: 0 };

describe("commissione", () => {
  it("proporzionale fra minimo e massimo", () => {
    // 5.000,00 € × 0,15% = 7,50 €
    expect(commissione({ tariffa: proporzionale, controvalore: 500_000 })).toBe(750);
  });

  it("sotto la soglia si paga il minimo, sopra il massimo", () => {
    // 1.000,00 € × 0,15% = 1,50 € → minimo 2,50 €
    expect(commissione({ tariffa: proporzionale, controvalore: 100_000 })).toBe(250);
    // 20.000,00 € × 0,15% = 30,00 € → massimo 15,00 €
    expect(commissione({ tariffa: proporzionale, controvalore: 2_000_000 })).toBe(1500);
  });

  it("massimo zero = nessun tetto", () => {
    const senzaTetto = { ...proporzionale, massimo: 0 };
    expect(commissione({ tariffa: senzaTetto, controvalore: 2_000_000 })).toBe(3000);
  });

  it("tariffa fissa per eseguito", () => {
    const fissa = { percentuale: 0, minimo: 0, massimo: 0, fisso: 500 };
    expect(commissione({ tariffa: fissa, controvalore: 100_000 })).toBe(500);
    expect(commissione({ tariffa: fissa, controvalore: 5_000_000 })).toBe(500);
  });

  it("con la tariffa nulla non si paga niente", () => {
    expect(commissione({ tariffa: TARIFFA_NULLA, controvalore: 1_000_000 })).toBe(0);
  });

  it("il segno del controvalore non conta", () => {
    expect(commissione({ tariffa: proporzionale, controvalore: -500_000 })).toBe(750);
  });
});

describe("leggiTariffa", () => {
  it("rilegge una tariffa salvata", () => {
    expect(leggiTariffa(JSON.stringify(proporzionale))).toEqual(proporzionale);
  });

  it("i campi mancanti o non validi tornano al valore di partenza", () => {
    expect(leggiTariffa(JSON.stringify({ percentuale: 0.2, minimo: -5, fisso: "x" }))).toEqual({
      percentuale: 0.2,
      minimo: 0,
      massimo: 0,
      fisso: 0,
    });
  });

  it("un JSON vuoto, corrotto o non oggetto non rompe la pagina", () => {
    expect(leggiTariffa(null)).toEqual(TARIFFA_NULLA);
    expect(leggiTariffa("{non è json")).toEqual(TARIFFA_NULLA);
    expect(leggiTariffa("null")).toEqual(TARIFFA_NULLA);
    expect(leggiTariffa("42")).toEqual(TARIFFA_NULLA);
  });
});
