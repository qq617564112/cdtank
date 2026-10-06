"""Publish original patch insertion and VFS mode instruction sources."""
import json
from pathlib import Path
import capstone
import pefile

ROOT = Path(__file__).resolve().parents[1]
SOURCES = {
    'CDTank.exe': [('archiveExistenceCheck', 0x41d6e3, 0x41d74a),
                   ('globalVfsSelection', 0x4170fa, 0x41711e)],
    'CPKUpdate.exe': [('patchInsertCall', 0x426004, 0x426070),
                      ('insertFileWrapper', 0x42bc00, 0x42bcbe),
                      ('filterDispatch', 0x435630, 0x4357d3)],
    'gbengine.dll': [('openFile', 0x10035810, 0x100359e5),
                     ('initializeFileMode', 0x10036380, 0x100365a0)],
}


def export():
    decoder = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
    result = {'scope': 'Original instruction sources, not a recovered download decoder or application-wide lookup priority.',
              'sources': [], 'downloadCandidates': []}
    for name, ranges in SOURCES.items():
        pe = pefile.PE(str(ROOT / 'CDTank' / name))
        base = pe.OPTIONAL_HEADER.ImageBase
        for label, start, end in ranges:
            rows = [{'address': hex(row.address), 'bytes': row.bytes.hex(),
                     'instruction': f'{row.mnemonic} {row.op_str}'}
                    for row in decoder.disasm(pe.get_data(start - base, end - start), start)]
            result['sources'].append(dict(file=name, name=label, start=hex(start), end=hex(end), instructions=rows))
    for path in sorted((ROOT / 'CDTank/download').rglob('*')):
        if path.is_file():
            data = path.read_bytes()
            result['downloadCandidates'].append(dict(path=path.relative_to(ROOT / 'CDTank/download').as_posix(),
                bytes=len(data), prefix=data[:16].hex(), status='undecoded'))
    return result


if __name__ == '__main__':
    result = export()
    (ROOT / 'recovery/output/patch-source-evidence.json').write_text(json.dumps(result, indent=2) + '\n')
    print(f"Published {len(result['sources'])} original code ranges and {len(result['downloadCandidates'])} unresolved download candidates")
