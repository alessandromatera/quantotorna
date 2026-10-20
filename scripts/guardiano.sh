#!/bin/sh
# L'agente guardiano-privacy (Sonnet) sui commit indicati: prepara il
# materiale — autori, messaggi e modifiche complete — in una cartella
# temporanea, glielo fa leggere con i soli strumenti di lettura e accetta
# solo un'ultima riga «ESITO: OK». Qualunque altra cosa, compreso un errore
# di claude, ferma il push.
#
#   scripts/guardiano.sh <sha> [<sha>...]
set -u

if [ "$#" -eq 0 ]; then
  echo "uso: scripts/guardiano.sh <sha>..." >&2
  exit 2
fi
if ! command -v claude >/dev/null 2>&1; then
  echo "guardiano-privacy: claude non è nel PATH, il controllo non può girare: push fermato." >&2
  exit 1
fi

radice=$(git rev-parse --show-toplevel)
config="$HOME/.config/quantotorna"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

{
  echo "# COMMIT DA PUBBLICARE"
  for sha in "$@"; do
    git show -s --format='## commit %H%nautore: %an <%ae>%ncommitter: %cn <%ce>%nmessaggio:%n%B' "$sha"
  done
  echo
  echo "# MODIFICHE COMPLETE"
  for sha in "$@"; do
    echo "## commit $sha"
    git show --format= --patch --no-color --root "$sha"
  done
} >"$tmp/materiale.txt"

echo "guardiano-privacy: controllo di $# commit con Sonnet…" >&2
esito=$(
  cd "$radice" &&
    printf '%s\n' \
      "Controlla prima della pubblicazione." \
      "Materiale: $tmp/materiale.txt" \
      "Dati personali: $config/dati-personali.txt" \
      "Identità pubblica: $config/identita" \
      "Eccezioni: $config/ammessi.txt (se esiste)" |
    claude -p --agent guardiano-privacy --model sonnet \
      --add-dir "$tmp" --add-dir "$config" \
      --allowed-tools "Read,Grep,Glob" 2>&1
)
stato=$?
printf '%s\n' "$esito" >&2

if [ "$stato" -ne 0 ]; then
  echo "guardiano-privacy: claude è uscito con errore ($stato): push fermato." >&2
  exit 1
fi
ultima=$(printf '%s\n' "$esito" | sed -e 's/[*`[:space:]]*$//' -e 's/^[*`[:space:]]*//' | grep -v '^$' | tail -n 1)
if [ "$ultima" != "ESITO: OK" ]; then
  echo "guardiano-privacy: nessun via libera (ultima riga: «${ultima}»): push fermato." >&2
  exit 1
fi
echo "guardiano-privacy: via libera." >&2
