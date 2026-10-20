import { linkInformativo } from "@/lib/link-esterni";
import type { TipoCatalogo } from "@/lib/categorie";

/**
 * Il nome di un titolo come link alla sua scheda su Borsa Italiana. Si apre
 * in una nuova scheda; il sito non chiama quell'URL.
 */
export function LinkStrumento({
  isin,
  tipo,
  emittente,
  children,
  className = "",
}: {
  isin: string;
  tipo: TipoCatalogo;
  emittente: string;
  children: React.ReactNode;
  className?: string;
}) {
  const { url, fonte } = linkInformativo({ isin, tipo, emittente });
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title={`Apri la scheda su ${fonte} ↗`}
      className={`text-[var(--serie-1)] underline decoration-[var(--serie-1)]/30 underline-offset-2 hover:decoration-[var(--serie-1)] ${className}`}
    >
      {children}
      <span aria-hidden className="ml-0.5 text-[0.85em]">
        ↗
      </span>
    </a>
  );
}
