#!/usr/bin/env bash
set -euo pipefail

workspace=$(cd -- "$(dirname -- "$0")/.." && pwd)
install -D -m 0644 \
  "$workspace/deployment/assets/ui/fonts/xiangjiao-brush.ttf" \
  "$workspace/recovery/output/web-assets/ui/fonts/xiangjiao-brush.ttf"
tar -C "$workspace" --exclude='*.tmp' -cf - \
  recovery/output/web-assets recovery/output/verified/tables \
  | docker import - cdtank-assets:1.0.0-20261008-original
