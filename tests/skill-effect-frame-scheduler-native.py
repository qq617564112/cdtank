"""Execute continuous original 406154 clock decisions, Sleep and state writes."""
import json
from pathlib import Path
import struct
import sys
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX,UC_X86_REG_ECX,UC_X86_REG_EIP,UC_X86_REG_ESP,UC_X86_REG_FPCW
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'recovery'))
from effect_native import map_original_binaries
uc,_=map_original_binaries([ROOT/'CDTank/CDTank.exe'])
uc.mem_map(0,4096);uc.mem_map(0x2000000,0x10000)
OBJECT,STACK,STOP,CLOCK,SLEEP=0x2001000,0x2008000,0x2009000,0x200a000,0x200b000
clock_values=[];reads=[];sleeps=[]
def put(a,*v):uc.mem_write(a,struct.pack('<'+'I'*len(v),*[x&0xffffffff for x in v]))
def uint(a):return struct.unpack('<I',uc.mem_read(a,4))[0]
def double(a):return struct.unpack('<d',uc.mem_read(a,8))[0]
def finish(pop=0):
 s=uc.reg_read(UC_X86_REG_ESP);uc.reg_write(UC_X86_REG_EIP,uint(s));uc.reg_write(UC_X86_REG_ESP,s+4+pop)
def hook(machine,a,size,data):
 if a==0x40607b:
  value=clock_values.pop(0);reads.append(value);uc.mem_write(CLOCK,struct.pack('<d',value))
  uc.mem_write(CLOCK+0x100,b'\xdd\x05'+struct.pack('<I',CLOCK)+b'\xc3');machine.reg_write(UC_X86_REG_EIP,CLOCK+0x100)
 elif a==0x410c12:finish()
 elif a==SLEEP:sleeps.append(uint(machine.reg_read(UC_X86_REG_ESP)+4));finish(4)
uc.hook_add(UC_HOOK_CODE,hook);put(0x5c05d8,SLEEP)
def call(a,*args):
 put(STACK,STOP,*args);uc.reg_write(UC_X86_REG_ESP,STACK);uc.reg_write(UC_X86_REG_ECX,OBJECT);uc.reg_write(UC_X86_REG_FPCW,0x27f)
 uc.emu_start(a,STOP,count=100000);assert uc.reg_read(UC_X86_REG_EIP)==STOP
 return uc.reg_read(UC_X86_REG_EAX)
uc.mem_write(OBJECT,bytes(0x90));clock_values.clear();call(0x4060bc,30)
interval=double(OBJECT+0x48);assert interval==1/30 and uint(OBJECT+0x60)==3
rows=[];now=0
# Continuous calls model work elapsed since the prior completion; Sleep completion has no remainder carry.
work=[0,.005,.016,.033,interval,interval+1e-9,2*interval,2*interval+1e-9,.2,0,.0001,.034]
work += [.016]*80
for index,elapsed in enumerate(work):
 start=now+elapsed;first=index==0;delta=interval if first else start-double(0x630a60)
 sleep_ms=int(max(0,(interval-delta)*1000)) if delta<=interval else None
 completion=start+(sleep_ms or 0)/1000+(.0007 if index%4==0 else 0)
 reset=start+.0002 if first else None
 clock_values.extend([start]+([reset] if first else [])+[completion]);reads.clear();sleeps.clear()
 steps=call(0x406154);assert not clock_values
 assert sleeps==([] if sleep_ms is None else [sleep_ms])
 rows.append({'start':start,'reset':reset,'completion':completion,'steps':steps,'sleepMs':sleep_ms,'clockReads':list(reads),
  'state':{'previousCompletion':double(0x630a60),'initialized':bool(uc.mem_read(OBJECT+0x64,1)[0]),
  'inverseDelta':double(OBJECT+0x50) if double(OBJECT+0x50)!=float('inf') else 'Infinity','averageRate':double(OBJECT+0x58),'sampleCount':uint(OBJECT+0x70),
  'sampleDuration':double(OBJECT+0x68),'clockStart':double(OBJECT+0x20),'clockPrevious':double(OBJECT+0x28),
  'clockPaused':bool(uc.mem_read(OBJECT+0x30,1)[0]),'clockPausedDuration':double(OBJECT+0x38)}})
 now=completion
assert any(r['state']['averageRate']!=0 for r in rows)
# Keep the previous completion at zero to distinguish exact boundaries from accumulated rounding.
boundaries=[]
for elapsed in [0,.001,.016,interval-1e-12,interval,interval+1e-12,2*interval-1e-12,2*interval,2*interval+1e-12,.1,1]:
 uc.mem_write(OBJECT,bytes(0x90));clock_values.clear();call(0x4060bc,30)
 clock_values.extend([0,0,0]);call(0x406154)
 clock_values.extend([elapsed,elapsed]);sleeps.clear();steps=call(0x406154)
 boundaries.append({'elapsed':elapsed,'steps':steps,'sleepMs':sleeps[0] if sleeps else None})
# Explicit integer conversion helper truncates positive/negative values toward zero.
conversions=[]
for value in [0,.9,1,1.9,2.999,-.9,-1.9,33.333333333333336]:
 uc.mem_write(CLOCK,struct.pack('<d',value));uc.mem_write(CLOCK+0x200,b'\xdd\x05'+struct.pack('<I',CLOCK)+b'\xe8'+struct.pack('<i',0x57bb64-(CLOCK+0x20b))+b'\xc3')
 result=call(CLOCK+0x200);signed=result if result<0x80000000 else result-0x100000000
 assert signed==int(value);conversions.append({'input':value,'result':signed})
out={'interval':interval,'maxSteps':3,'rows':rows,'boundaries':boundaries,'conversions':conversions,'evidence':{'construct':'0x4060bc','update':'0x406154','resetClock':'0x410c5d','truncate':'0x57bb64','completionGlobal':'0x630a60'}}
path=ROOT/'recovery/output/skill-effect-frame-scheduler-native.json';path.write_text(json.dumps(out,indent=2)+'\n')
print(f'PASS: {len(rows)} continuous native clock decisions / {len(conversions)} integer conversions')
