import { writeFileSync } from "node:fs";
import { changelogMarkdown } from "../lib/novita";

// Scrive CHANGELOG.md da lib/novita.ts: le stesse voci della pagina Informazioni.
writeFileSync(new URL("../CHANGELOG.md", import.meta.url), changelogMarkdown());
