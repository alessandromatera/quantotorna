import { describe, expect, it } from "vitest";
import { GLOSSARIO } from "../glossario";
import { TIPI_CATALOGO } from "../categorie";
import { descriviTitolo } from "./descrizione";

describe("descriviTitolo", () => {
  it("copre ogni famiglia del catalogo, con un termine che esiste davvero", () => {
    for (const tipo of TIPI_CATALOGO) {
      const d = descriviTitolo({ tipo, prezzo: 99 });
      expect(d.famiglia).not.toBe("");
      expect(d.nota).not.toBe("");
      expect(GLOSSARIO[d.termine]).toBeDefined();
    }
  });

  it("sotto la pari: plusvalenza certa che può assorbire lo zainetto", () => {
    const d = descriviTitolo({ tipo: "fisso", prezzo: 91.2 });
    expect(d.nota).toMatch(/plusvalenza è certa/);
    expect(d.toccaZainetto).toBe(true);
  });

  /**
   * Il caso che la colonna «Plus a rimborso» non racconta: mostra «—» e
   * lascia credere che non succeda nulla a scadenza.
   */
  it("sopra la pari: minusvalenza certa che alimenta lo zainetto", () => {
    const d = descriviTitolo({ tipo: "fisso", prezzo: 105.91 });
    expect(d.nota).toMatch(/minusvalenza certa/);
    expect(d.nota).toMatch(/alimenta lo zainetto/);
  });

  it("dentro la banda il differenziale non si dichiara", () => {
    expect(descriviTitolo({ tipo: "fisso", prezzo: 100 }).nota).toMatch(
      /non c'è differenziale/,
    );
    expect(descriviTitolo({ tipo: "fisso", prezzo: 100.2 }).nota).toMatch(
      /non c'è differenziale/,
    );
    expect(descriviTitolo({ tipo: "fisso", prezzo: 99.7 }).nota).toMatch(
      /plusvalenza è certa/,
    );
  });

  /**
   * Fuori dallo zainetto stanno tutti e soli gli zero coupon: strip e BOT.
   * Il loro differenziale è scarto di emissione, reddito di capitale.
   */
  it("solo gli zero coupon hanno un differenziale fuori dallo zainetto", () => {
    const fuori = TIPI_CATALOGO.filter(
      (tipo) => !descriviTitolo({ tipo, prezzo: 95 }).toccaZainetto,
    );
    expect(fuori).toEqual(["zeroCoupon", "bot"]);
    for (const tipo of fuori) {
      expect(descriviTitolo({ tipo, prezzo: 95 }).nota).toMatch(
        /scarto di emissione/,
      );
    }
  });

  /**
   * Con prezzo e data d'asta lo scarto si tassa in anticipo, e la parte fra
   * prezzo teorico e prezzo pagato è plusvalenza: la nota non può dire
   * «fuori dallo zainetto» mentre il motore la compensa.
   */
  it("BOT e zero coupon con i dati d'asta toccano lo zainetto, e la nota lo dice", () => {
    for (const tipo of ["bot", "zeroCoupon"] as const) {
      const d = descriviTitolo({ tipo, prezzo: 98, plusCompensabile: true });
      expect(d.toccaZainetto).toBe(true);
      expect(d.nota).toMatch(/tocca lo zainetto/);
      expect(d.nota).not.toMatch(/fuori dallo zainetto/);
    }
    expect(descriviTitolo({ tipo: "bot", prezzo: 98, plusCompensabile: false }).nota).toMatch(
      /Senza i dati d'asta/,
    );
  });

  it("«Strip» solo per gli italiani: gli zero coupon esteri si chiamano col loro nome", () => {
    expect(descriviTitolo({ tipo: "zeroCoupon", prezzo: 90, emittente: "IT" }).famiglia).toBe("Strip");
    const bei = descriviTitolo({ tipo: "zeroCoupon", prezzo: 90, emittente: "sovra" });
    expect(bei.famiglia).toBe("Zero coupon");
    expect(bei.nota).toMatch(/Senza prezzo e data di emissione/);
    expect(GLOSSARIO[bei.termine]).toBeDefined();
    expect(descriviTitolo({ tipo: "zeroCoupon", prezzo: 100 }).famiglia).toBe("Strip e zero coupon");
  });

  it("«BTP€i» solo per gli italiani, e gli OATi seguono l'inflazione francese", () => {
    expect(descriviTitolo({ tipo: "indicizzatoEuro", prezzo: 99, emittente: "IT" }).famiglia).toBe("BTP€i");
    const bund = descriviTitolo({ tipo: "indicizzatoEuro", prezzo: 99, emittente: "DE", nome: "Bundei 0,5% Ap30 Eur" });
    expect(bund.famiglia).toBe("Indicizzato");
    expect(bund.nota).toMatch(/area euro/);
    expect(GLOSSARIO[bund.termine]).toBeDefined();
    const oati = descriviTitolo({ tipo: "indicizzatoEuro", prezzo: 99, emittente: "FR", nome: "Oati Lug29 Eur 3,4" });
    expect(oati.nota).toMatch(/inflazione francese/);
    const oatei = descriviTitolo({ tipo: "indicizzatoEuro", prezzo: 99, emittente: "FR", nome: "Oatei Lug32 Eur 3,15" });
    expect(oatei.nota).toMatch(/area euro/);
  });

  it("il CCTeu dichiara l'ipotesi sull'Euribor", () => {
    const d = descriviTitolo({ tipo: "ccteu", prezzo: 101.28 });
    expect(d.famiglia).toBe("CCTeu");
    expect(d.nota).toMatch(/Euribor/);
    expect(d.toccaZainetto).toBe(true);
  });
});
