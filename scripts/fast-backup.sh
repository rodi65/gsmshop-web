#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
DEST="${1:-$HOME/Desktop/CEPLOG-BACKUPS/fast-$STAMP}"
ARCHIVE_NAME="ceplog-code-fast-$STAMP.tar.gz"

mkdir -p "$DEST/repo"

rsync -a \
  --exclude ".DS_Store" \
  --exclude ".git/" \
  --exclude "node_modules/" \
  --exclude "dist/" \
  --exclude "coverage/" \
  --exclude "android/.gradle/" \
  --exclude "android/app/build/" \
  "$ROOT/src" \
  "$ROOT/supabase" \
  "$ROOT/package.json" \
  "$ROOT/package-lock.json" \
  "$ROOT/index.html" \
  "$ROOT/capacitor.config.json" \
  "$ROOT/.gitignore" \
  "$DEST/repo/"

if [ -f "$ROOT/.env" ]; then
  cp "$ROOT/.env" "$DEST/repo/.env"
fi

git -C "$ROOT" rev-parse HEAD > "$DEST/git-head.txt" 2>/dev/null || true
git -C "$ROOT" status -sb > "$DEST/git-status.txt" 2>/dev/null || true
git -C "$ROOT" diff > "$DEST/uncommitted.diff" 2>/dev/null || true

(
  cd "$DEST"
  tar -czf "$ARCHIVE_NAME" repo git-head.txt git-status.txt uncommitted.diff
)

echo "Hizli yedek hazir: $DEST"
echo "Arsiv: $DEST/$ARCHIVE_NAME"
