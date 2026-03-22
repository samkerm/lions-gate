#!/usr/bin/env bash
# Frees Metro's default port (8081) and the next common fallback (8082).
set -euo pipefail

for port in 8081 8082; do
  pids=$(lsof -tiTCP:"${port}" -sTCP:LISTEN 2>/dev/null || true)
  if [[ -n "${pids}" ]]; then
    echo "Killing PID(s) on port ${port}: ${pids}"
    kill -9 ${pids} || true
  fi
done

echo "Done (nothing listening on 8081/8082 is OK)."
