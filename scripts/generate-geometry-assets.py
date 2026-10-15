#!/usr/bin/env python3
"""Precompute geometry in encoded models and republish packed CVD libraries."""

import argparse
import os
from pathlib import Path

from asset_compression.cvd import publish_model_libraries
from asset_compression.geometry import preprocess_geometry

REPOSITORY = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--compressed', type=Path, default=REPOSITORY / 'art/compressed')
    parser.add_argument('--compressed-mobile', type=Path, default=REPOSITORY / 'art/compressed-mobile')
    parser.add_argument('--output', type=Path,
        default=REPOSITORY / os.environ.get('CDTANK_WEB_ASSETS', 'apps/web/public'))
    args = parser.parse_args()
    for root in (args.compressed, args.compressed_mobile):
        preprocess_geometry(root)
    publish_model_libraries(args.output)


if __name__ == '__main__':
    main()
