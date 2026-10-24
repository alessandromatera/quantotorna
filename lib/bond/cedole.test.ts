import { describe, expect, it } from "vitest";
import { giorniTra } from "../date";
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

describe("CCTeu: cedola e rateo ACT/360", () => {
  // CCTeu inventato: scadenza 15/04/2032, Euribor 2,10% + spread 1,00%.
  const cct = {
    quantita: 10_000,
    cedolaAnnua: 3.1,
    frequenzaCedola: 2,
    dataScadenza: "2032-04-15",
    convenzione: "act360" as const,
  };

  it("il rateo conta i giorni dall'ultima cedola su 360", () => {
    // 10.000 × 3,10% × 12/360 = 10,333… → 10,33 €; ACT/ACT dava
    // 155 € × 12/182 = 10,22 €.
    expect(rateoMaturato({ ...cct, riferimento: "2026-10-27" })).toBe(1033);
    expect(rateoMaturato({ ...cct, convenzione: "actAct", riferimento: "2026-10-27" })).toBe(1022);
  });

  it("ogni cedola conta i giorni veri del suo semestre", () => {
    const cedole = cedoleLordeTra(cct, "2026-10-27", "2032-04-15");
    // 182 giorni: 10.000 × 3,10% × 182/360 = 156,72 €; 183 giorni: 157,58 €.
    expect(cedole.slice(0, 2)).toEqual([
      { data: "2027-04-15", importo: 15_672 },
      { data: "2027-10-15", importo: 15_758 },
    ]);
    expect(new Set(cedole.map((c) => c.importo)).size).toBeGreaterThan(1);
    let inizio = "2026-10-15";
    for (const c of cedole) {
      const giorni = giorniTra(inizio, c.data);
      expect(giorni).toBeGreaterThanOrEqual(181);
      expect(giorni).toBeLessThanOrEqual(184);
      expect(c.importo).toBe(Math.round((10_000 * 3.1 * giorni) / 360));
      inizio = c.data;
    }
  });

  it("senza convenzione resta ACT/ACT: cedole tutte uguali", () => {
    const { convenzione: _, ...actAct } = cct;
    const cedole = cedoleLordeTra(actAct, "2026-10-27", "2032-04-15");
    expect(new Set(cedole.map((c) => c.importo))).toEqual(new Set([15_500]));
  });
});

describe("prima cedola corta: il piano parte dal godimento", () => {
  // BTP inventato 3,50% semestrale, godimento 01/10/2026, scadenza
  // 01/08/2036: stacchi 01/02 e 01/08, e la prima cedola matura dal
  // 01/10/2026 al 01/02/2027, 123 giorni del semestre teorico di 184.
  const btp = {
    quantita: 10_000,
    cedolaAnnua: 3.5,
    frequenzaCedola: 2,
    dataScadenza: "2036-08-01",
    godimento: "2026-10-01",
  };
  const { godimento: _, ...senzaGodimento } = btp;

  it("la prima cedola paga solo i giorni dal godimento, ACT/ACT sul semestre teorico", () => {
    // 175 € × 123/184 = 116,98 €, poi la cedola piena.
    expect(cedoleLordeTra(btp, "2026-10-27", "2027-08-01")).toEqual([
      { data: "2027-02-01", importo: 11_698 },
      { data: "2027-08-01", importo: 17_500 },
    ]);
  });

  it("il rateo matura dal godimento", () => {
    // 175 € × 26/184 = 24,73 €, non 175 € × 87/184 = 82,74 € dal 01/08/2026.
    expect(rateoMaturato({ ...btp, riferimento: "2026-10-27" })).toBe(2473);
    expect(rateoMaturato({ ...senzaGodimento, riferimento: "2026-10-27" })).toBe(8274);
  });

  it("nessuna cedola prima del godimento, e nessun rateo fino a lì", () => {
    expect(dateCedoleTra(btp, "2025-01-01", "2027-03-01")).toEqual(["2027-02-01"]);
    expect(rateoMaturato({ ...btp, riferimento: "2026-10-01" })).toBe(0);
    expect(rateoMaturato({ ...btp, riferimento: "2026-09-15" })).toBe(0);
  });

  it("dopo la prima cedola il calendario è quello di sempre", () => {
    expect(rateoMaturato({ ...btp, riferimento: "2027-03-01" })).toBe(
      rateoMaturato({ ...senzaGodimento, riferimento: "2027-03-01" }),
    );
    expect(cedoleLordeTra(btp, "2027-02-01", "2036-08-01")).toEqual(
      cedoleLordeTra(senzaGodimento, "2027-02-01", "2036-08-01"),
    );
  });

  it("un godimento sul calendario non cambia niente", () => {
    const regolare = { ...btp, godimento: "2026-08-01" };
    expect(cedoleLordeTra(regolare, "2026-10-27", "2036-08-01")).toEqual(
      cedoleLordeTra(senzaGodimento, "2026-10-27", "2036-08-01"),
    );
    expect(rateoMaturato({ ...regolare, riferimento: "2026-10-27" })).toBe(8274);
  });

  it("un godimento fuori dal calendario si ignora", () => {
    // Dalla scadenza in poi non matura niente: è un dato sbagliato.
    for (const godimento of ["2036-08-01", "2037-01-01"]) {
      expect(rateoMaturato({ ...btp, godimento, riferimento: "2026-10-27" })).toBe(8274);
      expect(cedoleLordeTra({ ...btp, godimento }, "2026-10-27", "2027-02-01")).toEqual([
        { data: "2027-02-01", importo: 17_500 },
      ]);
    }
  });

  it("su un CCTeu la cedola corta conta su 360 i giorni dal godimento", () => {
    // Godimento 01/12/2026, primo stacco 15/04/2027: 135 giorni,
    // 10.000 × 3,10% × 135/360 = 116,25 €.
    const cct = {
      quantita: 10_000,
      cedolaAnnua: 3.1,
      frequenzaCedola: 2,
      dataScadenza: "2032-04-15",
      convenzione: "act360" as const,
      godimento: "2026-12-01",
    };
    expect(cedoleLordeTra(cct, "2026-12-03", "2027-04-15")).toEqual([
      { data: "2027-04-15", importo: 11_625 },
    ]);
    // 2 giorni: 10.000 × 3,10% × 2/360 = 1,72 €.
    expect(rateoMaturato({ ...cct, riferimento: "2026-12-03" })).toBe(172);
  });

  it("sugli step-up il primo gradino parte dal godimento: niente cambia", () => {
    const gradini = [
      { dal: "2025-10-28", cedolaAnnua: 2.6 },
      { dal: "2028-10-28", cedolaAnnua: 3.1 },
    ];
    const valore = { quantita: 10_000, cedolaAnnua: 2.6, frequenzaCedola: 4, dataScadenza: "2032-10-28", gradini };
    const conGodimento = { ...valore, godimento: "2025-10-28" };
    expect(cedoleLordeTra(conGodimento, "2025-11-03", "2032-10-28")).toEqual(
      cedoleLordeTra(valore, "2025-11-03", "2032-10-28"),
    );
    expect(rateoMaturato({ ...conGodimento, riferimento: "2025-11-03" })).toBe(
      rateoMaturato({ ...valore, riferimento: "2025-11-03" }),
    );
  });
});

describe("cedola unica a scadenza, 30E/360 (BTP Valore Insieme)", () => {
  // BTP inventato con una sola cedola del 22,70% del nominale, pagata a
  // scadenza dopo cinque anni: godimento 27/10/2026, scadenza 27/10/2031.
  // Per il motore è una cedola annua del 4,54% (22,70 / 5) con un periodo di
  // 60 mesi, cioè 0,2 cedole l'anno.
  const insieme = {
    quantita: 10_000,
    cedolaAnnua: 4.54,
    frequenzaCedola: 0.2,
    dataScadenza: "2031-10-27",
    godimento: "2026-10-27",
    convenzione: "30E360" as const,
  };

  it("una sola cedola, a scadenza: 22,70% di 10.000 = 2.270 €", () => {
    expect(cedoleLordeTra(insieme, "2026-10-27", "2031-10-27")).toEqual([
      { data: "2031-10-27", importo: 227_000 },
    ]);
    expect(prossimaCedolaDopo(insieme, "2026-10-27")).toBe("2031-10-27");
  });

  it("il rateo conta i giorni 30E/360 sui 1.800 del periodo", () => {
    // 27/10 → 30/11/2026: 33 giorni 30E/360, 34 veri. 2.270 € × 33/1.800 =
    // 41,62 €; ACT/ACT darebbe 2.270 € × 34/1.826 = 42,27 €.
    expect(rateoMaturato({ ...insieme, riferimento: "2026-11-30" })).toBe(4162);
    expect(rateoMaturato({ ...insieme, convenzione: "actAct", riferimento: "2026-11-30" })).toBe(4227);
    // Dopo tre anni: 2.270 € × 1.080/1.800 = 1.362 €.
    expect(rateoMaturato({ ...insieme, riferimento: "2029-10-27" })).toBe(136_200);
    expect(rateoMaturato({ ...insieme, riferimento: "2026-10-27" })).toBe(0);
  });
});
