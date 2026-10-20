import { inflateSync } from "node:zlib";

/**
 * Estrattore di testo per PDF semplici: quanto basta per leggere i risultati
 * d'asta del MEF (lib/prezzi/mef.ts), senza dipendenze esterne.
 *
 * Cosa sa fare: oggetti in chiaro e dentro gli object stream, flussi
 * FlateDecode, font con mappa ToUnicode a uno o due byte (i PDF del MEF usano
 * un Tahoma CID con codifica Identity-H) e font semplici WinAnsi, operatori di
 * testo Tj, TJ, ' e ". Le posizioni servono solo a rimettere in riga etichette
 * e valori, che nei risultati d'asta stanno in blocchi separati alla stessa
 * altezza.
 *
 * Cosa NON sa fare, e non serve: cifratura, font Type3, testo ruotato, layout a
 * colonne. Su un PDF che non capisce restituisce righe vuote o incomplete, e
 * chi lo usa deve trattarlo come «documento non letto», mai come dato.
 */

interface Oggetto {
  dizionario: string;
  flusso: Buffer | null;
}

function decodifica(dizionario: string, grezzo: Buffer): Buffer | null {
  const filtri = dizionario.match(/\/Filter\s*(\[[^\]]*\]|\/\w+)/)?.[1] ?? "";
  if (filtri === "") return grezzo;
  const nomi = filtri.match(/\/\w+/g) ?? [];
  if (nomi.length !== 1 || nomi[0] !== "/FlateDecode") return null;
  try {
    return inflateSync(grezzo);
  } catch {
    return null;
  }
}

/** Il flusso di un oggetto: fra `stream` e `endstream`, decodificato. */
function flussoDi(buf: Buffer, testo: string, inizioDizionario: number, fineOggetto: number): {
  dizionario: string;
  flusso: Buffer | null;
} {
  const corpo = testo.slice(inizioDizionario, fineOggetto);
  const posStream = corpo.search(/\bstream\r?\n/);
  if (posStream < 0) return { dizionario: corpo, flusso: null };
  const dizionario = corpo.slice(0, posStream);
  const aCapo = corpo.slice(posStream).match(/^stream\r?\n/)![0].length;
  const inizio = inizioDizionario + posStream + aCapo;
  // /Length diretta quando c'è; altrimenti fino a `endstream`.
  const lunghezza = dizionario.match(/\/Length\s+(\d+)(?!\s+\d+\s+R)/)?.[1];
  const fine =
    lunghezza != null && inizio + Number(lunghezza) <= fineOggetto
      ? inizio + Number(lunghezza)
      : testo.lastIndexOf("endstream", fineOggetto);
  return { dizionario, flusso: decodifica(dizionario, buf.subarray(inizio, fine)) };
}

function leggiOggetti(buf: Buffer): Map<number, Oggetto> {
  const testo = buf.toString("latin1");
  const oggetti = new Map<number, Oggetto>();
  const intestazioni = [...testo.matchAll(/(\d+)\s+\d+\s+obj\b/g)];
  for (const [i, m] of intestazioni.entries()) {
    const inizio = m.index! + m[0].length;
    const limite = intestazioni[i + 1]?.index ?? testo.length;
    const fine = testo.lastIndexOf("endobj", limite);
    oggetti.set(Number(m[1]), flussoDi(buf, testo, inizio, fine > inizio ? fine : limite));
  }
  // Object stream (PDF 1.5+): gli oggetti compressi stanno uno dopo l'altro
  // nel flusso, con una tabella di numeri e posizioni in testa.
  for (const o of [...oggetti.values()]) {
    if (!/\/Type\s*\/ObjStm/.test(o.dizionario) || !o.flusso) continue;
    const n = Number(o.dizionario.match(/\/N\s+(\d+)/)?.[1] ?? 0);
    const primo = Number(o.dizionario.match(/\/First\s+(\d+)/)?.[1] ?? 0);
    const contenuto = o.flusso.toString("latin1");
    const tabella = contenuto.slice(0, primo).trim().split(/\s+/).map(Number);
    for (let k = 0; k < n; k++) {
      const numero = tabella[2 * k];
      const da = primo + tabella[2 * k + 1];
      const a = k + 1 < n ? primo + tabella[2 * k + 3] : contenuto.length;
      if (!oggetti.has(numero)) {
        oggetti.set(numero, { dizionario: contenuto.slice(da, a), flusso: null });
      }
    }
  }
  return oggetti;
}

function riferimento(dizionario: string, chiave: string): number | null {
  const m = dizionario.match(new RegExp(`/${chiave}\\s+(\\d+)\\s+\\d+\\s+R`));
  return m ? Number(m[1]) : null;
}

interface Font {
  /** Byte per codice: 2 sui font CID Identity-H, 1 sui font semplici. */
  byte: 1 | 2;
  mappa: Map<number, string> | null;
}

function leggiCMap(cmap: string): { byte: 1 | 2; mappa: Map<number, string> } {
  const mappa = new Map<number, string>();
  const spazio = cmap.match(/begincodespacerange\s*<([0-9a-fA-F]+)>/);
  const byte: 1 | 2 = spazio && spazio[1].length <= 2 ? 1 : 2;
  const unicode = (hex: string) => {
    let s = "";
    for (let i = 0; i + 4 <= hex.length; i += 4) s += String.fromCharCode(parseInt(hex.slice(i, i + 4), 16));
    return s;
  };
  for (const blocco of cmap.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const r of blocco[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g)) {
      mappa.set(parseInt(r[1], 16), unicode(r[2]));
    }
  }
  for (const blocco of cmap.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    for (const r of blocco[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*(<[0-9a-fA-F]+>|\[[^\]]*\])/g)) {
      const da = parseInt(r[1], 16);
      const a = parseInt(r[2], 16);
      if (r[3].startsWith("[")) {
        const voci = [...r[3].matchAll(/<([0-9a-fA-F]+)>/g)].map((x) => x[1]);
        voci.forEach((v, k) => mappa.set(da + k, unicode(v)));
      } else {
        const base = parseInt(r[3].slice(1, -1), 16);
        for (let c = da; c <= a && c - da < 65536; c++) mappa.set(c, String.fromCharCode(base + c - da));
      }
    }
  }
  return { byte, mappa };
}

function leggiFont(oggetti: Map<number, Oggetto>, numero: number): Font {
  const dizionario = oggetti.get(numero)?.dizionario ?? "";
  const tu = riferimento(dizionario, "ToUnicode");
  const cmap = tu != null ? oggetti.get(tu)?.flusso?.toString("latin1") : undefined;
  if (cmap) return leggiCMap(cmap);
  // Senza ToUnicode: font semplice, il byte è il carattere (WinAnsi ≈ latin1).
  return { byte: /\/Identity-H/.test(dizionario) ? 2 : 1, mappa: null };
}

/** Nome risorsa (F1) → font, dalle risorse di una pagina. */
function fontDellaPagina(oggetti: Map<number, Oggetto>, risorse: string): Map<string, Font> {
  const font = new Map<string, Font>();
  let elenco = risorse.match(/\/Font\s*<<([\s\S]*?)>>/)?.[1];
  if (elenco == null) {
    const rif = riferimento(risorse, "Font");
    elenco = rif != null ? oggetti.get(rif)?.dizionario : undefined;
  }
  for (const m of (elenco ?? "").matchAll(/\/([^\s/<>[\]()]+)\s+(\d+)\s+\d+\s+R/g)) {
    font.set(m[1], leggiFont(oggetti, Number(m[2])));
  }
  return font;
}

type Token =
  | { tipo: "numero"; valore: number }
  | { tipo: "stringa"; byte: number[] }
  | { tipo: "nome"; valore: string }
  | { tipo: "array"; voci: Token[] }
  | { tipo: "operatore"; valore: string };

function tokenizza(s: string): Token[] {
  const radice: Token[] = [];
  const pila: Token[][] = [radice];
  let i = 0;
  const corrente = () => pila[pila.length - 1];
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) {
      i++;
    } else if (c === "%") {
      while (i < s.length && s[i] !== "\n" && s[i] !== "\r") i++;
    } else if (c === "(") {
      const byte: number[] = [];
      let profondita = 1;
      i++;
      while (i < s.length && profondita > 0) {
        const x = s[i];
        if (x === "\\") {
          const y = s[i + 1];
          const escape: Record<string, number> = { n: 10, r: 13, t: 9, b: 8, f: 12, "(": 40, ")": 41, "\\": 92 };
          if (y in escape) {
            byte.push(escape[y]);
            i += 2;
          } else if (/[0-7]/.test(y)) {
            const ottale = s.slice(i + 1, i + 4).match(/^[0-7]{1,3}/)![0];
            byte.push(parseInt(ottale, 8) & 255);
            i += 1 + ottale.length;
          } else if (y === "\r" || y === "\n") {
            i += y === "\r" && s[i + 2] === "\n" ? 3 : 2;
          } else {
            i += 1;
          }
        } else {
          if (x === "(") profondita++;
          if (x === ")") profondita--;
          if (profondita > 0) byte.push(x.charCodeAt(0) & 255);
          i++;
        }
      }
      corrente().push({ tipo: "stringa", byte });
    } else if (c === "<" && s[i + 1] === "<") {
      // Dizionario inline (marked content): lo si salta.
      const fine = s.indexOf(">>", i);
      i = fine < 0 ? s.length : fine + 2;
    } else if (c === "<") {
      const fine = s.indexOf(">", i);
      const hex = s.slice(i + 1, fine < 0 ? s.length : fine).replace(/\s+/g, "");
      const byte: number[] = [];
      for (let k = 0; k < hex.length; k += 2) byte.push(parseInt(hex.slice(k, k + 2).padEnd(2, "0"), 16));
      corrente().push({ tipo: "stringa", byte });
      i = fine < 0 ? s.length : fine + 1;
    } else if (c === "[") {
      const voci: Token[] = [];
      corrente().push({ tipo: "array", voci });
      pila.push(voci);
      i++;
    } else if (c === "]") {
      if (pila.length > 1) pila.pop();
      i++;
    } else if (c === "/") {
      const m = s.slice(i + 1).match(/^[^\s/<>[\]()%{}]*/)![0];
      corrente().push({ tipo: "nome", valore: m });
      i += 1 + m.length;
    } else if (/[0-9+\-.]/.test(c)) {
      const m = s.slice(i).match(/^[+-]?(\d+\.?\d*|\.\d+)/);
      if (m) {
        corrente().push({ tipo: "numero", valore: Number(m[0]) });
        i += m[0].length;
      } else {
        i++;
      }
    } else {
      const m = s.slice(i).match(/^[^\s/<>[\]()%{}]+/);
      const parola = m ? m[0] : c;
      corrente().push({ tipo: "operatore", valore: parola });
      i += parola.length;
    }
  }
  return radice;
}

interface Frammento {
  x: number;
  y: number;
  testo: string;
}

function decodificaStringa(byte: number[], font: Font | undefined): string {
  const passo = font?.byte ?? 1;
  let s = "";
  for (let i = 0; i + passo <= byte.length; i += passo) {
    const codice = passo === 2 ? (byte[i] << 8) | byte[i + 1] : byte[i];
    s += font?.mappa?.get(codice) ?? (passo === 1 ? String.fromCharCode(codice) : "");
  }
  return s;
}

function frammentiDi(contenuto: string, font: Map<string, Font>): Frammento[] {
  const frammenti: Frammento[] = [];
  const operandi: Token[] = [];
  let fontCorrente: Font | undefined;
  let lx = 0;
  let ly = 0;
  let x = 0;
  let y = 0;
  let interlinea = 0;
  const num = (k: number) => {
    const t = operandi[operandi.length - k];
    return t?.tipo === "numero" ? t.valore : 0;
  };
  const scrivi = (testo: string) => {
    if (testo !== "") frammenti.push({ x, y, testo });
    // Ogni scrittura avanza un poco: due Tj consecutivi nella stessa riga
    // restano in ordine anche senza calcolare la larghezza dei glifi.
    x += 0.001;
  };
  for (const t of tokenizza(contenuto)) {
    if (t.tipo !== "operatore") {
      operandi.push(t);
      continue;
    }
    switch (t.valore) {
      case "BT":
        lx = x = 0;
        ly = y = 0;
        break;
      case "Tf": {
        const nome = operandi[operandi.length - 2];
        if (nome?.tipo === "nome") fontCorrente = font.get(nome.valore);
        break;
      }
      case "TL":
        interlinea = num(1);
        break;
      case "Tm":
        lx = x = num(2);
        ly = y = num(1);
        break;
      case "Td":
        lx = x = lx + num(2);
        ly = y = ly + num(1);
        break;
      case "TD":
        interlinea = -num(1);
        lx = x = lx + num(2);
        ly = y = ly + num(1);
        break;
      case "T*":
        lx = x = lx;
        ly = y = ly - interlinea;
        break;
      case "Tj":
      case "'":
      case '"': {
        if (t.valore !== "Tj") {
          ly = y = ly - interlinea;
          x = lx;
        }
        const s = operandi[operandi.length - 1];
        if (s?.tipo === "stringa") scrivi(decodificaStringa(s.byte, fontCorrente));
        break;
      }
      case "TJ": {
        const a = operandi[operandi.length - 1];
        if (a?.tipo === "array") {
          let testo = "";
          for (const v of a.voci) {
            if (v.tipo === "stringa") testo += decodificaStringa(v.byte, fontCorrente);
            // Uno spostamento grande fra due pezzi è uno spazio.
            else if (v.tipo === "numero" && v.valore < -200) testo += " ";
          }
          scrivi(testo);
        }
        break;
      }
    }
    operandi.length = 0;
  }
  return frammenti;
}

/**
 * Il testo di un PDF, una riga per linea di base: i pezzi alla stessa altezza
 * (entro due punti) in ordine da sinistra, spazi ripuliti, righe dall'alto.
 */
export function righePdf(buf: Buffer): string[] {
  if (buf.subarray(0, 5).toString("latin1") !== "%PDF-") return [];
  const oggetti = leggiOggetti(buf);
  const righe: string[] = [];
  const pagine = [...oggetti.values()].filter((o) => /\/Type\s*\/Page(?!s)/.test(o.dizionario));
  for (const pagina of pagine) {
    let risorse = pagina.dizionario;
    const rifRisorse = riferimento(pagina.dizionario, "Resources");
    if (rifRisorse != null) risorse = oggetti.get(rifRisorse)?.dizionario ?? "";
    const font = fontDellaPagina(oggetti, risorse);
    const contenuti = pagina.dizionario.match(/\/Contents\s*(\[[^\]]*\]|\d+\s+\d+\s+R)/)?.[1] ?? "";
    const testo = [...contenuti.matchAll(/(\d+)\s+\d+\s+R/g)]
      .map((m) => oggetti.get(Number(m[1]))?.flusso?.toString("latin1") ?? "")
      .join("\n");
    const frammenti = frammentiDi(testo, font).sort((a, b) => b.y - a.y || a.x - b.x);
    let riga: Frammento[] = [];
    const chiudi = () => {
      if (riga.length === 0) return;
      const t = riga
        .sort((a, b) => a.x - b.x)
        .map((f) => f.testo)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (t !== "") righe.push(t);
      riga = [];
    };
    for (const f of frammenti) {
      if (riga.length > 0 && Math.abs(riga[0].y - f.y) > 2) chiudi();
      riga.push(f);
    }
    chiudi();
  }
  return righe;
}
