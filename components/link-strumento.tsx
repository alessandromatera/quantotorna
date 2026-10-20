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
      className={`text-[var(--inchiostro)] decoration-[var(--accento)] underline-offset-[3px] hover:text-[var(--accento)] hover:underline ${className}`}
    >
      {children}
      <svg viewBox="0 0 12 12" aria-hidden className="ml-1 inline-block h-2.5 w-2.5 align-baseline text-[var(--inchiostro-muto)]" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4.5 2.5h5v5M9.5 2.5 3 9" />
      </svg>
    </a>
  );
}
