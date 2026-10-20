import { describe, expect, it } from "vitest";
import { analisiDuration, sensibilitaTassi } from "./durata";
import type { ParametriBond } from "./ytm";

/**
 * Titolo di riferimento: BTP 3% semestrale, cinque anni esatti, alla pari.
 * Alla pari lo YTM lordo è la cedola, e la duration di Macaulay ha un valore
 * di controllo calcolabile a mano — è l'unico modo di verificare che il
 * riprezzamento non stia solo riproducendo se stesso.
 */
const allaPari: ParametriBond = {
  categoria: "btpFisso",
  quantita: 10_000,
  prezzo: 100,
  prezzoCarico: 100,
  cedolaAnnua: 3,
  frequenzaCedola: 2,
  dataScadenza: "2031-08-25",
  dataRiferimento: "2026-08-25",
};

describe("analisiDuration", () => {
  it("alla pari lo YTM lordo coincide con la cedola", () => {
    const d = analisiDuration(allaPari)!;
    // Composizione annua su cedole semestrali: poco sopra il 3% nominale.
    expect(d.ytmLordo * 100).toBeGreaterThan(2.9);
    expect(d.ytmLordo * 100).toBeLessThan(3.1);
  });

  it("la duration è più corta della scadenza e la modificata più corta ancora", () => {
    const d = analisiDuration(allaPari)!;
    expect(d.durationMacaulay).toBeGreaterThan(4);
    expect(d.durationMacaulay).toBeLessThan(5);
    expect(d.durationModificata).toBeLessThan(d.durationMacaulay);
    expect(d.durationModificata).toBeCloseTo(
      d.durationMacaulay / (1 + d.ytmLordo),
      10,
    );
  });

  it("uno zero coupon ha duration pari alla scadenza", () => {
    const d = analisiDuration({
      ...allaPari,
      cedolaAnnua: 0,
      frequenzaCedola: 1,
      prezzo: 86,
    })!;
    expect(d.durationMacaulay).toBeCloseTo(5, 2);
  });

  it("più lunga è la scadenza, più alta è la duration", () => {
    const corto = analisiDuration({ ...allaPari, dataScadenza: "2029-08-25" })!;
    const lungo = analisiDuration({ ...allaPari, dataScadenza: "2041-08-25" })!;
    expect(lungo.durationMacaulay).toBeGreaterThan(corto.durationMacaulay);
  });

  it("un titolo già scaduto non ha duration", () => {
    expect(analisiDuration({ ...allaPari, dataScadenza: "2025-01-01" })).toBeNull();
    expect(analisiDuration({ ...allaPari, dataScadenza: "2026-08-25" })).toBeNull();
  });
});

describe("sensibilitaTassi", () => {
  it("a shock nullo restituisce il prezzo di partenza", () => {
    const punti = sensibilitaTassi(allaPari)!;
    const fermo = punti.find((p) => p.shock === 0)!;
    expect(fermo.prezzo).toBeCloseTo(100, 1);
    expect(Math.abs(fermo.variazionePct)).toBeLessThan(0.1);
  });

  it("i tassi su fanno scendere il prezzo, e viceversa", () => {
    const punti = sensibilitaTassi(allaPari)!;
    const giu = punti.find((p) => p.shock === -1)!;
    const su = punti.find((p) => p.shock === 1)!;
    expect(su.prezzo).toBeLessThan(100);
    expect(giu.prezzo).toBeGreaterThan(100);
    expect(su.variazionePct).toBeLessThan(0);
    expect(giu.variazionePct).toBeGreaterThan(0);
  });

  it("il prezzo scende in modo monotono al crescere dello shock", () => {
    const punti = sensibilitaTassi(allaPari)!;
    for (let i = 1; i < punti.length; i++) {
      expect(punti[i].prezzo).toBeLessThan(punti[i - 1].prezzo);
    }
  });

  it("la variazione a +1% è vicina alla duration modificata", () => {
    const d = analisiDuration(allaPari)!;
    const su = sensibilitaTassi(allaPari, [1])![0];
    // Uno shock di UN punto percentuale muove il prezzo di circa
    // −durationModificata punti percentuali: `variazionePct` è già in punti,
    // quindi il termine di confronto è la duration stessa.
    // Il riprezzamento pieno è convesso: la perdita reale è un po' minore
    // dell'approssimazione lineare, mai maggiore.
    const lineare = -d.durationModificata;
    expect(su.variazionePct).toBeGreaterThan(lineare);
    expect(su.variazionePct).toBeLessThan(lineare * 0.9);
  });

  it("un titolo scaduto non ha sensibilità", () => {
    expect(sensibilitaTassi({ ...allaPari, dataScadenza: "2025-01-01" })).toBeNull();
  });

  it("rispetta gli shock richiesti", () => {
    expect(sensibilitaTassi(allaPari, [-0.25, 0.75])!.map((p) => p.shock)).toEqual([
      -0.25, 0.75,
    ]);
  });
});
