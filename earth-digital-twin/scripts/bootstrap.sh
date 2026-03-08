#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "[1/5] Checking Node.js and npm..."
if ! command -v node >/dev/null 2>&1; then
  echo "Error: node is not installed. Install Node.js 20+ and re-run."
  exit 1
fi
if ! command -v npm >/dev/null 2>&1; then
  echo "Error: npm is not installed. Install npm and re-run."
  exit 1
fi

echo "Node: $(node -v)"
echo "npm:  $(npm -v)"

echo "[2/5] Ensuring npm registry is set to the public npm registry..."
npm config set registry https://registry.npmjs.org/

echo "[3/5] Installing dependencies..."
npm install

echo "[4/5] Creating .env from template if missing..."
if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Created .env. Add VITE_CESIUM_ION_TOKEN for terrain + OSM buildings."
else
  echo ".env already exists; leaving it unchanged."
fi

echo "[5/5] Verifying build..."
npm run build

echo "Done. Start the app with: npm run dev"
