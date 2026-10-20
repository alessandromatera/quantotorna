#!/usr/bin/env node
/**
 * Anteprima del sito compilato: serve out/ così com'è, come lo servirà
 * l'hosting statico.
 *
 *   npm run anteprima            compila e serve su http://localhost:3100
 *   npm run anteprima -- --rete  anche dagli altri dispositivi della rete
 *
 * Serve a provarlo da un telefono o da un altro computer: il server di
 * sviluppo di Next blocca i propri file a chi arriva da un indirizzo diverso
 * da localhost, e la pagina si vede ma non si accende. Gli indirizzi
 * consentiti si dovrebbero scrivere in next.config.ts, cioè nella repo, e lì
 * gli indirizzi di rete non vanno.
 */
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { networkInterfaces } from "node:os";
import { extname, join, normalize, resolve, sep } from "node:path";

const RADICE = resolve("out");
const PORTA = 3100;
const rete = process.argv.includes("--rete");

const TIPI = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

if (!existsSync(join(RADICE, "index.html"))) {
  console.error("manca out/index.html: prima npm run build");
  process.exit(1);
}

/** Il file da servire per un percorso, o null. Mai fuori da out/. */
function file(percorso) {
  const pulito = normalize(decodeURIComponent(percorso.split("?")[0])).replace(/^(\.\.[/\\])+/, "");
  const pieno = join(RADICE, pulito);
  if (pieno !== RADICE && !pieno.startsWith(RADICE + sep)) return null;
  if (existsSync(pieno) && statSync(pieno).isFile()) return pieno;
  const indice = join(pieno, "index.html");
  if (existsSync(indice)) return indice;
  return null;
}

createServer((richiesta, risposta) => {
  const trovato = file(richiesta.url ?? "/");
  const servito = trovato ?? join(RADICE, "404.html");
  risposta.writeHead(trovato ? 200 : 404, {
    "Content-Type": TIPI[extname(servito)] ?? "application/octet-stream",
    "Cache-Control": "no-store",
  });
  createReadStream(servito).pipe(risposta);
}).listen(PORTA, rete ? "0.0.0.0" : "127.0.0.1", () => {
  console.log(`Anteprima di out/ su http://localhost:${PORTA}`);
  if (rete) {
    for (const indirizzi of Object.values(networkInterfaces())) {
      for (const a of indirizzi ?? []) {
        if (a.family === "IPv4" && !a.internal) console.log(`  dalla rete: http://${a.address}:${PORTA}`);
      }
    }
  }
});
