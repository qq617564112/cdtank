"""Original combat listener table → transport → decoded ammo confirmation handler."""
import json
from pathlib import Path
import struct
import sys
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_EBP, UC_X86_REG_ECX, UC_X86_REG_EIP, UC_X86_REG_ESP
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'recovery'))
from effect_native import map_original_binaries
uc,_=map_original_binaries([ROOT/'CDTank/CDTank.exe'])
uc.mem_map(0,4096);uc.mem_map(0x2000000,0x200000)
TRANSPORTS=[0x2001000,0x2005000,0x2009000]
OWNER,GAME,ROLE,RECORD,BUFFER=0x200d000,0x200e000,0x200f000,0x2010000,0x2011000
STACK,RETURN,LOCK,TICK,CLOCK=0x2100000,0x2101000,0x2102000,0x2102100,0x2102200
HEAP=0x2110000
heap=HEAP;events=[];packets=[];pool_returns=[]
def write(a,*v):uc.mem_write(a,struct.pack('<'+'I'*len(v),*[x&0xffffffff for x in v]))
def read(a):return struct.unpack('<I',uc.mem_read(a,4))[0]
def state():return dict(seconds=struct.unpack('<f',uc.mem_read(ROLE+0x54,4))[0],deadline=struct.unpack('<f',uc.mem_read(ROLE+0x9c,4))[0])
def finish(value=0,pop=0):
 stack=uc.reg_read(UC_X86_REG_ESP);uc.reg_write(UC_X86_REG_EAX,value)
 uc.reg_write(UC_X86_REG_EIP,read(stack));uc.reg_write(UC_X86_REG_ESP,stack+4+pop)
def hook(machine,address,size,data):
 global heap
 stack=machine.reg_read(UC_X86_REG_ESP)
 if address==0x578620:
  count=read(stack+4);pointer=heap;heap+=(count+15)&~15;assert heap<0x2200000;finish(pointer)
 elif address in [0x57a6c7,0x57aa66,LOCK,0x40bd28]:finish()
 elif address==TICK:finish(100)
 elif address==0x40266a:events.append(dict(kind='route',messageType=read(stack+8),identity=read(stack+12)))
 elif address==0x42ebf8:
  packet=machine.reg_read(UC_X86_REG_ECX);packets.append(packet)
  events.append(dict(kind='reader',metadata=read(packet+4),identity=read(packet+8)))
 elif address==0x428cd2:
  assert machine.reg_read(UC_X86_REG_ECX)==OWNER
  packet=read(stack+4);events.append(dict(kind='handler',field0c=read(packet+12),field10=read(packet+16),
   seconds=struct.unpack('<f',machine.mem_read(packet+20,4))[0],context=read(stack+8),connection=read(stack+12)))
 elif address==0x422f0d:
  assert read(stack+4)==OWNER
  events.append(dict(kind='clock',state=state()));machine.reg_write(UC_X86_REG_EIP,CLOCK)
 elif address==0x416f5e:pool_returns.append(dict(pointer=read(stack+4),size=read(stack+8)))
for address in [0x578620,0x57a6c7,0x57aa66,LOCK,TICK,0x40bd28,0x40266a,0x42ebf8,0x428cd2,0x422f0d,0x416f5e]:
 uc.hook_add(UC_HOOK_CODE,hook,begin=address,end=address)
write(0x5c0980,LOCK);write(0x5c097c,LOCK);write(0x5c0828,TICK)
uc.mem_write(CLOCK,b'\xdd\x05'+struct.pack('<I',CLOCK+0x100)+b'\xc2\x04\x00')
uc.mem_write(CLOCK+0x100,struct.pack('<d',123.456789))
def call(address,this,*args):
 write(0,0x12345678);write(STACK,RETURN,*args)
 uc.reg_write(UC_X86_REG_ECX,this);uc.reg_write(UC_X86_REG_ESP,STACK);uc.reg_write(UC_X86_REG_EBP,0x1234)
 try:uc.emu_start(address,RETURN,count=200000)
 except Exception:
  print('FAILED',hex(address),'at',hex(uc.reg_read(UC_X86_REG_EIP)),'ecx',hex(uc.reg_read(UC_X86_REG_ECX)));raise
 assert uc.reg_read(UC_X86_REG_EIP)==RETURN and uc.reg_read(UC_X86_REG_ESP)==STACK+4+len(args)*4
 assert uc.reg_read(UC_X86_REG_EBP)==0x1234 and read(0)==0x12345678
write(0x633588,GAME)
# Full static listener table constructor; real base constructor/iterator, derived
# vtable values prepared from42f9bb/42f9c9. Full42f997 visual setup is excluded.
call(0x420f39,0x6350c0)
call(0x42b7e7,0x6350e8)
call(0x4218f0,OWNER);write(OWNER,0x5c3a18);write(OWNER+8,0x5c3a10)
for transport in TRANSPORTS:
 call(0x403096,transport+4)
 call(0x402ec8,0,transport+4,OWNER+8)
counts=[read(t+0x10) for t in TRANSPORTS]
assert counts==[23,23,23],counts
write(ROLE,0x5c2c28);write(ROLE+0x2a0,RECORD);write(OWNER+0x3c,ROLE);write(OWNER+0xec,0)
rows=[]
for transport_index,transport in enumerate(TRANSPORTS):
 for identity in [0,0x1234,0xffff]:
  for field0c in [0,2,0xffffffff]:
   for field10 in [0,77,0x80000001]:
    for seconds in [-1.,0.,.7,2.34567]:
     seconds=struct.unpack('<f',struct.pack('<f',seconds))[0]
     payload=struct.pack('<HHIIf',0x3ab5,identity,field0c,field10,seconds)
     uc.mem_write(BUFFER,payload);uc.mem_write(ROLE+0x54,struct.pack('<f',9.25));uc.mem_write(ROLE+0x9c,struct.pack('<f',7.25))
     before=bytes(uc.mem_read(RECORD,0x140));events.clear();packets.clear();pool_returns.clear()
     call(0x4038d5,transport,0x55667788,0x11223344,BUFFER,len(payload),0x99aabbcc)
     cursor=read(transport+0x14)+8*read(transport+0x18)
     result=dict(seconds=seconds,deadline=struct.unpack('<f',struct.pack('<f',123.456789+seconds))[0])
     assert state()==result and bytes(uc.mem_read(RECORD,0x140))==before
     assert events==[dict(kind='route',messageType=0x3ab5,identity=identity),
      dict(kind='reader',metadata=0x99aabbcc,identity=identity),
      dict(kind='handler',field0c=field0c,field10=field10,seconds=seconds,context=0x11223344,connection=0x55667788),
      dict(kind='clock',state=dict(seconds=seconds,deadline=7.25))],events
     assert cursor==128 and len(packets)==1 and pool_returns==[dict(pointer=packets[0],size=24)]
     rows.append(dict(transportIndex=transport_index,identity=identity,field0c=field0c,field10=field10,
       seconds=seconds,payload=payload.hex(),bitsRead=cursor,result=result,events=list(events)))
(ROOT/'recovery/output/role-ammo-receive-chain-native.json').write_text(json.dumps(dict(status='PASS',registrationCounts=counts,rows=rows,
 scope='Full42b7e7 static23-listener table and4218f0 base; derived vtables prepared, full42f997 gameplay/visual constructor excluded. Actual427aba iterator/402ec8 three-transport registration,4038d5 envelope/40266a route/factory/42ebf8 reader/48b28c forward/428cd2 no-UI handler/destructor/pool return. Allocation, locks, tick, diagnostics and relative clock supplied. No missing-server producer, Winsock I/O or short-packet behavior established.'),indent=2)+'\n')
print(f'PASS: {len(rows)} full original ammo confirmation receive chains across three23-listener transports')
