#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

COMMIT="${1:-b386ec6}"
TS="$(date +%Y%m%d-%H%M)"
mkdir -p backups

ARCHIVE="backups/hamafx-v1-${COMMIT}-${TS}.tar.gz"
WORKTREE="backups/hamafx-pre-v2-working-tree-${TS}.tar.gz"

# Commit snapshot
git archive --format=tar.gz -o "$ARCHIVE" "$COMMIT"
sha256sum "$ARCHIVE" > "$ARCHIVE.sha256"

# Working tree snapshot (without heavy/unnecessary folders)
TMP="/tmp/$(basename "$WORKTREE")"
tar --exclude='.git' \
    --exclude='node_modules' \
    --exclude='dist' \
    --exclude='playwright-report' \
    --exclude='test-results' \
    --exclude='coverage' \
    --exclude='backups' \
    -czf "$TMP" .
mv "$TMP" "$WORKTREE"
sha256sum "$WORKTREE" > "$WORKTREE.sha256"

echo "Created:"
echo "  $ARCHIVE"
echo "  $WORKTREE"
