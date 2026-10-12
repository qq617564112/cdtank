"""Read original chat controls and their bounded native input initialization."""
import json
from pathlib import Path
import xml.etree.ElementTree as ET
import pefile
from capstone import Cs, CS_ARCH_X86, CS_MODE_32

ROOT = Path(__file__).resolve().parents[3]
LAYOUTS = ROOT / 'recovery/output/verified/assets/data/Data/ui/layouts'
pe = pefile.PE(str(ROOT / 'CDTank/CDTank.exe'))
base = pe.OPTIONAL_HEADER.ImageBase
mapped = pe.get_memory_mapped_image()
imports = {symbol.address: symbol.name.decode() for entry in pe.DIRECTORY_ENTRY_IMPORT
           for symbol in entry.imports if symbol.name}
windows = {}
for name in ['chat.xml', 'chat_channellist.xml', 'chat_channellist_lobby.xml',
             'game_main_chat_shrinked.xml', 'game_main_channellist.xml']:
    path = LAYOUTS / name
    lines = path.read_text().splitlines()
    windows[name] = [dict(name=w.attrib['Name'], type=w.attrib['Type'],
                         line=next(i + 1 for i, line in enumerate(lines)
                                   if '<Window' in line and 'Name="' + w.attrib['Name'] + '"' in line),
                         properties={p.attrib['Name']: p.attrib['Value']
                                     for p in w.findall('Property')
                                     if p.attrib['Name'] in ['AbsoluteRect', 'ID', 'MaxTextLength']})
                     for w in ET.parse(path).getroot().iter('Window')]

# These ranges begin on known instruction boundaries and stop after the setter.
disassembler = Cs(CS_ARCH_X86, CS_MODE_32)
setups = []
for name, string, start, end, setter in [
        ('room', 0x5cbe40, 0x49a5b4, 0x49a5fd, 0x49a5f5),
        ('battle', 0x5d0128, 0x4c9956, 0x4c99a1, 0x4c9999)]:
    offset = string - base
    control = mapped[offset:mapped.index(b'\0', offset)].decode()
    instructions = [dict(address=hex(i.address), instruction=f'{i.mnemonic} {i.op_str}')
                    for i in disassembler.disasm(mapped[start-base:end-base], start)]
    assert mapped[setter-base:setter-base+2] == b'\x6a\x48'
    assert mapped[setter-base+2:setter-base+8] == b'\xff\x15\x68\x02\x5c\x00'
    assert imports[0x5c0268] == '?setMaxTextLength@Editbox@CEGUI@@QAEXI@Z'
    setups.append(dict(scope=name, control=control, stringAddress=hex(string),
                       maxTextLength=72, setter=imports[0x5c0268], instructions=instructions))
output = ROOT / 'recovery/output/chat-channel-source.json'
output.write_text(json.dumps(dict(layouts=windows, inputInitialization=setups),
                                 ensure_ascii=False, indent=2) + '\n')
print(f'{sum(map(len, windows.values()))} controls; room/battle maxTextLength=72')
