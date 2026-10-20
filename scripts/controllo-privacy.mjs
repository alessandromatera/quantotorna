#!/usr/bin/env node
/**
 * Controllo meccanico dei dati personali, prima che lascino la macchina.
 *
 *   node scripts/controllo-privacy.mjs --indice              file in stage (pre-commit)
 *   node scripts/controllo-privacy.mjs --commit <sha> [...]  commit da pubblicare (pre-push)
 *   node scripts/controllo-privacy.mjs --cartella out        sito compilato
 *
 * Legge, FUORI dalla repo, in ~/.config/quantotorna/:
 * - `dati-personali.txt`: una voce per riga (# per i commenti). Ogni
 *   occorrenza, maiuscole o minuscole, ferma tutto;
 * - `identita`: righe `nome=` ed `email=`, l'unica identità con cui si
 *   firmano i commit;
 * - `ammessi.txt` (facoltativo): righe `percorso<TAB>voce`, eccezioni già
 *   guardate a mano; `*` come percorso vale ovunque;
 * - `aggiorna-lista` (facoltativo, eseguibile): se c'è, si lancia prima di
 *   tutto per rigenerare la lista, così un dato nuovo dell'autore è coperto
 *   dal commit successivo senza che nessuno debba ricordarselo. Se fallisce
 *   il controllo si ferma: una lista vecchia lascerebbe passare proprio i
 *   dati più recenti.
 *
 * È il controllo che non sbaglia sulle stringhe esatte. Quello che una
 * ricerca di testo non vede — una frase che rivela una posizione, un importo
 * scritto in un altro modo — è il mestiere dell'agente guardiano-privacy,
 * che il pre-push lancia dopo questo.
 *
 * Esce con 1 se trova qualcosa, e anche se la lista o l'identità mancano:
 * senza lista il controllo non controllerebbe niente, e direbbe di sì.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join, relative } from "node:path";

const CONFIG = join(homedir(), ".config", "quantotorna");

/** File che non devono mai uscire, qualunque cosa contengano. */
const FILE_VIETATI = [
  /\.(db|db-wal|db-shm|sqlite|sqlite3)$/i,
  /(^|\/)\.env/i,
  /\.(pem|key|p12)$/i,
  /(^|\/)accesso\.json$/i,
  /(^|\/)id_(rsa|ed25519)/i,
];

/** Sotto questa lunghezza una voce troverebbe solo rumore. */
const LUNGHEZZA_MINIMA = 4;

function leggiRighe(file) {
  if (!existsSync(file)) return null;
  return readFileSync(file, "utf8")
    .split("\n")
    .map((r) => r.trim())
    .filter((r) => r !== "" && !r.startsWith("#"));
}

function git(...argomenti) {
  return execFileSync("git", argomenti, { encoding: "buffer", maxBuffer: 256 * 1024 * 1024 });
}

function aggiornaLista() {
  const comando = join(CONFIG, "aggiorna-lista");
  if (!existsSync(comando)) return;
  try {
    execFileSync(comando, { stdio: ["ignore", "ignore", "inherit"] });
  } catch {
    throw new Error(`l'aggiornamento della lista (${comando}) non è riuscito`);
  }
}

function caricaConfigurazione() {
  const voci = leggiRighe(join(CONFIG, "dati-personali.txt"));
  const identita = leggiRighe(join(CONFIG, "identita"));
  if (!voci || voci.length === 0) {
    throw new Error(`manca la lista dei dati personali (${join(CONFIG, "dati-personali.txt")})`);
  }
  if (!identita) throw new Error(`manca l'identità dei commit (${join(CONFIG, "identita")})`);
  const campo = (nome) => identita.find((r) => r.startsWith(`${nome}=`))?.slice(nome.length + 1).trim();
  const nome = campo("nome");
  const email = campo("email");
  if (!nome || !email) throw new Error("l'identità deve avere sia nome= sia email=");
  const ammessi = (leggiRighe(join(CONFIG, "ammessi.txt")) ?? []).map((r) => {
    const [percorso, voce] = r.split("\t");
    return { percorso, voce: (voce ?? "").toLowerCase() };
  });
  return {
    voci: voci.filter((v) => v.length >= LUNGHEZZA_MINIMA).map((v) => v.toLowerCase()),
    corte: voci.filter((v) => v.length < LUNGHEZZA_MINIMA),
    nome,
    email,
    ammessi,
  };
}

const problemi = [];

/** Ogni voce della lista trovata nel testo, con la riga, salvo le eccezioni. */
function cerca(config, percorso, testo) {
  const minuscolo = testo.toLowerCase();
  for (const voce of config.voci) {
    let da = minuscolo.indexOf(voce);
    if (da < 0) continue;
    const ammessa = config.ammessi.some(
      (a) => a.voce === voce && (a.percorso === "*" || a.percorso === percorso),
    );
    if (ammessa) continue;
    while (da >= 0) {
      const riga = minuscolo.slice(0, da).split("\n").length;
      problemi.push(`${percorso}:${riga}: contiene «${voce}»`);
      da = minuscolo.indexOf(voce, da + voce.length);
    }
  }
}

function controllaPercorso(percorso) {
  if (FILE_VIETATI.some((r) => r.test(percorso))) {
    problemi.push(`${percorso}: tipo di file che non deve mai uscire`);
  }
}

function controllaIdentita(config, chi, nome, email) {
  if (email.toLowerCase() !== config.email.toLowerCase()) {
    problemi.push(`${chi}: email «${email}» diversa da quella pubblica (${config.email})`);
  }
  if (nome !== config.nome) {
    problemi.push(`${chi}: nome «${nome}» diverso da quello pubblico (${config.nome})`);
  }
}

function controllaIndice(config) {
  const nome = git("config", "user.name").toString().trim();
  const email = git("config", "user.email").toString().trim();
  controllaIdentita(config, "git config", nome, email);
  const file = git("diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z")
    .toString()
    .split("\0")
    .filter(Boolean);
  for (const percorso of file) {
    controllaPercorso(percorso);
    cerca(config, percorso, git("show", `:${percorso}`).toString("latin1"));
  }
  return file.length;
}

function controllaCommit(config, commit) {
  let file = 0;
  for (const sha of commit) {
    const [autore, emailAutore, committer, emailCommitter, messaggio] = git(
      "show",
      "-s",
      "--format=%an%x00%ae%x00%cn%x00%ce%x00%B",
      sha,
    )
      .toString()
      .split("\0");
    const breve = sha.slice(0, 7);
    controllaIdentita(config, `commit ${breve} (autore)`, autore, emailAutore);
    controllaIdentita(config, `commit ${breve} (committer)`, committer, emailCommitter);
    cerca(config, `commit ${breve} (messaggio)`, messaggio);
    const cambiati = git("diff-tree", "--no-commit-id", "--name-only", "-r", "-z", "--root", "--diff-filter=ACMR", sha)
      .toString()
      .split("\0")
      .filter(Boolean);
    for (const percorso of cambiati) {
      controllaPercorso(percorso);
      cerca(config, percorso, git("show", `${sha}:${percorso}`).toString("latin1"));
      file++;
    }
  }
  return file;
}

function controllaCartella(config, cartella) {
  let file = 0;
  const visita = (dir) => {
    for (const voce of readdirSync(dir)) {
      const pieno = join(dir, voce);
      if (statSync(pieno).isDirectory()) {
        visita(pieno);
        continue;
      }
      const percorso = relative(process.cwd(), pieno);
      controllaPercorso(percorso);
      cerca(config, percorso, readFileSync(pieno).toString("latin1"));
      file++;
    }
  };
  visita(cartella);
  return file;
}

function main() {
  const [modo, ...resto] = process.argv.slice(2);
  let config;
  try {
    aggiornaLista();
    config = caricaConfigurazione();
  } catch (e) {
    console.error(`controllo-privacy: ${e.message}. Niente esce finché non c'è.`);
    process.exit(1);
  }

  let controllati;
  if (modo === "--indice") controllati = controllaIndice(config);
  else if (modo === "--commit" && resto.length > 0) controllati = controllaCommit(config, resto);
  else if (modo === "--cartella" && resto.length === 1) controllati = controllaCartella(config, resto[0]);
  else {
    console.error("uso: controllo-privacy.mjs --indice | --commit <sha>... | --cartella <dir>");
    process.exit(2);
  }

  if (config.corte.length > 0) {
    console.error(
      `controllo-privacy: ${config.corte.length} voci più corte di ${LUNGHEZZA_MINIMA} caratteri ignorate: sono compito dell'agente.`,
    );
  }
  if (problemi.length > 0) {
    console.error(`controllo-privacy: FERMO, ${problemi.length} occorrenze di dati personali:`);
    for (const p of problemi) console.error(`  ${p}`);
    console.error(
      "Correggi il file, o se è un falso allarme aggiungi l'eccezione motivata in ~/.config/quantotorna/ammessi.txt.",
    );
    process.exit(1);
  }
  console.error(`controllo-privacy: nessun dato personale in ${controllati} file.`);
}

main();
