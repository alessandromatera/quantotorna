import { describe, expect, it, vi } from "vitest";
import {
  PIANI_NOTI,
  cedolaAnnuaInCorso,
  pianoDaDescrizione,
  risolviPianiStepUp,
  verificaCedolaInCorso,
  type SchedaStepUp,
} from "./stepup";

/**
 * Testi veri della «Descrizione Payout» di Borsa Italiana, letti il
 * 20/10/2026. Il parser vive di come sono scritti: inventarli renderebbe il
 * test inutile. Si notino «pari a» e «pari al», «3.35%» col punto e «4%»
 * senza decimali, e il premio fedeltà, che è un «pari al» da NON leggere.
 */
const VALORE_OT32 =
  'I Titoli hanno scadenza 7 anni e garantiscono tassi annui pagati trimestralmente secondo una progressione crescente (3-2-2). Per i primi 3 anni verrà corrisposto un tasso pari al 2,60%, per i successivi 2 anni un tasso pari a 3,10% e per gli ultimi 2 anni un tasso pari al 4%.Gli investitori che conserveranno i Titoli dalla fase di distribuzione fino alla scadenza avranno diritto al "Premio Fedeltà" pari al 0,8% lordo sul capitale nominale investito.';
const VALORE_MG30 =
  'I Titoli hanno scadenza 6 anni e garantiscono tassi annui pagati trimestralmente secondo una progressione crescente (3-3). Per i primi 3 anni vi sarà un tasso pari al 3.35% e per i successivi 3 anni un tasso pari al 3,90%. Gli investitori che vogliano conservare i Titoli dalla fase di distribuzione fino alla scadenza avranno inoltre diritto al "Premio Fedeltà" pari al 0,8% lordo sul capitale nominale investito.';
const PIU_FB33 =
  "I Titoli hanno scadenza 8 anni e garantiscono tassi annui pagati trimestralmente secondo una progressione crescente (4-4). Per i primi 4 anni verrà corrisposto un tasso pari al 2,85% e per i successivi 4 anni un tasso pari a 3,70%. Inoltre, al termine del quarto anno è prevista la facoltà di esercizio dell''opzione di rimborso anticipato per gli investitori che hanno comprato il titolo durante il periodo di collocamento e hanno detenuto lo stesso continuativamente fino alla data di esercizio dell''opzione";
/** In collocamento dal 19 al 23/10/2026: i tassi sono i minimi. */
const VALORE_OT31_MINIMI =
  "I Titoli hanno scadenza 5 anni e garantiscono tassi annui minimi pagati trimestralmente secondo una progressione crescente (2-2-1). Per i primi 2 anni verrà corrisposto un tasso pari al 3,7%, per i successivi 2 anni un tasso pari a 4,1% e per l-ultimo anno un tasso pari al 4,7%.";

describe("pianoDaDescrizione", () => {
  it("legge tre gradini con le loro date di partenza", () => {
    expect(pianoDaDescrizione(VALORE_OT32, "Trimestrale", "2025-10-28", "2032-10-28")).toEqual({
      frequenza: 4,
      gradini: [
        { dal: "2025-10-28", cedolaAnnua: 2.6 },
        { dal: "2028-10-28", cedolaAnnua: 3.1 },
        { dal: "2030-10-28", cedolaAnnua: 4 },
      ],
    });
  });

  it("accetta il punto decimale e ignora il premio fedeltà", () => {
    expect(pianoDaDescrizione(VALORE_MG30, "Trimestrale", "2024-05-14", "2030-05-14")).toEqual({
      frequenza: 4,
      gradini: [
        { dal: "2024-05-14", cedolaAnnua: 3.35 },
        { dal: "2027-05-14", cedolaAnnua: 3.9 },
      ],
    });
  });

  it("BTP Più: due gradini, il rimborso anticipato non entra", () => {
    const piano = pianoDaDescrizione(PIU_FB33, "Trimestrale", "2025-02-25", "2033-02-25");
    expect(piano).toEqual({
      frequenza: 4,
      gradini: [
        { dal: "2025-02-25", cedolaAnnua: 2.85 },
        { dal: "2029-02-25", cedolaAnnua: 3.7 },
      ],
    });
  });

  it("i tassi minimi del collocamento non sono un piano", () => {
    const esito = pianoDaDescrizione(VALORE_OT31_MINIMI, "Trimestrale", "2026-10-27", "2031-10-27");
    expect(esito).toEqual({ motivo: expect.stringMatching(/tassi minimi/) });
  });

  it("la cedola unica del BTP Valore Insieme non è un piano a gradini", () => {
    const esito = pianoDaDescrizione(
      "L'importo minimo della cedola è pari al 22,25% del valore nominale del prestito e verrà pagata in un'unica soluzione a scadenza",
      null,
      "2026-10-27",
      "2031-10-27",
    );
    expect("motivo" in esito).toBe(true);
  });

  it("ogni incoerenza è un motivo, mai un piano indovinato", () => {
    const motivo = (testo: string, periodicita = "Trimestrale", scadenza = "2032-10-28") => {
      const esito = pianoDaDescrizione(testo, periodicita, "2025-10-28", scadenza);
      return "motivo" in esito ? esito.motivo : null;
    };
    // Tre gradini annunciati, due tassi trovati.
    expect(motivo(VALORE_OT32.replace("un tasso pari a 3,10%", "un 3,10%"))).toMatch(/non riconosciuto/);
    // Un tasso che scende non è uno step-up.
    expect(motivo(VALORE_OT32.replace("pari al 4%", "pari al 3%"))).toMatch(/non crescenti/);
    // Le durate non arrivano alla scadenza del listino.
    expect(motivo(VALORE_OT32, "Trimestrale", "2033-10-28")).toMatch(/non arrivano alla scadenza/);
    expect(motivo(VALORE_OT32, "Mensile")).toMatch(/periodicità/);
  });
});

describe("verificaCedolaInCorso", () => {
  const piano = {
    frequenza: 4,
    gradini: [
      { dal: "2025-10-28", cedolaAnnua: 2.6 },
      { dal: "2028-10-28", cedolaAnnua: 3.1 },
      { dal: "2030-10-28", cedolaAnnua: 4 },
    ],
  };

  it("il piano torna con la cedola di periodo del listino", () => {
    // 2,60% trimestrale = 0,65 a periodo, com'era sul listino il 20/10/2026.
    expect(verificaCedolaInCorso(piano, 0.65, "2032-10-28", "2026-10-20")).toBeNull();
  });

  it("intorno a un cambio di gradino accetta anche il periodo accanto", () => {
    // Il 2/11/2028 il periodo in corso è già al 3,10% (0,775), ma il
    // listino può riportare ancora la cedola appena staccata.
    expect(verificaCedolaInCorso(piano, 0.65, "2032-10-28", "2028-11-02")).toBeNull();
    expect(verificaCedolaInCorso(piano, 0.775, "2032-10-28", "2028-11-02")).toBeNull();
  });

  it("una cedola che il piano non prevede scarta il titolo", () => {
    // Letta come semestrale: il doppio. È l'errore che il controllo esiste per fermare.
    expect(verificaCedolaInCorso(piano, 1.3, "2032-10-28", "2026-10-20")).toMatch(/piano da ricontrollare/);
    expect(verificaCedolaInCorso(piano, null, "2032-10-28", "2026-10-20")).toMatch(/non pubblica/);
  });

  it("la cedola in corso da mostrare", () => {
    expect(cedolaAnnuaInCorso(piano, "2032-10-28", "2026-10-20")).toBe(2.6);
    expect(cedolaAnnuaInCorso(piano, "2032-10-28", "2031-01-15")).toBe(4);
  });
});

describe("PIANI_NOTI", () => {
  /** Cedola di periodo sul listino MOT il 20/10/2026, scadenza. */
  const listino: Record<string, [number, string]> = {
    IT0005547408: [2, "2027-06-13"],
    IT0005415291: [0.65, "2030-07-14"],
    IT0005425761: [0.3, "2028-11-17"],
    IT0005442097: [0.6, "2037-04-27"],
    IT0005466351: [0.675, "2033-11-16"],
  };

  it("ogni piano della tabella torna con il listino del giorno in cui è stato scritto", () => {
    expect(Object.keys(PIANI_NOTI).sort()).toEqual(Object.keys(listino).sort());
    for (const [isin, [cedola, scadenza]] of Object.entries(listino)) {
      expect(verificaCedolaInCorso(PIANI_NOTI[isin], cedola, scadenza, "2026-10-20"), isin).toBeNull();
    }
  });

  it("gradini in ordine di data e tassi crescenti", () => {
    for (const piano of Object.values(PIANI_NOTI)) {
      for (let i = 1; i < piano.gradini.length; i++) {
        expect(piano.gradini[i].dal > piano.gradini[i - 1].dal).toBe(true);
        expect(piano.gradini[i].cedolaAnnua).toBeGreaterThan(piano.gradini[i - 1].cedolaAnnua);
      }
    }
  });
});

describe("risolviPianiStepUp", () => {
  const oggi = "2026-10-20";
  const scheda = (descrizione: string | null, godimento = "2025-10-28"): SchedaStepUp => ({
    godimento,
    periodicita: "Trimestrale",
    descrizione,
  });

  it("i titoli della tabella non chiedono la scheda", async () => {
    const leggiScheda = vi.fn();
    const esito = await risolviPianiStepUp(
      [{ isin: "IT0005442097", nome: "Btp Futura Ap37 Eur", dataScadenza: "2037-04-27", cedolaListino: 0.6 }],
      { oggi, precedenti: new Map(), leggiScheda },
    );
    expect(leggiScheda).not.toHaveBeenCalled();
    expect(esito.piani.get("IT0005442097")!.gradini).toHaveLength(4);
    expect(esito.scartate).toEqual([]);
  });

  it("un piano già letto non richiede di nuovo la scheda", async () => {
    const leggiScheda = vi.fn();
    const piano = pianoDaDescrizione(VALORE_OT32, "Trimestrale", "2025-10-28", "2032-10-28");
    const esito = await risolviPianiStepUp(
      [{ isin: "IT0005672024", nome: "Btp Valore Sc Ot32 Eur", dataScadenza: "2032-10-28", cedolaListino: 0.65 }],
      { oggi, precedenti: new Map([["IT0005672024", piano as never]]), leggiScheda },
    );
    expect(leggiScheda).not.toHaveBeenCalled();
    expect(esito.piani.has("IT0005672024")).toBe(true);
  });

  it("un titolo nuovo prende il piano dalla scheda", async () => {
    const esito = await risolviPianiStepUp(
      [{ isin: "IT0005672024", nome: "Btp Valore Sc Ot32 Eur", dataScadenza: "2032-10-28", cedolaListino: 0.65 }],
      { oggi, precedenti: new Map(), leggiScheda: async () => scheda(VALORE_OT32) },
    );
    expect(esito.piani.get("IT0005672024")!.gradini.map((g) => g.cedolaAnnua)).toEqual([2.6, 3.1, 4]);
  });

  it("chi resta senza piano è scartato col motivo, e gli altri passano", async () => {
    const esito = await risolviPianiStepUp(
      [
        { isin: "IT0005735201", nome: "Btp Valore Sc Oct31 Eur", dataScadenza: "2031-10-27", cedolaListino: null },
        { isin: "IT0000000001", nome: "Btp Valore Nuovo", dataScadenza: "2032-10-28", cedolaListino: 0.65 },
        { isin: "IT0000000002", nome: "Btp Futura Ignoto", dataScadenza: "2032-10-28", cedolaListino: 0.65 },
        { isin: "IT0005672024", nome: "Btp Valore Sc Ot32 Eur", dataScadenza: "2032-10-28", cedolaListino: 0.65 },
      ],
      {
        oggi,
        precedenti: new Map(),
        leggiScheda: async (isin) => {
          if (isin === "IT0005735201") return scheda(VALORE_OT31_MINIMI, "2026-10-27");
          if (isin === "IT0000000001") throw new Error("Borsa Italiana ha risposto 429");
          if (isin === "IT0000000002") return scheda(null);
          return scheda(VALORE_OT32);
        },
      },
    );
    expect([...esito.piani.keys()]).toEqual(["IT0005672024"]);
    const motivo = (isin: string) => esito.scartate.find((s) => s.isin === isin)?.motivo;
    expect(motivo("IT0005735201")).toMatch(/tassi minimi/);
    expect(motivo("IT0000000001")).toMatch(/non letta.*429/);
    expect(motivo("IT0000000002")).toMatch(/non lo descrive/);
  });

  it("un piano già letto che non torna più si rilegge dalla scheda", async () => {
    const vecchio = { frequenza: 4, gradini: [{ dal: "2025-10-28", cedolaAnnua: 9 }] };
    const leggiScheda = vi.fn(async () => scheda(VALORE_OT32));
    const esito = await risolviPianiStepUp(
      [{ isin: "IT0005672024", nome: "Btp Valore Sc Ot32 Eur", dataScadenza: "2032-10-28", cedolaListino: 0.65 }],
      { oggi, precedenti: new Map([["IT0005672024", vecchio]]), leggiScheda },
    );
    expect(leggiScheda).toHaveBeenCalledOnce();
    expect(esito.piani.get("IT0005672024")!.gradini[0].cedolaAnnua).toBe(2.6);
  });
});
