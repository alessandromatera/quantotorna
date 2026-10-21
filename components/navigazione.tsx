"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const VOCI = [
  { href: "/", nome: "Titoli" },
  { href: "/metodologia/", nome: "Metodologia" },
  { href: "/informazioni/", nome: "Informazioni" },
];

/** Le sezioni del sito, con quella in cui si è segnata (e detta agli screen reader). */
export function Navigazione() {
  const percorso = usePathname();
  return (
    <nav aria-label="Sezioni" className="flex h-full items-stretch gap-1 text-sm">
      {VOCI.map((v) => {
        const attiva = v.href === "/" ? percorso === "/" : percorso?.startsWith(v.href.replace(/\/$/, ""));
        return (
          <Link
            key={v.href}
            href={v.href}
            aria-current={attiva ? "page" : undefined}
            className={`flex items-center border-b-2 px-2 font-medium transition-colors sm:px-3 ${
              attiva
                ? "border-[var(--marchio-inchiostro)] text-[var(--marchio-inchiostro)]"
                : "border-transparent text-[var(--marchio-muto)] hover:text-[var(--marchio-inchiostro)]"
            }`}
          >
            {v.nome}
          </Link>
        );
      })}
    </nav>
  );
}
