import { describe, expect, it } from "vitest";
import { compensa, scadenzaMinusvalenza, type VoceZainetto } from "./zainetto";

const voce = (
  annoCompetenza: number,
  importoResiduo: number,
): VoceZainetto => ({
  annoCompetenza,
  importoResiduo,
  dataScadenza: scadenzaMinusvalenza(annoCompetenza),
});

describe("scadenza delle minusvalenze", () => {
  it("si estinguono il 31/12 del quarto anno successivo", () => {
    expect(scadenzaMinusvalenza(2023)).toBe("2027-12-31");
    expect(scadenzaMinusvalenza(2025)).toBe("2029-12-31");
  });
});

describe("compensa", () => {
  it("non compensa una vendita con perdite formate in un anno futuro", () => {
    const esito = compensa([voce(2026, 100000)], 50000, "2024-06-01");
    expect(esito.assorbito).toBe(0);
    expect(esito.vociAggiornate[0].importoResiduo).toBe(100000);
  });
  it("consuma dalla voce più vecchia, anche se le voci arrivano disordinate", () => {
    const voci = [voce(2025, 250000), voce(2023, 120000)];
    const esito = compensa(voci, 200000, "2026-07-23");
    expect(esito.assorbito).toBe(200000);
    expect(esito.nonCompensato).toBe(0);
    expect(esito.dettaglio).toEqual([
      { annoCompetenza: 2023, usato: 120000 },
      { annoCompetenza: 2025, usato: 80000 },
    ]);
    const residui = Object.fromEntries(
      esito.vociAggiornate.map((v) => [v.annoCompetenza, v.importoResiduo]),
    );
    expect(residui).toEqual({ 2023: 0, 2025: 170000 });
  });

  it("ignora le voci estinte alla data dell'operazione", () => {
    // Voce 2021: utilizzabile fino al 31/12/2025 incluso.
    const voci = [voce(2021, 100000)];
    const dopo = compensa(voci, 50000, "2026-01-15");
    expect(dopo.assorbito).toBe(0);
    expect(dopo.nonCompensato).toBe(50000);

    const ultimoGiorno = compensa(voci, 50000, "2025-12-31");
    expect(ultimoGiorno.assorbito).toBe(50000);
  });

  it("se lo zainetto non basta, il resto rimane da tassare", () => {
    const voci = [voce(2023, 120000), voce(2025, 250000)];
    const esito = compensa(voci, 5_000_000, "2026-07-23");
    expect(esito.assorbito).toBe(370000);
    expect(esito.nonCompensato).toBe(4_630_000);
    expect(esito.vociAggiornate.every((v) => v.importoResiduo === 0)).toBe(true);
  });

  it("importo non positivo: non consuma nulla", () => {
    const voci = [voce(2023, 120000)];
    expect(compensa(voci, 0, "2026-07-23").assorbito).toBe(0);
    expect(compensa(voci, -100, "2026-07-23").assorbito).toBe(0);
  });

  it("non muta le voci in input", () => {
    const voci = [voce(2023, 120000)];
    compensa(voci, 50000, "2026-07-23");
    expect(voci[0].importoResiduo).toBe(120000);
  });
});
