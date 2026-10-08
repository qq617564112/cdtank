#!/usr/bin/env bash
set -euo pipefail

workspace=$(cd -- "$(dirname -- "$0")/.." && pwd)
tar -C "$workspace" --exclude='*.tmp' -cf - \
  recovery/output/web-assets recovery/output/verified/tables \
  | docker import - cdtank-assets:1.0.0-20261008-ui
