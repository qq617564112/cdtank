"""Read the original LabPage load and Texture child attachment instructions."""
import json
from pathlib import Path
import xml.etree.ElementTree as ET
import pefile
from capstone import Cs, CS_ARCH_X86, CS_MODE_32

ROOT = Path(__file__).resolve().parents[3]
binary = (ROOT / 'CDTank/CDTank.exe').read_bytes()
pe = pefile.PE(data=binary)
base = pe.OPTIONAL_HEADER.ImageBase
disassembler = Cs(CS_ARCH_X86, CS_MODE_32)

def instructions(start, end):
    offset = pe.get_offset_from_rva(start - base)
    return [{'va': hex(i.address), 'asm': f'{i.mnemonic} {i.op_str}'}
            for i in disassembler.disasm(binary[offset:offset + end - start], start)]

def root_rect(name):
    root = ET.parse(ROOT / 'recovery/output/verified/assets/data/Data/ui/layouts' / name).getroot().find('Window')
    return {'name': root.get('Name'), 'properties': {p.get('Name'): p.get('Value') for p in root.findall('Property')
            if p.get('Name') in ('AbsoluteRect', 'MetricsMode')}}

imports = {hex(i.address): i.name.decode() for library in pe.DIRECTORY_ENTRY_IMPORT for i in library.imports
           if i.address in (0x5c0258, 0x5c024c, 0x5c0220, 0x5c0228)}
result = {
    'status': 'SOURCE_TEXTURE_CHILD_ATTACHMENT_TO_LABPAGE_TANK_ROOT',
    'task': 'UI59',
    'tankRootLoad': instructions(0x4b2faf, 0x4b3032),
    'textureRootLoad': instructions(0x4b3954, 0x4b3995),
    'textureModeAttachment': instructions(0x4b62b2, 0x4b6328),
    'imports': imports,
    'sameOwner': 'LabPage this saved at [ebp-10]; Tank root at this+8, Texture root at this+c0',
    'tankLayout': root_rect('shop_tankpage.xml'),
    'textureLayout': root_rect('shop_tankpage_texture.xml'),
    'consumer': 'TankShopTextureSourceRegions and texture sourceProps offsetX0/offsetY36',
    'conclusion': 'Original mode2 isChild/addChildWindow attaches Texture root to loaded Tank root. Tank root absolute left0/top36 supports current attachment offset0/36.',
    'limits': ['Source attachment identity only; original final framebuffer and complete page precision unverified',
               'Currency-image selection and original arrow callbacks remain unqualified'],
    'productionChanged': False, 'chromeStarted': False,
}
(ROOT / 'recovery/output/tank-shop-texture-parent-source.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print(result['status'])
