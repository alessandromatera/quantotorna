import { describe, expect, it } from "vitest";
import { risolviCedoleDaScheda, type LetturaCedola } from "./cedola-scheda";

const righe = [{ isin: "FR0000000011", nome: "Oatei Fx Inventato Eur", dataScadenza: "2043-07-25" }];
const letta = (valore: number | null, testo: string | null = valore == null ? null : String(valore)) =>
  async (): Promise<LetturaCedola> => ({ testo, valore });
const nonRisponde = async (): Promise<LetturaCedola> => {
  throw new Error("Borsa Italiana ha risposto 503");
};

describe("risolviCedoleDaScheda", () => {
  it("con la scheda letta la cedola annua è quella del campo", async () => {
    const esito = await risolviCedoleDaScheda(righe, { precedenti: new Map(), leggiCedola: letta(0.95) });
    expect(esito.cedole.get("FR0000000011")).toBe(0.95);
    expect(esito.scartate).toEqual([]);
  });

  it("con la scheda letta vince su quella di ieri", async () => {
    const esito = await risolviCedoleDaScheda(righe, {
      precedenti: new Map([["FR0000000011", 0.9]]),
      leggiCedola: letta(0.95),
    });
    expect(esito.cedole.get("FR0000000011")).toBe(0.95);
  });

  it("con la scheda non letta si tiene la cedola di ieri", async () => {
    const esito = await risolviCedoleDaScheda(righe, {
      precedenti: new Map([["FR0000000011", 0.95]]),
      leggiCedola: nonRisponde,
    });
    expect(esito.cedole.get("FR0000000011")).toBe(0.95);
    expect(esito.scartate).toEqual([]);
  });

  it("con la scheda non letta e senza ieri il titolo è scartato, col nome", async () => {
    const esito = await risolviCedoleDaScheda(righe, { precedenti: new Map(), leggiCedola: nonRisponde });
    expect(esito.cedole.size).toBe(0);
    expect(esito.scartate[0].isin).toBe("FR0000000011");
    expect(esito.scartate[0].motivo).toMatch(/scheda di Borsa Italiana non si è letta.*503.*Oatei Fx Inventato Eur/);
  });

  it("campo assente o vuoto: scartato col nome, anche se ieri c'era", async () => {
    const esito = await risolviCedoleDaScheda(righe, {
      precedenti: new Map([["FR0000000011", 0.95]]),
      leggiCedola: letta(null),
    });
    expect(esito.cedole.size).toBe(0);
    expect(esito.scartate[0].motivo).toMatch(/Tasso Cedola su base Annua.*Oatei Fx Inventato Eur/);
  });

  it("testo che non è un numero: scartato col testo e il nome", async () => {
    const esito = await risolviCedoleDaScheda(righe, {
      precedenti: new Map(),
      leggiCedola: letta(null, "n.d."),
    });
    expect(esito.scartate[0].motivo).toMatch(/«n\.d\.».*Oatei Fx Inventato Eur/);
  });

  it("fuori dai limiti (oltre il 20% o negativa): scartato col nome", async () => {
    for (const v of [20.5, -1]) {
      const esito = await risolviCedoleDaScheda(righe, { precedenti: new Map(), leggiCedola: letta(v) });
      expect(esito.cedole.size).toBe(0);
      expect(esito.scartate[0].motivo).toMatch(/fuori dai limiti.*Oatei Fx Inventato Eur/);
    }
  });
});
