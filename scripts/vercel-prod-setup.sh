#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   scripts/vercel-prod-setup.sh <domain>
#
# Example:
#   scripts/vercel-prod-setup.sh app.hamafx.com

DOMAIN="${1:-}"
if [ -z "$DOMAIN" ]; then
  echo "Usage: $0 <domain>"
  exit 1
fi

echo "Linking project (if not linked yet)..."
npx vercel link --yes

echo "Adding custom domain..."
npx vercel domains add "$DOMAIN"
npx vercel alias set "$DOMAIN"

echo "Suggested environment variables:"
echo "  npx vercel env add LIVE_BASE_URL production"
echo "  npx vercel env add PROD_HEALTHCHECK_URL production"
echo "Then set the values to:"
echo "  https://$DOMAIN"

echo "Done. HTTPS is managed automatically by Vercel for valid DNS."
