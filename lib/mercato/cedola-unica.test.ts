import { describe, expect, it } from "vitest";
import {
  cedolaUnicaDaScheda,
  cedolaUnicaPerIlMotore,
  risolviCedoleUniche,
  type CedolaUnica,
} from "./cedola-unica";

/** Il testo della scheda di Borsa Italiana del BTP Valore Insieme, il 24/10/2026. */
const MINIMO =
  "L'importo minimo della cedola è pari al 22,25% del valore nominale del prestito e verrà pagata in un'unica soluzione a scadenza";
/**
 * Lo stesso testo senza «minimo», come si presume lo scriverà Borsa Italiana
 * a cedola definitiva: un testo diverso da questi due scarta il titolo col
 * motivo, mai una cedola indovinata.
 */
const DEFINITIVA =
  "L'importo della cedola è pari al 22,70% del valore nominale del prestito e verrà pagata in un'unica soluzione a scadenza";

const scheda = (descrizione: string | null, godimento: string | null = "2026-10-27") => ({
  godimento,
  periodicita: null,
  descrizione,
});

describe("cedolaUnicaDaScheda", () => {
  it("durante il collocamento la scheda dà il minimo: la cedola non è definitiva", () => {
    expect(cedolaUnicaDaScheda(scheda(MINIMO), "2031-10-27")).toEqual({
      percentuale: 22.25,
      definitiva: false,
      godimento: "2026-10-27",
    });
  });

  it("senza «minimo» è la cedola definitiva", () => {
    expect(cedolaUnicaDaScheda(scheda(DEFINITIVA), "2031-10-27")).toEqual({
      percentuale: 22.7,
      definitiva: true,
      godimento: "2026-10-27",
    });
  });

  it("ogni incoerenza è un motivo, mai una cedola indovinata", () => {
    const motivo = (s: ReturnType<typeof scheda>, scadenza = "2031-10-27") => {
      const esito = cedolaUnicaDaScheda(s, scadenza);
      return "motivo" in esito ? esito.motivo : null;
    };
    expect(motivo(scheda(null))).toMatch(/non descrive la cedola/);
    expect(motivo(scheda("Cedola trimestrale al 3,75% per i primi due anni"))).toMatch(/non riconosciuta/);
    expect(motivo(scheda(DEFINITIVA.replace("22,70%", "0%")))).toMatch(/non riconosciuta/);
    expect(motivo(scheda(DEFINITIVA, null))).toMatch(/godimento/);
    // Dal godimento alla scadenza non ci sono mesi interi: il periodo non torna.
    expect(motivo(scheda(DEFINITIVA, "2026-10-20"))).toMatch(/mesi interi/);
    expect(motivo(scheda(DEFINITIVA, "2031-10-27"))).toMatch(/godimento/);
  });
});

describe("cedolaUnicaPerIlMotore", () => {
  it("una cedola sola su cinque anni è il 22,70 / 5 annuo, 0,2 volte l'anno", () => {
    const c: CedolaUnica = { percentuale: 22.7, definitiva: true, godimento: "2026-10-27" };
    expect(cedolaUnicaPerIlMotore(c, "2031-10-27")).toEqual({ cedolaAnnua: 22.7 / 5, frequenzaCedola: 0.2 });
  });
});

describe("risolviCedoleUniche", () => {
  const righe = [{ isin: "IT0000000011", nome: "Btp Valore Insieme Inventato", dataScadenza: "2031-10-27" }];
  const definitiva: CedolaUnica = { percentuale: 22.7, definitiva: true, godimento: "2026-10-27" };
  const minima: CedolaUnica = { percentuale: 22.25, definitiva: false, godimento: "2026-10-27" };

  it("una cedola definitiva di ieri non si rilegge", async () => {
    const esito = await risolviCedoleUniche(righe, {
      precedenti: new Map([["IT0000000011", definitiva]]),
      leggiScheda: async () => {
        throw new Error("non doveva chiederla");
      },
    });
    expect(esito.cedole.get("IT0000000011")).toEqual(definitiva);
    expect(esito.scartate).toEqual([]);
  });

  it("finché è il minimo si rilegge ogni giorno, e la definitiva lo sostituisce", async () => {
    const esito = await risolviCedoleUniche(righe, {
      precedenti: new Map([["IT0000000011", minima]]),
      leggiScheda: async () => scheda(DEFINITIVA),
    });
    expect(esito.cedole.get("IT0000000011")).toEqual(definitiva);
  });

  it("se la scheda non si legge resta il minimo di ieri; senza niente il titolo è scartato", async () => {
    const nonRisponde = async () => {
      throw new Error("Borsa Italiana ha risposto 503");
    };
    const conIeri = await risolviCedoleUniche(righe, {
      precedenti: new Map([["IT0000000011", minima]]),
      leggiScheda: nonRisponde,
    });
    expect(conIeri.cedole.get("IT0000000011")).toEqual(minima);
    const senza = await risolviCedoleUniche(righe, { precedenti: new Map(), leggiScheda: nonRisponde });
    expect(senza.cedole.size).toBe(0);
    expect(senza.scartate[0].motivo).toMatch(/scheda di Borsa Italiana non letta.*503/);
  });

  it("un testo che non si riconosce scarta il titolo col motivo, anche se ieri c'era il minimo", async () => {
    const esito = await risolviCedoleUniche(righe, {
      precedenti: new Map([["IT0000000011", minima]]),
      leggiScheda: async () => scheda("La cedola sarà comunicata al termine del collocamento"),
    });
    expect(esito.cedole.size).toBe(0);
    expect(esito.scartate[0].motivo).toMatch(/non riconosciuta.*Btp Valore Insieme Inventato/);
  });
});
