import { describe, expect, it } from "vitest";
import { indicePagina, pagineDiRighe, paginePerAnno, sceltaDi } from "./pagine";

/** Un anno con `n` titoli finti: contano solo quanti sono. */
function anno(a: number, n: number) {
  return { anno: a, titoli: Array.from({ length: n }, (_, i) => `${a}-${i}`) };
}

describe("paginePerAnno", () => {
  it("un anno grande per pagina, gli anni piccoli consecutivi insieme", () => {
    const pagine = paginePerAnno([
      anno(2026, 12),
      anno(2027, 64),
      anno(2043, 5),
      anno(2044, 6),
      anno(2045, 7),
      anno(2046, 7),
    ]);
    expect(pagine.map((p) => [p.etichetta, p.righe])).toEqual([
      ["2026", 12],
      ["2027", 64],
      ["2043–2044", 11],
      ["2045–2046", 14],
    ]);
    expect(pagine[2].anni).toEqual([2043, 2044]);
  });

  it("una coda corta in fondo si unisce alla pagina di anni piccoli prima di lei", () => {
    // Come con la ricerca «Bund»: senza, l'ultima pagina avrebbe un titolo solo.
    const pagine = paginePerAnno([anno(2037, 4), anno(2045, 6), anno(2054, 1)]);
    expect(pagine.map((p) => [p.etichetta, p.righe])).toEqual([["2037–2054", 11]]);
  });

  it("un anno grande non si accorpa: i piccoli prima e dopo di lui restano pagine corte", () => {
    const pagine = paginePerAnno([anno(2026, 3), anno(2027, 40), anno(2028, 2)]);
    expect(pagine.map((p) => p.etichetta)).toEqual(["2026", "2027", "2028"]);
  });

  it("dalla scadenza più lontana: l'etichetta va comunque dal primo anno all'ultimo", () => {
    const pagine = paginePerAnno([anno(2120, 1), anno(2117, 1), anno(2086, 1), anno(2072, 9)]);
    expect(pagine.map((p) => p.etichetta)).toEqual(["2072–2120"]);
    expect(pagine[0].gruppi.map((g) => g.anno)).toEqual([2120, 2117, 2086, 2072]);
  });

  it("niente gruppi, niente pagine", () => {
    expect(paginePerAnno([])).toEqual([]);
  });
});

describe("pagineDiRighe", () => {
  it("pezzi della stessa lunghezza, l'ultimo con quel che resta", () => {
    const righe = Array.from({ length: 120 }, (_, i) => i);
    const pagine = pagineDiRighe(righe, 50);
    expect(pagine.map((p) => [p.etichetta, p.righe])).toEqual([
      ["1–50", 50],
      ["51–100", 50],
      ["101–120", 20],
    ]);
    expect(pagine[2].gruppi).toEqual([{ anno: null, titoli: righe.slice(100) }]);
  });
});

describe("indicePagina", () => {
  it("con gli anni resta sulla pagina dell'anno scelto, anche se le pagine cambiano", () => {
    const prima = paginePerAnno([anno(2026, 12), anno(2043, 5), anno(2044, 6)]);
    const scelta = sceltaDi(prima, 1, null);
    expect(scelta).toEqual({ anno: 2043 });
    // Un filtro toglie il 2026 e accorcia il 2043: l'anno scelto è ancora lì.
    const dopo = paginePerAnno([anno(2043, 2), anno(2044, 6), anno(2045, 4)]);
    expect(dopo[indicePagina(dopo, scelta, null)].etichetta).toBe("2043–2045");
  });

  it("se l'anno scelto non c'è più, la prima pagina", () => {
    const pagine = paginePerAnno([anno(2030, 20), anno(2031, 20)]);
    expect(indicePagina(pagine, { anno: 2040 }, null)).toBe(0);
    expect(indicePagina(pagine, null, null)).toBe(0);
  });

  it("senza anni la pagina vale solo per l'elenco su cui è stata scelta", () => {
    const elenco = Array.from({ length: 120 }, (_, i) => i);
    const pagine = pagineDiRighe(elenco, 50);
    const scelta = sceltaDi(pagine, 2, elenco);
    expect(indicePagina(pagine, scelta, elenco)).toBe(2);
    const riordinato = [...elenco].reverse();
    expect(indicePagina(pagineDiRighe(riordinato, 50), scelta, riordinato)).toBe(0);
  });

  it("passando da una divisione all'altra si riparte dalla prima", () => {
    const elenco = Array.from({ length: 30 }, (_, i) => i);
    const perAnno = paginePerAnno([anno(2030, 20), anno(2031, 20)]);
    const diRighe = pagineDiRighe(elenco, 10);
    expect(indicePagina(diRighe, { anno: 2031 }, elenco)).toBe(0);
    expect(indicePagina(perAnno, { indice: 1, elenco }, elenco)).toBe(0);
  });
});
