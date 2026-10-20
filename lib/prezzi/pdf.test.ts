import { deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { righePdf } from "./pdf";

/**
 * Un PDF minimo con la stessa struttura dei risultati d'asta del MEF: font
 * CID a due byte con mappa ToUnicode, testo compresso, etichetta e valore in
 * due blocchi separati alla stessa altezza. Costruito qui, così il test non
 * dipende da un file scaricato.
 */
function pdfDiProva(): Buffer {
  // Codici a due byte = carattere − 29, come nel Tahoma dei PDF del MEF.
  const codifica = (t: string) =>
    "<" + [...t].map((c) => (c.charCodeAt(0) - 29).toString(16).padStart(4, "0")).join("") + ">";
  const caratteri = [...new Set("Codice ISIN IT0005729931Prezzo Fiscale 99,560")];
  const cmap = `/CIDInit /ProcSet findresource begin
begincmap
1 begincodespacerange
<0000><FFFF>
endcodespacerange
${caratteri.length} beginbfrange
${caratteri.map((c) => { const k = (c.charCodeAt(0) - 29).toString(16).padStart(4, "0"); return `<${k}><${k}><${c.charCodeAt(0).toString(16).padStart(4, "0")}>`; }).join("\n")}
endbfrange
endcmap`;
  const contenuto = `BT /F1 10 Tf 1 0 0 1 36 700 Tm ${codifica("Codice ISIN")} Tj ET
BT /F1 10 Tf 1 0 0 1 300 700.4 Tm ${codifica("IT0005729931")} Tj ET
BT /F1 10 Tf 1 0 0 1 36 680 Tm [${codifica("Prezzo")} -250 ${codifica("Fiscale")}] TJ ET
BT /F1 10 Tf 1 0 0 1 300 680 Tm ${codifica("99,560")} Tj ET
BT /F2 8 Tf 36 650 Td (Gli importi \\(milioni\\)) Tj ET`;
  const flusso = (dati: Buffer) => [`<< /Length ${dati.length} /Filter /FlateDecode >>\nstream\n`, dati, "\nendstream"];
  const parti: (string | Buffer)[] = ["%PDF-1.4\n"];
  const ogg = (n: number, ...corpo: (string | Buffer)[]) => parti.push(`${n} 0 obj\n`, ...corpo, "\nendobj\n");
  ogg(1, "<< /Type /Catalog /Pages 2 0 R >>");
  ogg(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  ogg(3, "<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R /F2 6 0 R >> >> /Contents 5 0 R >>");
  ogg(4, "<< /Type /Font /Subtype /Type0 /BaseFont /Tahoma /Encoding /Identity-H /ToUnicode 7 0 R >>");
  ogg(5, ...flusso(deflateSync(Buffer.from(contenuto, "latin1"))));
  ogg(6, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  ogg(7, ...flusso(deflateSync(Buffer.from(cmap, "latin1"))));
  parti.push("trailer << /Root 1 0 R >>\n%%EOF");
  return Buffer.concat(parti.map((p) => (typeof p === "string" ? Buffer.from(p, "latin1") : p)));
}

describe("righePdf", () => {
  it("rimette in riga etichetta e valore, decodificando i font CID e quelli semplici", () => {
    expect(righePdf(pdfDiProva())).toEqual([
      "Codice ISIN IT0005729931",
      "Prezzo Fiscale 99,560",
      "Gli importi (milioni)",
    ]);
  });

  it("su qualcosa che non è un PDF non inventa testo", () => {
    expect(righePdf(Buffer.from("<html>pagina d'errore</html>"))).toEqual([]);
  });
});
