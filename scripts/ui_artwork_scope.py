"""Source button images rendered with unlettered PNGs and live captions."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def html_ui_sources():
    assets = json.loads((ROOT / 'apps/web/src/assets/button-artwork.json').read_text())['assets']
    return {source for source, entry in assets.items() if entry['background']}
