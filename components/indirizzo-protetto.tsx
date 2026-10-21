"use client";

import { useEffect, useState } from "react";

/**
 * Un indirizzo email che i programmi che raccolgono indirizzi non leggono:
 * nella pagina compilata c'è scritto per esteso a parole, e diventa un link
 * solo nel browser, decodificato da `codificato` (base64).
 */
export function IndirizzoProtetto({ codificato, aParole }: { codificato: string; aParole: string }) {
  const [indirizzo, setIndirizzo] = useState<string | null>(null);
  useEffect(() => {
    setIndirizzo(atob(codificato));
  }, [codificato]);
  if (!indirizzo) return <span>{aParole}</span>;
  return (
    <a href={`mailto:${indirizzo}`} className="text-[var(--accento)] underline underline-offset-2">
      {indirizzo}
    </a>
  );
}
