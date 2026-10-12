"""Preserve engine effect calls and native quad expansion evidence."""
from hashlib import sha256
from pathlib import Path

import capstone
import pefile


def export_engine(path):
    pe = pefile.PE(str(path))
    base = pe.OPTIONAL_HEADER.ImageBase
    if base != 0x10000000:
        raise ValueError('unexpected original gbengine image base')
    decoder = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
    ranges = [
        ('effectBegin', 0x10026400, 0x10026419),
        ('effectEndPass', 0x10026420, 0x1002642D),
        ('effectEnd', 0x10026430, 0x10026444),
        ('effectApply', 0x10026450, 0x100264A4),
        ('effectBeginPass', 0x10026890, 0x100268C4),
        ('effectCompile', 0x100266C0, 0x10026750),
        ('effectCreate', 0x10027070, 0x10027138),
        ('renderGeomQuad', 0x100258A0, 0x10025AE7),
    ]
    evidence = {name: [{'va': hex(i.address), 'bytes': i.bytes.hex(),
                       'instruction': f'{i.mnemonic} {i.op_str}'}
                      for i in decoder.disasm(pe.get_data(start - base, end - start), start)]
                for name, start, end in ranges}
    exports = {s.name.decode(): hex(base + s.address)
               for s in pe.DIRECTORY_ENTRY_EXPORT.symbols if s.name and any(
                   name in s.name for name in [b'gbRenderEffect', b'NewRenderEffect', b'RenderGeomQuad@'])}
    imports = {hex(s.address): {'dll': d.dll.decode(), 'name': s.name.decode()}
               for d in pe.DIRECTORY_ENTRY_IMPORT for s in d.imports
               if s.name == b'D3DXCreateEffect'}
    return {'source': 'CDTank/gbengine.dll', 'sourceSha256': sha256(Path(path).read_bytes()).hexdigest(),
            'imageBase': hex(base), 'exports': exports, 'imports': imports,
            'evidence': evidence, 'implicitStatesResolved': False}
