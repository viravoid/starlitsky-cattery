#!/usr/bin/env bash
set -euo pipefail

# Stage a prebuilt Admin bundle without changing the active API or Admin link.
ROOT_DIR="${ROOT_DIR:-/opt/starlitsky}"
SHA="${1:?usage: stage-admin-release.sh <40-char-sha> <built-admin-dir>}"
SOURCE="${2:?usage: stage-admin-release.sh <40-char-sha> <built-admin-dir>}"
: "${EXPECTED_API_BASE_URL:?Set the reviewed Admin API URL}"

[[ "$SHA" =~ ^[0-9a-f]{40}$ ]] || { echo "Invalid release SHA" >&2; exit 1; }
[[ -f "$SOURCE/index.html" && -d "$SOURCE/assets" ]] || { echo "Incomplete Admin bundle" >&2; exit 1; }
grep -rqF -- "$EXPECTED_API_BASE_URL" "$SOURCE/assets" || {
  echo "Admin bundle does not contain the reviewed API URL" >&2
  exit 1
}

ADMIN_DIR="$ROOT_DIR/admin"
RELEASES="$ADMIN_DIR/releases"
TARGET="$RELEASES/$SHA"
[[ ! -e "$TARGET" ]] || { echo "Admin release already staged: $TARGET" >&2; exit 1; }
mkdir -p "$RELEASES" "$ADMIN_DIR/assets"
STAGE="$(mktemp -d "$RELEASES/.stage.XXXXXXXX")"
cp -a "$SOURCE/." "$STAGE/"

# Keep every hash asset referenced by the old and new HTML. Never overwrite a
# same-named asset with different bytes; that would break a still-open old page.
while IFS= read -r -d '' FILE; do
  RELATIVE="${FILE#"$STAGE/assets/"}"
  DEST="$ADMIN_DIR/assets/$RELATIVE"
  mkdir -p "$(dirname "$DEST")"
  if [[ -e "$DEST" ]]; then
    cmp -s "$FILE" "$DEST" || { echo "Hash asset collision: $RELATIVE" >&2; exit 1; }
  else
    cp -p "$FILE" "$DEST"
  fi
done < <(find "$STAGE/assets" -type f -print0)

mv -T "$STAGE" "$TARGET"
echo "Staged Admin $SHA at $TARGET; active link unchanged"
