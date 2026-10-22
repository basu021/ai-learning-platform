#!/bin/sh
# Renders img/*.svg to PNG with the Playwright image (chromium).
D=$(cd "$(dirname "$0")" && pwd)
docker run --rm --network none -v "$D":/work mcr.microsoft.com/playwright:v1.47.0-jammy sh -c '
  [ -d /work/.pw/node_modules/playwright ] || { echo "need playwright module"; exit 1; }
  cp /work/render.mjs /work/.pw/render.mjs && cd /work/.pw && node render.mjs /work/img '"$1"
