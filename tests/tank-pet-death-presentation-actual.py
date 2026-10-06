"""Summarize the ordinary dog120 death sprite run without inferring pixels."""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
raw_path = Path(sys.argv[1])
raw = json.loads(raw_path.read_text())
target_id = raw.get('initial', [{}, {}])[1].get('playerId')
gaps = list(raw.get('failures', []))
if raw.get('status') != 'PASS_FINITE_PET_DEATH_SPRITE_NORMAL_LEAVE':
    gaps.append('Ordinary pet death run did not pass')
if raw.get('error'):
    gaps.append(raw['error'])
sides = []
for index, observed in enumerate(raw.get('observed', [])):
    shows = [row for row in observed.get('shows', []) if row.get('id') == target_id]
    effects = [row for row in observed.get('effects', []) if row.get('id') == target_id]
    events = [row for row in observed.get('events', [])
              if row.get('type') == 'destroy' and row.get('targetId') == target_id]
    qualified = len(shows) == 1 and all(
        row.get('petType') == 2 and row.get('isLocal') == (index == 1) and
        row.get('snapshot', {}).get('petId') == 1 and
        row['snapshot'].get('previousLife') is True and
        row['snapshot'].get('alive') is False for row in shows)
    owned = len(effects) == 1 and all(
        row.get('handle', 0) > 0 and row.get('effectId') == 120 and
        row.get('tag') == 0 and row.get('oneShot') is True and
        row.get('liveParent') is True and row.get('owner') == 'player-' + str(target_id)
        for row in effects)
    draws = [draw for effect in effects for draw in effect.get('draws', [])]
    original_draw = bool(draws) and all(
        draw.get('node') == 3031 and
        any(texture.endswith('/Data/effect/xy/dogd.png')
            for texture in draw.get('textures', []) if texture) for draw in draws)
    silent_tree = bool(effects) and all(
        not any(node['type'] == 4 for node in effect.get('nodes', [])) for effect in effects)
    expired = bool(effects) and all(effect.get('expired') for effect in effects)
    captures = observed.get('captures', {})
    if not all((qualified, owned, original_draw, silent_tree, expired, bool(events))):
        gaps.append(f'side{index}: classification/owner/draw/silence/expiry/event incomplete')
    if not captures or not all(capture.get('path') and (ROOT / capture['path']).is_file()
                               for capture in captures.values()):
        gaps.append(f'side{index}: callback canvas files incomplete')
    sides.append({'side': index, 'shows': shows, 'deathEvents': events,
                  'sameActorPetTypeAndDeathTransition': qualified,
                  'liveCenterAndLocalOwnership': owned, 'drawSubmissions': len(draws),
                  'originalDogSpriteDraw': original_draw, 'silentTree': silent_tree,
                  'naturalExpiry': expired, 'effects': effects, 'captures': captures})
cleanup = raw.get('cleanup', [])
if len(sides) != 2 or len(cleanup) != 2 or any(
        row.get('world') is not None or any(row.get(key) != 0 for key in
            ('effects', 'petEffects', 'petMeshes', 'voices', 'skillVoices')) for row in cleanup):
    gaps.append('Dual normal Leave and resource cleanup incomplete')
process_path = ROOT / 'recovery/output/tank-pet-death-presentation-process-cleanup.json'
process = json.loads(process_path.read_text()) if process_path.is_file() else None
if not process or process.get('status') != 'PASS' or not process.get('removed'):
    gaps.append('Process cleanup incomplete')
output = ROOT / 'recovery/output/tank-pet-death-presentation-actual.json'
existing = json.loads(output.read_text()) if output.exists() else {}
wrapper = {'status': 'PASS_FINITE_ORDINARY_PET_DEATH_DOG120_DUAL_LEAVE' if not gaps else
           'PARTIAL_ORDINARY_PET_DEATH_DOG120_SCOPE',
           'raw': str(raw_path), 'rawStatus': raw.get('status'), 'targetId': target_id,
           'source': 'recovery/output/pet-death-presentation-source.json',
           'module': 'recovery/output/tank-pet-death-presentation-prepared.json',
           'sides': sides, 'normalLeave': cleanup, 'process': process,
           'gaps': list(dict.fromkeys(gaps)),
           'scope': 'Ordinary natural death, original PetTable1/PetType2 dog120 once on the same '
                    'actor death transition, actual3031/dogd draw, source silent tree, natural expiry '
                    'and dual normal Leave. Whole canvas visibility requires main review. '
                    'Cat119 is source/module only. Existing09/HP/respawn/audio proofs are reused; '
                    'no new original GPU or full parent completion claim.'}
for key in ('mainReview', 'engineering'):
    if key in existing:
        wrapper[key] = existing[key]
output.write_text(json.dumps(wrapper, ensure_ascii=False, indent=2) + '\n')
print(wrapper['status'])
