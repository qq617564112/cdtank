"""Execute complete3aac envelope reader and original bitstream data copy."""
import itertools
import json
from pathlib import Path
import struct
import sys
from unicorn.x86_const import UC_X86_REG_EAX,UC_X86_REG_ECX,UC_X86_REG_EIP,UC_X86_REG_ESP
ROOT=Path(__file__).resolve().parents[3];sys.path.insert(0,str(ROOT/'recovery'))
from effect_native import map_original_binaries
uc,_=map_original_binaries([ROOT/'CDTank/CDTank.exe']);uc.mem_map(0x2000000,0x20000)
MESSAGE,STREAM,BUFFER,STACK,RETURN=[0x2001000+i*0x3000 for i in range(5)]
def write(address,*values):uc.mem_write(address,struct.pack('<'+'I'*len(values),*values))
def read(address):return struct.unpack('<I',uc.mem_read(address,4))[0]
profiles=json.loads((ROOT/'recovery/output/role-profile-update-native.json').read_text())['readers']
rows=[]
for alignment,payload,code,result in itertools.product(range(8),[b'',b'\x01',bytes(profiles[0]['raw']),bytes(profiles[8]['raw'])],[0,1,3,255],[0,1,255]):
 packed=len(payload)<<alignment;cursor=alignment+32
 for value in payload:packed|=value<<cursor;cursor+=8
 packed|=code<<cursor;cursor+=8;packed|=result<<cursor;cursor+=8
 raw=packed.to_bytes((cursor+7)//8,'little')
 uc.mem_write(MESSAGE,b'\xaa'*0x1018);uc.mem_write(BUFFER,raw+bytes(4096-len(raw)))
 write(STREAM,alignment,0,BUFFER,4096);write(STACK,RETURN,STREAM)
 uc.reg_write(UC_X86_REG_ESP,STACK);uc.reg_write(UC_X86_REG_ECX,MESSAGE)
 uc.emu_start(0x42da6a,RETURN,count=20000)
 assert uc.reg_read(UC_X86_REG_EIP)==RETURN and uc.reg_read(UC_X86_REG_ESP)==STACK+8
 assert read(MESSAGE+0x100c)==len(payload) and read(MESSAGE+0x1010)==code and read(MESSAGE+0x1014)==result
 assert bytes(uc.mem_read(MESSAGE+0xc,len(payload)))==payload
 assert bytes(uc.mem_read(MESSAGE+0xc+len(payload),4096-len(payload)))==b'\xaa'*(4096-len(payload))
 assert read(STREAM)+read(STREAM+4)*8==cursor
 rows.append(dict(alignment=alignment,raw=list(raw),profileBytes=list(payload),code=code,result=result,endBit=cursor))
(ROOT/'recovery/output/role-profile-update-wire-native.json').write_text(json.dumps(dict(status='PASS',rows=rows,scope='Complete42da6a ->42d6cd and actual401d58 bitstream reader. Valid byte count below4096 transport capacity, including zero; no replaced execution boundaries. This is payload framing, not UI acceptance or server-selected mutation.'),indent=2)+'\n')
print(f'PASS: {len(rows)} complete3aac envelope readers with original length, payload and byte fields')
