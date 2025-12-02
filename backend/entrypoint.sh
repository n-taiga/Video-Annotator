#!/usr/bin/env bash
set -e

echo "[INFO] Checking SAM 2 checkpoints..."
bash /app/checkpoints/download_ckpts.sh

echo "[INFO] Starting backend server..."
exec uvicorn main:app --host 0.0.0.0 --port "${PORT:-8000}"