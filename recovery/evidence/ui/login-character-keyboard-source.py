"""Record original Login character keyboard mounting and character callbacks."""
import json
from pathlib import Path
import capstone
import pefile
ROOT=Path(__file__).resolve().parents[3]
pe=pefile.PE(str(ROOT/'CDTank/CDTank.exe'));base=pe.OPTIONAL_HEADER.ImageBase
cs=capstone.Cs(capstone.CS_ARCH_X86,capstone.CS_MODE_32)
imports={e.address:e.name.decode('ascii') for m in pe.DIRECTORY_ENTRY_IMPORT for e in m.imports if e.name}
def raw(a,z):return list(cs.disasm(pe.get_data(a-base,z-a),a))
def trace(a,z):return [{'va':hex(i.address),'asm':i.mnemonic+' '+i.op_str} for i in raw(a,z)]
def string(a):return pe.get_data(a-base,120).split(b'\0')[0].decode('ascii')
init=raw(0x4c17bc,0x4c301f);members={};current=None
for i in init:
 if i.mnemonic=='push' and i.op_str.startswith('0x5c'):
  try:current=string(int(i.op_str,16))
  except UnicodeDecodeError:current=None
 if i.mnemonic=='mov' and i.op_str.endswith(', eax') and '[ecx + ' in i.op_str and current:
  offset=int(i.op_str.split('[ecx + ')[1].split(']')[0],16)
  if 0x50<=offset<=0x110:members[hex(offset)]=current
handler=raw(0x4c0001,0x4c08c8);keys=[]
for n,i in enumerate(handler):
 if i.mnemonic=='cmp' and 'eax, dword ptr [esi + ' in i.op_str:
  offset=int(i.op_str.split('[esi + ')[1].split(']')[0],16)
  values=[]
  for nxt in handler[n+1:]:
   if nxt.mnemonic=='cmp' and 'eax, dword ptr [esi + ' in nxt.op_str:break
   if nxt.mnemonic=='push' and nxt.op_str.startswith('0x'):
    value=int(nxt.op_str,16)
    if value<=127:values.append(value)
  keys.append({'ownerMember':hex(offset),'control':members.get(hex(offset)),'differentShiftCaps':chr(values[0]) if values else None,'equalShiftCaps':chr(values[1]) if len(values)>1 else None})
assert len(keys)==47,len(keys)
assert 'injectChar' in imports[0x5c0388]
assert 'activate' in imports[0x5c0244]
assert 'setSelected' in imports[0x5c00c8]
assert any(i.address==0x4c6e98 and i.op_str=='dword ptr [ebp - 0x18], 0x2f' for i in raw(0x4c6df4,0x4c6f00))
layout=json.loads((ROOT/'recovery/output/web-assets/ui.json').read_text())
layout=next(l for l in layout['layouts'] if l['path'].endswith('/keyboard.xml'))
result={'status':'SOURCE_CHARACTER_CALLBACK_AND_PASSWORD_ACTIVATION_MOUNT_CONFIRMED','layout':layout,'layoutString':string(0x5cf878),'loginKeyboardMember':'owner+0x4c','passwordInputMember':'owner+0x24','shiftMember':'owner+0x10c','capsMember':'owner+0x110','controls':members,'characters':keys,'initialization':trace(0x4c17bc,0x4c18c6),'subscriptions':trace(0x4c6d56,0x4c6f00),'characterCallback':trace(0x4c0001,0x4c08c8),'passwordActivationCallback':trace(0x4c3197,0x4c31de),'imports':{hex(a):imports[a] for a in [0x5c0388,0x5c0394,0x5c0244,0x5c00c8,0x5c0220,0x5c024c,0x5c01d0]},'behavior':'47 clicks activate password input, select character using differing Shift/Caps state, injectChar and reset Shift false. Password activation conditionally attaches keyboard as Login child.','missing':['Formal Login mount and authenticated login/channel contract'],'mountModeSource':{'owner':'634ee8 string','comparison':trace(0x4070e2,0x407104),'compareHelper':trace(0x4037f3,0x40385b),'modeAssignment':trace(0x41a605,0x41a655),'QQModeInput':string(0x5c21a4),'QQStoredString':string(0x5c1fbc),'condition':'Keyboard attaches when mode string comparison with Q is nonzero; QQ mode assigns Q and suppresses attachment.'},'productionChanged':False,'runtimeClaim':False}
(ROOT/'recovery/output/login-character-keyboard-source.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(result['status'],len(keys),len(layout['windows']))
