#!/bin/bash
set -e

echo "[post-merge] Installing root dependencies..."
npm install --legacy-peer-deps

echo "[post-merge] Installing server dependencies..."
cd server && npm install --legacy-peer-deps && cd ..

echo "[post-merge] Rebuilding Tailwind CSS..."
node scripts/build-css.mjs

echo "[post-merge] Done."
