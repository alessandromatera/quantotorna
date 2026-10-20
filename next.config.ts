import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Sito statico: `next build` scrive in out/ HTML, CSS e JS, da servire
  // così come sono (GitHub Pages). Niente server, quindi niente API: i conti
  // della tabella si fanno alla compilazione, quelli di chi guarda nel suo
  // browser.
  output: "export",
  // /metodologia/ → metodologia/index.html: funziona su qualunque hosting
  // statico senza regole di riscrittura.
  trailingSlash: true,
  // C'è un package-lock.json anche più in alto: la radice è questa.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
