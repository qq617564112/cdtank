"""Decode CPKUpdate transport files with the original whole-word XXTEA filter."""
from pathlib import Path
import json
import struct
import xml.etree.ElementTree as ET
import pefile

ROOT = Path(__file__).resolve().parents[1]
MASK = 0xffffffff
DELTA = 0x9e3779b9


def original_key(update_executable=None):
    pe = pefile.PE(str(update_executable or ROOT / 'CDTank/CPKUpdate.exe'))
    pointer = struct.unpack('<I', pe.get_data(0x47304c - 0x400000, 4))[0]
    return struct.unpack('<4I', pe.get_data(pointer - 0x400000, 16))


def decode_patch(raw, key=None):
    key = original_key() if key is None else key
    count = len(raw) // 4
    if count < 2:
        return raw
    words = list(struct.unpack('<' + 'I' * count, raw[:count * 4]))
    total = ((6 + 52 // count) * DELTA) & MASK
    y = words[0]
    while total:
        e = (total >> 2) & 3
        for p in range(count - 1, -1, -1):
            z = words[p - 1] if p else words[-1]
            mix = ((((z >> 5) ^ ((y << 2) & MASK)) +
                    ((y >> 3) ^ ((z << 4) & MASK))) & MASK) ^ \
                  (((total ^ y) + (key[(p & 3) ^ e] ^ z)) & MASK)
            words[p] = (words[p] - mix) & MASK
            y = words[p]
        total = (total - DELTA) & MASK
    return struct.pack('<' + 'I' * count, *words) + raw[count * 4:]


def export():
    target = ROOT / 'recovery/output/patch-sol-decoded'
    base = ROOT / 'recovery/output/verified/assets/data'
    rows = []
    key = original_key()
    for path in sorted((ROOT / 'CDTank/download').rglob('*')):
        if not path.is_file():
            continue
        relative = path.relative_to(ROOT / 'CDTank/download')
        raw = path.read_bytes()
        decoded = decode_patch(raw, key)
        destination = target / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(decoded)
        basis = base / relative
        row = dict(path=relative.as_posix(), bytes=len(raw), prefix=decoded[:16].hex(),
                   unchangedTailBytes=len(raw) % 4,
                   archiveComparison='identical' if basis.exists() and basis.read_bytes() == decoded else
                       'different' if basis.exists() else 'missing-base',
                   source='decoded-download-candidate')
        if path.suffix.lower() in ['.xml', '.imageset']:
            tree = ET.fromstring(decoded)
            row.update(xmlRoot=tree.tag, xmlElements=sum(1 for _ in tree.iter()))
        if path.suffix.lower() == '.dds':
            assert decoded[:4] == b'DDS '
            row.update(ddsHeight=struct.unpack_from('<I', decoded, 12)[0],
                       ddsWidth=struct.unpack_from('<I', decoded, 16)[0])
        rows.append(row)
    result = dict(keyWords=[hex(x) for x in key], decodeEntry='CPKUpdate.exe:0x438c50',
                  algorithmEntry='CPKUpdate.exe:0x43b330', candidates=rows,
                  sourceSelection='Decoded candidates are transport inputs; installed archive remains the observed global VFS source.')
    (ROOT / 'recovery/output/patch-sol-decoded.json').write_text(json.dumps(result, indent=2) + '\n')
    return result


if __name__ == '__main__':
    result = export()
    print(f"Decoded {len(result['candidates'])} candidates; "
          f"{sum('xmlRoot' in x for x in result['candidates'])} XML/imagesets parsed")
