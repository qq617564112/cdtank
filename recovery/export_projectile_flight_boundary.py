"""Export ordinary Shot actor completion and distinct sound terminal sources."""
import json
from pathlib import Path
import capstone
import pefile

ROOT = Path(__file__).resolve().parents[1]
RANGES = [
    ('actorCompletion', 0x4647df, 0x4647fe),
    ('actorObserverDestruction', 0x4683a8, 0x4683fb),
    ('actorObserverInitialization', 0x4686e6, 0x4686ec),
    ('roleObserverSetter', 0x431d5c, 0x431d90),
    ('otherEffectFloat', 0x47657a, 0x4765aa),
    ('interfaceControlLookup', 0x4a98a0, 0x4a98da),
    ('interfaceControlAssignment', 0x4be279, 0x4be2bf),
    ('positionSoundWrapper', 0x485b1b, 0x485bf0),
]
pe = pefile.PE(str(ROOT / 'CDTank/CDTank.exe'))
decoder = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
result = {'scope': 'Static source boundaries; no nonzero actor observer binder or independent flying entity identified. Direct-offset candidates do not establish absence of indirect binding.', 'sources': []}
for name, start, end in RANGES:
    rows = [{'address': hex(row.address), 'bytes': row.bytes.hex(),
             'instruction': f'{row.mnemonic} {row.op_str}'}
            for row in decoder.disasm(pe.get_data(start - pe.OPTIONAL_HEADER.ImageBase, end - start), start)]
    result['sources'].append(dict(name=name, start=hex(start), end=hex(end), instructions=rows))
(ROOT / 'recovery/output/projectile-flight-boundary-source.json').write_text(json.dumps(result, indent=2) + '\n')
print(f"Published {len(result['sources'])} original boundary ranges")
