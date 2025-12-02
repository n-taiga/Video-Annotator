#!/bin/bash
set -e

CKPT_DIR="/app/checkpoints"
mkdir -p "${CKPT_DIR}"
cd "${CKPT_DIR}"


# Use either wget or curl to download the checkpoints
if command -v wget &> /dev/null; then
    CMD="wget -nc"
elif command -v curl &> /dev/null; then
    CMD="curl -L -O --continue-at -"
else
    echo "ERROR: Please install wget or curl."
    exit 1
fi

# Define the URLs for SAM 2.1 checkpoints
BASE_URL="https://dl.fbaipublicfiles.com/segment_anything_2/092824"

declare -A CKPTS=(
  ["tiny"]="sam2.1_hiera_tiny.pt"
  ["small"]="sam2.1_hiera_small.pt"
  ["base_plus"]="sam2.1_hiera_base_plus.pt"
  ["large"]="sam2.1_hiera_large.pt"
)

TARGET="${CKPTS[$MODEL_SIZE]}"

if [ -z "$TARGET" ]; then
    echo "[ERROR] Unknown MODEL_SIZE: $MODEL_SIZE"
    echo "Valid values: tiny, small, base_plus, large"
    exit 1
fi

echo "[INFO] MODEL_SIZE=$MODEL_SIZE → downloading $TARGET"

URL="${BASE_URL}/${TARGET}"

if [ ! -f "${TARGET}" ]; then
    echo "[INFO] Downloading checkpoint: ${TARGET}"
    $CMD "${URL}"
else
    echo "[INFO] Checkpoint ${TARGET} already exists. Skipping download."
fi