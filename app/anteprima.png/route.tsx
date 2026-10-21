import { ImageResponse } from "next/og";

/**
 * /anteprima.png: l'immagine del sito quando lo si condivide, o lo mostra
 * un motore di ricerca: marchio, titolo e cosa fa, coi colori della
 * testata. Si disegna alla compilazione, col carattere di serie di
 * `next/og`: i caratteri del sito sono woff2 variabili, che chi disegna
 * l'immagine non legge.
 *
 * È una route e non un `opengraph-image.tsx` perché quello esce senza
 * estensione, e GitHub Pages lo servirebbe come file qualunque invece che
 * come PNG. La dichiara `OPEN_GRAPH_SITO` (lib/sito.ts).
 */
export const dynamic = "force-static";

export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 80,
          background: "#0c1a2e",
          color: "#ffffff",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <svg width="72" height="72" viewBox="0 0 28 28">
            <rect width="28" height="28" rx="6" fill="#0a5bb5" />
            <path d="M19.5 14a5.5 5.5 0 1 1-1.6-3.9" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
            <path d="M18.6 6.9v3.6H15" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div style={{ display: "flex", fontSize: 44, fontWeight: 600 }}>
            quanto<span style={{ fontWeight: 400, opacity: 0.75 }}>torna</span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.1 }}>
            Quanto torna davvero un titolo di Stato
          </div>
          <div style={{ fontSize: 34, color: "#a8b5c7", lineHeight: 1.35 }}>
            Rendimento netto secondo il fisco italiano e cifra finale in euro, per BTP, BOT e
            titoli di Stato del MOT. Aggiornato ogni giorno.
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
