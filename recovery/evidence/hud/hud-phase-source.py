"""Locate original HUD/root bindings and their direct visibility imports."""
import json
from pathlib import Path
import struct
import capstone
import pefile

ROOT = Path(__file__).resolve().parents[3]
pe = pefile.PE(str(ROOT / 'CDTank/CDTank.exe'))
base = pe.OPTIONAL_HEADER.ImageBase
image = pe.get_memory_mapped_image()
md = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
md.detail = True
md.skipdata = True
names = ['GameMain/picBattleInfoPanel', 'GameMain/edtBattleInfo', r'data\ui\layouts\game_main.xml', r'data\ui\layouts\room_main.xml', 'GameMain/', 'RoomPanel/']
strings = []
for name in names:
    value = name.encode() + b'\0'
    start = 0
    while (offset := image.find(value, start)) >= 0:
        strings.append({'text': name, 'address': hex(base + offset)})
        start = offset + 1
addresses = {int(row['address'], 16): row['text'] for row in strings}
imports = []
for entry in pe.DIRECTORY_ENTRY_IMPORT:
    for symbol in entry.imports:
        if symbol.name and any(word in symbol.name for word in [b'setVisible', b'setGUISheet', b'@show@', b'@hide@', b'getWindow@', b'loadWindowLayout']):
            imports.append({'address': hex(symbol.address), 'name': symbol.name.decode(), 'dll': entry.dll.decode()})
text = next(section for section in pe.sections if section.Name.startswith(b'.text'))
xrefs = []
for instruction in md.disasm(text.get_data(), base + text.VirtualAddress):
    if instruction.id == 0:
        continue
    for operand in instruction.operands:
        if operand.type == capstone.x86.X86_OP_IMM and operand.imm in addresses:
            xrefs.append({'address': hex(instruction.address), 'text': addresses[operand.imm], 'instruction': f'{instruction.mnemonic} {instruction.op_str}'})
ranges = []
for start, end in [(0x4c776d, 0x4c77ac), (0x50a163, 0x50a1a2), (0x4c7ae3, 0x4c7b68), (0x4d6216, 0x4d6293), (0x4d23d8, 0x4d2406), (0x50f5c0, 0x50f5f9), (0x4ccac7, 0x4ccb0c), (0x4d0412, 0x4d042c)]:
    ranges.append({'start': hex(start), 'end': hex(end), 'instructions': [f'{i.address:08x} {i.mnemonic} {i.op_str}' for i in md.disasm(image[start-base:end-base], start)]})
result = {'status': 'LOCATED', 'binary': 'CDTank/CDTank.exe', 'strings': strings, 'imports': imports, 'xrefs': xrefs, 'ranges': ranges}
(ROOT / 'recovery/output/hud-phase-source-locations.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps({'strings': strings, 'imports': imports, 'xrefs': xrefs}, indent=2))
