#!/usr/bin/env bash
set -euo pipefail

# Atomic link switch only. It does not build, migrate, restart or remove data.
ROOT_DIR="${ROOT_DIR:-/opt/starlitsky}"
KIND="${1:?usage: switch-release-link.sh api|admin <40-char-sha>}"
SHA="${2:?usage: switch-release-link.sh api|admin <40-char-sha>}"
[[ "$SHA" =~ ^[0-9a-f]{40}$ ]] || { echo "Invalid release SHA" >&2; exit 1; }
case "$KIND" in
  api) RELEASES="$ROOT_DIR/releases"; LINK="$ROOT_DIR/app" ;;
  admin) RELEASES="$ROOT_DIR/admin/releases"; LINK="$ROOT_DIR/admin/current" ;;
  *) echo "Expected api or admin" >&2; exit 1 ;;
esac
TARGET="$RELEASES/$SHA"
[[ -d "$TARGET" ]] || { echo "Release missing: $TARGET" >&2; exit 1; }
[[ ! -e "$LINK" || -L "$LINK" ]] || { echo "Refusing to replace a non-link: $LINK" >&2; exit 1; }
PREVIOUS="$(readlink "$LINK" 2>/dev/null || true)"
NEXT="$LINK.next.$$"
[[ ! -e "$NEXT" && ! -L "$NEXT" ]] || { echo "Temporary link already exists: $NEXT" >&2; exit 1; }
ln -s "$TARGET" "$NEXT"
mv -Tf "$NEXT" "$LINK"
echo "$KIND switched from ${PREVIOUS:-<none>} to $TARGET"
