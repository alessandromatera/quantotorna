import { describe, expect, it } from "vitest";
import { controvaloreCents, vendiLifo, type LottoCarico } from "./lifo";

describe("controvaloreCents", () => {
  it("nominale × prezzo in base 100", () => {
    // 15.000 nominale a 101 → 15.150,00 €
    expect(controvaloreCents(15000, 101)).toBe(1_515_000);
  });
});

describe("vendiLifo — criterio LIFO", () => {
  const lotti: LottoCarico[] = [
    { id: 1, quantita: 10000, prezzoCarico: 94, commissioni: 700, dataAcquisto: "2023-02-13" },
    { id: 2, quantita: 10000, prezzoCarico: 97, commissioni: 700, dataAcquisto: "2024-05-20" },
  ];

  it("consuma prima il lotto più recente, poi pro-quota il precedente", () => {
    const esito = vendiLifo({
      lotti,
      quantita: 15000,
      prezzo: 101,
      commissioniVendita: 1500,
    });
    // Corrispettivo: 15.150,00 − 15,00 di commissioni = 15.135,00 €
    expect(esito.corrispettivo).toBe(1_513_500);
    // Lotto 2 (recente) intero: 9.700,00 + 7,00 = 9.707,00 €
    expect(esito.consumi[0].lotto.id).toBe(2);
    expect(esito.consumi[0].costoAttribuito).toBe(970_700);
    // Lotto 1 per 5.000: 4.700,00 + 3,50 (metà commissioni) = 4.703,50 €
    expect(esito.consumi[1].lotto.id).toBe(1);
    expect(esito.consumi[1].quantitaVenduta).toBe(5000);
    expect(esito.consumi[1].costoAttribuito).toBe(470_350);
    expect(esito.costoFiscale).toBe(1_441_050);
    // Plusvalenza: 15.135,00 − 14.410,50 = 724,50 €
    expect(esito.plusMinus).toBe(72_450);
    // Residuo: lotto 1 con 5.000 nominali e 3,50 € di commissioni ancora attribuibili
    expect(esito.lottiResidui).toHaveLength(1);
    expect(esito.lottiResidui[0]).toMatchObject({ id: 1, quantita: 5000, commissioni: 350 });
  });

  it("non muta i lotti in input", () => {
    vendiLifo({ lotti, quantita: 15000, prezzo: 101 });
    expect(lotti[1].quantita).toBe(10000);
    expect(lotti[1].commissioni).toBe(700);
  });

  it("vendita totale: nessun lotto residuo", () => {
    const esito = vendiLifo({ lotti, quantita: 20000, prezzo: 100 });
    expect(esito.lottiResidui).toHaveLength(0);
    // 20.000,00 − (9.400,00 + 7,00 + 9.700,00 + 7,00) = 886,00 €
    expect(esito.plusMinus).toBe(88_600);
  });

  it("vendita oltre il posseduto: errore esplicito", () => {
    expect(() => vendiLifo({ lotti, quantita: 25000, prezzo: 100 })).toThrow(
      /superiore al posseduto/,
    );
  });

  it("commissioni pro-quota arrotondate ai centesimi", () => {
    const esito = vendiLifo({
      lotti: [{ id: 1, quantita: 12000, prezzoCarico: 99.5, commissioni: 333, dataAcquisto: "2024-02-01" }],
      quantita: 5000,
      prezzo: 100.2,
      commissioniVendita: 250,
    });
    // Corrispettivo: 5.010,00 − 2,50 = 5.007,50 €
    expect(esito.corrispettivo).toBe(500_750);
    // Costo: 4.975,00 + round(3,33 × 5/12) = 4.975,00 + 1,39 = 4.976,39 €
    expect(esito.costoFiscale).toBe(497_639);
    expect(esito.plusMinus).toBe(3_111);
    // Il residuo conserva le commissioni non ancora attribuite: 3,33 − 1,39 = 1,94 €
    expect(esito.lottiResidui[0]).toMatchObject({ quantita: 7000, commissioni: 194 });
  });

  it("a parità di data di acquisto vende prima l'inserimento più recente", () => {
    const esito = vendiLifo({
      lotti: [
        { id: 1, quantita: 1000, prezzoCarico: 98, commissioni: 0, dataAcquisto: "2024-03-01" },
        { id: 2, quantita: 1000, prezzoCarico: 99, commissioni: 0, dataAcquisto: "2024-03-01" },
      ],
      quantita: 1000,
      prezzo: 100,
    });
    expect(esito.consumi[0].lotto.id).toBe(2);
  });
});
