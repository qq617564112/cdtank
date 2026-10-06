"""Prepare original05427 c9 resources outside the production asset pipeline."""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'recovery'))
from export_effect_models import export_models

output = ROOT / 'recovery/prepared/scene-breach02-05427-assets'
output.mkdir(parents=True, exist_ok=True)
library = export_models([{'reference': 'Data/scnobj/obj05427/c9.CVD'}],
                        ROOT / 'recovery/output/verified/assets/data', output)
(output / 'scene-breach-0002-05427.json').write_text(json.dumps(library) + '\n')
print([(resource['reference'], len(resource['nodes'])) for resource in library['resources']])
