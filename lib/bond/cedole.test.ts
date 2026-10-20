import { describe, expect, it } from "vitest";
import {
  cedolaInVigore,
  cedoleLordeTra,
  dateCedoleTra,
  importoCedolaPeriodo,
  prossimaCedolaDopo,
  rateoMaturato,
  ultimaCedolaPrimaDi,
} from "./cedole";

// BTP semestrale con scadenza 01/03/2032: stacchi 01/03 e 01/09.
const piano = { dataScadenza: "2032-03-01", frequenzaCedola: 2 };

describe("piano cedolare", () => {
  it("ricostruisce le date di stacco all'indietro dalla scadenza", () => {
    expect(dateCedoleTra(piano, "2026-07-23", "2027-12-31")).toEqual([
      "2026-09-01",
      "2027-03-01",
      "2027-09-01",
    ]);
  });

  it("cedola precedente e successiva rispetto a una data", () => {
    expect(ultimaCedolaPrimaDi(piano, "2026-07-23")).toBe("2026-03-01");
    expect(prossimaCedolaDopo(piano, "2026-07-23")).toBe("2026-09-01");
    // Il giorno dello stacco: la cedola "precedente" è quella odierna
    expect(ultimaCedolaPrimaDi(piano, "2026-09-01")).toBe("2026-09-01");
  });

  it("importo della cedola di periodo", () => {
    // 10.000 nominali, 1,50% annuo, semestrale → 75,00 € lordi
    expect(importoCedolaPeriodo(10000, 1.5, 2)).toBe(7500);
  });
});

describe("rateoMaturato — ACT/ACT sul periodo", () => {
  it("144 giorni su 184 del semestre", () => {
    // 75,00 € × 144/184 = 58,6956… → 58,70 €
    expect(
      rateoMaturato({
        quantita: 10000,
        cedolaAnnua: 1.5,
        frequenzaCedola: 2,
        dataScadenza: "2032-03-01",
        riferimento: "2026-07-23",
      }),
    ).toBe(5870);
  });

  it("zero il giorno dello stacco e per gli zero coupon", () => {
    expect(
      rateoMaturato({
        quantita: 10000,
        cedolaAnnua: 1.5,
        frequenzaCedola: 2,
        dataScadenza: "2032-03-01",
        riferimento: "2026-09-01",
      }),
    ).toBe(0);
    expect(
      rateoMaturato({
        quantita: 10000,
        cedolaAnnua: 0,
        frequenzaCedola: 1,
        dataScadenza: "2027-07-23",
        riferimento: "2026-07-23",
      }),
    ).toBe(0);
  });

  it("zero alla scadenza e oltre, invece di un rateo infinito", () => {
    expect(
      rateoMaturato({
        quantita: 10000,
        cedolaAnnua: 1.5,
        frequenzaCedola: 2,
        dataScadenza: "2032-03-01",
        riferimento: "2032-03-15",
      }),
    ).toBe(0);
  });
});

describe("step-up", () => {
  const gradini = [
    { dal: "2025-10-28", cedolaAnnua: 2.6 },
    { dal: "2028-10-28", cedolaAnnua: 3.1 },
    { dal: "2030-10-28", cedolaAnnua: 4 },
  ];
  const valore = { quantita: 10_000, cedolaAnnua: 2.6, frequenzaCedola: 4, dataScadenza: "2032-10-28", gradini };

  it("il gradino in vigore all'inizio del periodo", () => {
    expect(cedolaInVigore(2.6, gradini, "2028-07-28")).toBe(2.6);
    expect(cedolaInVigore(2.6, gradini, "2028-10-28")).toBe(3.1);
    expect(cedolaInVigore(2.6, gradini, "2031-01-28")).toBe(4);
    // Senza gradini vale la cedola costante.
    expect(cedolaInVigore(2.6, undefined, "2031-01-28")).toBe(2.6);
  });

  it("ogni cedola al tasso del suo periodo", () => {
    expect(cedoleLordeTra(valore, "2028-07-28", "2029-01-28")).toEqual([
      // Il trimestre luglio-ottobre 2028 è ancora al 2,60%.
      { data: "2028-10-28", importo: 6500 },
      { data: "2029-01-28", importo: 7750 },
    ]);
  });

  it("il rateo matura al tasso del periodo in corso", () => {
    // 28/10/2028 → 28/11/2028: 31 giorni su 92 di un trimestre al 3,10%.
    expect(
      rateoMaturato({ ...valore, riferimento: "2028-11-28" }),
    ).toBe(Math.round((7750 * 31) / 92));
  });
});
