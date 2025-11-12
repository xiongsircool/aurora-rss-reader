#!/usr/bin/env bash
set -euo pipefail

echo "[scan] Searching for potential secrets..."

patterns=(
  'GLM_API_KEY='
  'Authorization: \s*"?Bearer\s+[A-Za-z0-9._-]{10,}'
  '\bsk-[A-Za-z0-9]{20,}'
  '\b(api|apikey|api_key|apiKey)["'":= ]+\w{16,}'
)

fail=0
for pat in "${patterns[@]}"; do
  if rg -n -S --hidden --glob '!node_modules/**' --glob '!**/*.png' --glob '!**/*.jpg' --glob '!**/*.jpeg' --glob '!**/*.svg' --glob '!**/*.icns' --glob '!**/*.ico' "$pat" . ; then
    echo "[warn] Matched pattern: $pat"
    fail=1
  fi
done

if [ $fail -eq 0 ]; then
  echo "[ok] No obvious secrets detected in tracked files."
else
  echo "[alert] Potential secrets found. Please sanitize before commit/push." >&2
  exit 2
fi

