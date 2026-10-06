"""Summarize the new ordinary actor-text run without inferring pixel visibility."""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
raw_path = Path(sys.argv[1])
raw = json.loads(raw_path.read_text())
process_path = ROOT / 'recovery/output/tank-damage-text-process-cleanup.json'
process = json.loads(process_path.read_text()) if process_path.exists() else None
target_id = raw['initial'][1]['playerId'] if len(raw.get('initial', [])) == 2 else None
gaps = list(raw.get('failures', []))
if raw.get('error'):
    gaps.append(raw['error'])
sides = []
for index, observed in enumerate(raw.get('observed', [])):
    events = [event for event in observed.get('events', [])
              if event.get('targetId') == target_id and event.get('value', 0) > 0]
    shows = [show for show in observed.get('shows', []) if show.get('targetId') == target_id]
    records = [record for record in observed.get('records', []) if record.get('targetId') == target_id]
    draws = [draw for draw in observed.get('draws', []) if draw.get('targetId') == target_id]
    expirations = observed.get('expirations', [])
    captures = observed.get('captures', {})
    actual_digits = sorted({draw['codepoint'] for draw in draws})
    linked = bool(events and shows) and all(
        any(show['damage'] == event['value'] for show in shows) for event in events)
    signed = bool(draws) and all(draw.get('text') == str(-int(draw['damage'])) for draw in draws)
    local = bool(shows) and all(show.get('isLocal') == (index == 1) for show in shows)
    captured_position = bool(records) and all(
        record['x'] == record['showX'] and
        abs(record['y'] - (record['showY'] - (100 if record['isLocal'] else 0) +
                           record['elapsed'] * 40)) < .01 for record in records)
    natural_expiry = bool(expirations) and all(
        expiry['elapsedBefore'] + expiry['delta'] >= 1 for expiry in expirations)
    if not all((linked, signed, local, captured_position, natural_expiry)):
        gaps.append(f'side{index}: incomplete formal event/text/position/expiry evidence')
    if not actual_digits or any(code < 48 or code > 57 for code in actual_digits):
        gaps.append(f'side{index}: incomplete original digit-only mesh evidence')
    paths = [capture.get('path') for capture in captures.values()]
    if not paths or not all(path and (ROOT / path).is_file() for path in paths):
        gaps.append(f'side{index}: callback canvas files missing')
    sides.append({'side': index, 'events': events, 'shows': shows,
                  'drawSubmissions': len(draws), 'drawnCodepoints': actual_digits,
                  'textIdentity': sorted({draw.get('text', '') for draw in draws}),
                  'formalLink': linked, 'signedText': signed, 'localIdentity': local,
                  'capturedScreenPositionAndMotion': captured_position,
                  'oneSecondNaturalExpiry': natural_expiry, 'expirations': expirations,
                  'captures': captures, 'releases': observed.get('releases', [])})
cleanup = raw.get('cleanup', [])
if len(cleanup) != 2 or any(row.get('world') is not None or
                          any(row.get(field) != 0 for field in (
                              'textMeshes', 'textMaterials', 'textTextures')) for row in cleanup):
    gaps.append('Dual normal Leave and text resource cleanup incomplete')
if len(sides) != 2:
    gaps.append('Dual actor-text scope incomplete')
elif sides[0]['events'] != sides[1]['events']:
    gaps.append('Dual formal hit transactions differ')
if not process or process.get('status') != 'PASS' or not process.get('removed'):
    gaps.append('Process cleanup evidence incomplete')
gaps = list(dict.fromkeys(gaps))
wrapper_path = ROOT / 'recovery/output/tank-damage-text-actual.json'
existing = json.loads(wrapper_path.read_text()) if wrapper_path.exists() else {}
wrapper = {
    'status': 'PASS_FINITE_ACTOR_TEXT_EVENT_DRAW_EXPIRY_DUAL_LEAVE' if not gaps else 'PARTIAL_ACTOR_TEXT_SCOPE',
    'raw': str(raw_path), 'rawStatus': raw.get('status'), 'targetId': target_id,
    'source': 'recovery/output/actor-damage-text-source.json',
    'module': 'recovery/output/tank-damage-text-consumer.json',
    'sides': sides, 'normalLeave': cleanup, 'process': process,
    'gaps': gaps,
    'scope': 'Ordinary accepted hit and actor-owned original Damage digit draw, signed logical text, local Y offset, captured position, natural expiry and dual normal Leave. Whole callback canvases require main review for visible pixel acceptance; no original GPU equivalence, critical/healing, old2001 effects/audio or full parent completion.',
}
for key in ('mainReview', 'engineering'):
    if key in existing:
        wrapper[key] = existing[key]
wrapper_path.write_text(json.dumps(wrapper, ensure_ascii=False, indent=2) + '\n')
print(wrapper['status'])
