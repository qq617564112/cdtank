"""Summarize ordinary HP-observer Benefit text evidence; pixels require review."""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
raw_path = Path(sys.argv[1])
raw = json.loads(raw_path.read_text())
process_path = ROOT / 'recovery/output/tank-benefit-text-process-cleanup.json'
process = json.loads(process_path.read_text()) if process_path.exists() else None
target_id = raw.get('healingInput', {}).get('actorId')
gaps = list(raw.get('failures', []))
if raw.get('status') != 'PASS_FINITE_ACTOR_BENEFIT_TEXT_NORMAL_LEAVE':
    gaps.append('Ordinary Benefit run did not pass its finite scope')
if raw.get('error'):
    gaps.append(raw['error'])
sides = []
for index, observed in enumerate(raw.get('observed', [])):
    calls = observed.get('benefitCalls', [])
    shows = observed.get('shows', [])
    draws = observed.get('draws', [])
    records = observed.get('records', [])
    expirations = observed.get('expirations', [])
    captures = observed.get('captures', {})
    hp_link = len(calls) == 1 and all(
        call.get('targetId') == target_id and
        call.get('hp', {}).get('cachedHP') not in (None, 0) and
        call['hp']['currentHP'] > call['hp']['cachedHP'] and
        call['increase'] == call['hp']['currentHP'] - call['hp']['cachedHP'] and
        call['hp']['isLocal'] == call['isLocal'] for call in calls)
    show_link = len(shows) == 1 and all(
        show.get('targetId') == target_id and show.get('isLocal') == (index == 1) and
        any(call['increase'] == show['increase'] and call['hp'] == show.get('hp')
            for call in calls) for show in shows)
    digits = sorted({draw.get('codepoint') for draw in draws})
    original_digits = bool(draws) and all(
        draw.get('targetId') == target_id and draw.get('text') == '+' + str(draw['increase']) and
        draw.get('isLocal') == (index == 1) and
        48 <= draw.get('codepoint', 0) <= 57 and
        draw.get('asset', '').startswith('ui/regions/9/') for draw in draws)
    motion = bool(records) and all(
        record['x'] == record['showX'] and
        abs(record['y'] - (record['showY'] - (100 if record['isLocal'] else 0) -
                           record['elapsed'] * 40)) < .01 for record in records)
    expiry = bool(expirations) and all(
        row['elapsedBefore'] + row['delta'] >= 1 for row in expirations)
    if not all((hp_link, show_link, original_digits, motion, expiry)):
        gaps.append(f'side{index}: HP/text/digit/motion/expiry evidence incomplete')
    paths = [capture.get('path') for capture in captures.values()]
    if not paths or not all(path and (ROOT / path).is_file() for path in paths):
        gaps.append(f'side{index}: callback canvas files incomplete')
    sides.append({'side': index, 'hpObserverCalls': calls, 'shows': shows,
                  'sameActorSnapshotQualification': hp_link,
                  'enqueueOwnership': show_link, 'originalBenefitDigits': original_digits,
                  'drawSubmissions': len(draws), 'drawnCodepoints': digits,
                  'textIdentity': sorted({draw.get('text', '') for draw in draws}),
                  'capturedPositionUpwardMotion': motion, 'naturalExpiry': expiry,
                  'expirations': expirations, 'releases': observed.get('releases', []),
                  'captures': captures})
if len(sides) != 2:
    gaps.append('Dual Benefit presentation evidence incomplete')
before = next((row for row in raw.get('feedBefore', []) if row.get('instanceId') == 77), {})
after = next((row for row in raw.get('feedAfter', []) if row.get('instanceId') == 77), {})
if before.get('ownedQuantity') != 1 or after.get('ownedQuantity') != 0:
    gaps.append('Normal equipped feed quantity 1 to 0 not confirmed')
cleanup = raw.get('cleanup', [])
if len(cleanup) != 2 or any(row.get('world') is not None or
                          any(row.get(field) != 0 for field in (
                              'textMeshes', 'textMaterials', 'textTextures')) for row in cleanup):
    gaps.append('Dual normal Leave and text resource cleanup incomplete')
if not process or process.get('status') != 'PASS' or not process.get('removed'):
    gaps.append('Process cleanup evidence incomplete')
wrapper_path = ROOT / 'recovery/output/tank-benefit-text-actual.json'
existing = json.loads(wrapper_path.read_text()) if wrapper_path.exists() else {}
wrapper = {'status': 'PASS_FINITE_HP_OBSERVER_BENEFIT_TEXT_DUAL_LEAVE' if not gaps else
           'PARTIAL_HP_OBSERVER_BENEFIT_TEXT_SCOPE',
           'raw': str(raw_path), 'rawStatus': raw.get('status'), 'targetId': target_id,
           'source': 'recovery/output/actor-benefit-text-source.json',
           'module': 'recovery/output/tank-benefit-text-prepared.json',
           'sides': sides, 'feedFixture': raw.get('feedFixture'),
           'feedBefore': before, 'feedAfter': after,
           'normalLeave': cleanup, 'process': process, 'gaps': list(dict.fromkeys(gaps)),
           'scope': 'Ordinary injury and native equipped-feed treatment; same-actor snapshot HP '
                    'increase from nonzero cache, original Benefit digit draws, signed positive '
                    'logical text with unmapped plus, upward movement, natural expiry and dual '
                    'Leave. Callback pixels require main review. First/death/revival/round cache '
                    'branches remain integration-test/code scope; feed acquisition is a fixture.'}
for key in ('mainReview', 'engineering'):
    if key in existing:
        wrapper[key] = existing[key]
wrapper_path.write_text(json.dumps(wrapper, ensure_ascii=False, indent=2) + '\n')
print(wrapper['status'])
