"""Source UI images whose presentation is owned by HTML and CSS."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def html_ui_sources():
    sources = set()
    for name in ('simple-ui-artwork.json', 'button-artwork.json'):
        sources.update(json.loads((ROOT / 'apps/web/src/assets' / name).read_text())['assets'])
    return sources
