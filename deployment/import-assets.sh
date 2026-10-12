#!/usr/bin/env bash
set -euo pipefail

workspace=$(cd -- "$(dirname -- "$0")/.." && pwd)
install -D -m 0644 \
  "$workspace/deployment/assets/ui/fonts/xiangjiao-brush.ttf" \
  "$workspace/apps/web/public/assets/ui/fonts/xiangjiao-brush.ttf"
install -D -m 0644 \
  "$workspace/deployment/assets/ui/fonts/Silkscreen-Regular.ttf" \
  "$workspace/apps/web/public/assets/ui/fonts/Silkscreen-Regular.ttf"
tar -C "$workspace" --exclude='*.tmp' -cf - \
  apps/web/public apps/server/resources \
  | docker import - cdtank-assets:1.0.0-runtime-directories
