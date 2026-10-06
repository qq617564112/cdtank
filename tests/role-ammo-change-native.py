"""Full428cd2 with optional UI absent: confirmed reload override and callbacks."""
import json
from pathlib import Path
import struct
import sys
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_ECX, UC_X86_REG_EIP, UC_X86_REG_ESP
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'recovery'))
from effect_native import map_original_binaries
uc,_=map_original_binaries([ROOT/'CDTank/CDTank.exe'])
uc.mem_map(0,4096);uc.mem_map(0x2000000,0x20000)
OWNER,ROLE,RECORD,PACKET,CALLBACK,VTABLE,STACK,RETURN,CLOCK=[0x2001000+i*0x1000 for i in range(9)]
SELECT,DURATION=0x2011000,0x2011100
def write(a,*v):uc.mem_write(a,struct.pack('<'+'I'*len(v),*[x&0xffffffff for x in v]))
def read(a):return struct.unpack('<I',uc.mem_read(a,4))[0]
def f32(v):return struct.unpack('<f',struct.pack('<f',v))[0]
def state():return dict(seconds=struct.unpack('<f',uc.mem_read(ROLE+0x54,4))[0],deadline=struct.unpack('<f',uc.mem_read(ROLE+0x9c,4))[0])
uc.mem_write(CLOCK,b'\xdd\x05'+struct.pack('<I',CLOCK+0x100)+b'\xc2\x04\x00')
events=[]
def hook(machine,address,size,data):
 stack=machine.reg_read(UC_X86_REG_ESP)
 if address==0x40bd28:
  events.append(dict(kind='log'));pop=0
 elif address==0x422f0d:
  assert read(stack+4)==OWNER
  events.append(dict(kind='clock',state=state()));machine.reg_write(UC_X86_REG_EIP,CLOCK);return
 elif address==SELECT:
  events.append(dict(kind='changed',value=read(stack+4),state=state()));pop=4
 else:
  events.append(dict(kind='duration',value=struct.unpack('<f',machine.mem_read(stack+4,4))[0],state=state()));pop=4
 machine.reg_write(UC_X86_REG_EIP,read(stack));machine.reg_write(UC_X86_REG_ESP,stack+4+pop)
for a in [0x40bd28,0x422f0d,SELECT,DURATION]:uc.hook_add(UC_HOOK_CODE,hook,begin=a,end=a)
write(ROLE,0x5c2c28);write(ROLE+0x2a0,RECORD);write(CALLBACK,VTABLE);write(VTABLE+8,SELECT)
write(CALLBACK+0x10,VTABLE+0x10);write(VTABLE+0x18,DURATION)
rows=[]
for present in [False,True]:
 for selectionObserver in [False,True]:
  for durationObserver in [False,True]:
   for selection in [0,1,2,8,0xffffffff]:
    for seconds in [-1.,0.,.7,2.34567,100.]:
     for current in [.125,123.456789]:
      write(OWNER+0x3c,ROLE if present else 0);write(OWNER+0xec,0)
      write(OWNER+0x6c,CALLBACK if selectionObserver else 0);write(OWNER+0x7c,CALLBACK+0x10 if durationObserver else 0)
      write(PACKET+0xc,selection,0xf1234567);uc.mem_write(PACKET+0x14,struct.pack('<f',seconds))
      uc.mem_write(ROLE+0x54,struct.pack('<f',9.25));uc.mem_write(ROLE+0x9c,struct.pack('<f',7.25))
      uc.mem_write(CLOCK+0x100,struct.pack('<d',current));events.clear();before=bytes(uc.mem_read(RECORD,0x140))
      write(STACK,RETURN,PACKET,0,0);uc.reg_write(UC_X86_REG_ECX,OWNER);uc.reg_write(UC_X86_REG_ESP,STACK);uc.emu_start(0x428cd2,RETURN,count=10000)
      assert uc.reg_read(UC_X86_REG_EIP)==RETURN and uc.reg_read(UC_X86_REG_ESP)==STACK+16
      expected=[]
      result=dict(seconds=9.25,deadline=7.25)
      if present:
       if selectionObserver:expected.append(dict(kind='changed',value=selection,state=dict(result)))
       result['seconds']=f32(seconds);expected.append(dict(kind='clock',state=dict(result)))
       result['deadline']=f32(current+f32(seconds))
       if durationObserver:expected.append(dict(kind='duration',value=f32(seconds),state=dict(result)))
      else:expected.append(dict(kind='log'))
      assert state()==result and events==expected
      assert bytes(uc.mem_read(RECORD,0x140))==before
      rows.append(dict(present=present,selectionObserver=selectionObserver,durationObserver=durationObserver,
       field0c=selection,seconds=f32(seconds),current=current,result=result,events=list(events)))
(ROOT/'recovery/output/role-ammo-change-native.json').write_text(json.dumps(dict(status='PASS',rows=rows,
 scope='Full428cd2 with owner+ec optional UI absent. Actual role+54 store, relative-clock addition and role+9c store. Clock/log/selection/duration observers supplied. Authoritative confirmation producer not covered; no record/ammo-consumption changes.'),indent=2)+'\n')
print(f'PASS: {len(rows)} full ammo-change notifications without UI, rawf32 duration/deadline and callback order; record unchanged')

# Original UMsgPrNotifyChangeBullet factory and full96-bit writer/reader.
STREAM, BUFFER = 0x2013000, 0x2014000
ALLOCATOR = 0x2015000
write(0x630a28, ALLOCATOR)
def allocate(machine,address,size,data):
 stack=machine.reg_read(UC_X86_REG_ESP)
 assert read(stack+4)==0x18
 machine.reg_write(UC_X86_REG_EAX,PACKET);machine.reg_write(UC_X86_REG_EIP,read(stack));machine.reg_write(UC_X86_REG_ESP,stack+8)
uc.hook_add(UC_HOOK_CODE,allocate,begin=0x4138e8,end=0x4138e8)
uc.mem_write(PACKET,b'\xaa'*24)
write(STACK,RETURN);uc.reg_write(UC_X86_REG_ESP,STACK);uc.reg_write(UC_X86_REG_ECX,0)
uc.emu_start(0x42eb98,RETURN,count=10000)
assert uc.reg_read(UC_X86_REG_EAX)==PACKET and read(PACKET)==0x5c3f60
assert bytes(uc.mem_read(PACKET+0xc,12))==b'\xaa'*12
write(STACK,RETURN);uc.reg_write(UC_X86_REG_ESP,STACK);uc.reg_write(UC_X86_REG_ECX,PACKET)
uc.emu_start(0x423d7c,RETURN,count=1000)
assert uc.reg_read(UC_X86_REG_EAX)==0x3ab5
wire_rows=[]
for field0c in [0,1,2,8,0xffffffff]:
 for field10 in [0,77,0x80000000,0xffffffff]:
  for seconds in [-1.,0.,.7,2.34567,100.]:
   seconds=f32(seconds)
   for offset in range(8):
    write(PACKET+0xc,field0c,field10);uc.mem_write(PACKET+0x14,struct.pack('<f',seconds))
    uc.mem_write(BUFFER,bytes(32));write(STREAM,offset,0,BUFFER,32)
    write(STACK,RETURN,STREAM);uc.reg_write(UC_X86_REG_ECX,PACKET);uc.reg_write(UC_X86_REG_ESP,STACK)
    uc.emu_start(0x425f2c,RETURN,count=10000)
    assert uc.reg_read(UC_X86_REG_EIP)==RETURN and uc.reg_read(UC_X86_REG_ESP)==STACK+8
    body=struct.pack('<2If',field0c,field10,seconds)
    payload=bytes(uc.mem_read(BUFFER,(offset+96+7)//8))
    assert int.from_bytes(payload,'little')==int.from_bytes(body,'little')<<offset
    uc.mem_write(PACKET+0xc,b'\xaa'*12);write(STREAM,offset,0,BUFFER,32)
    write(STACK,RETURN,STREAM);uc.reg_write(UC_X86_REG_ECX,PACKET);uc.reg_write(UC_X86_REG_ESP,STACK)
    uc.emu_start(0x42ebf8,RETURN,count=10000)
    assert uc.reg_read(UC_X86_REG_EIP)==RETURN and uc.reg_read(UC_X86_REG_ESP)==STACK+8
    assert bytes(uc.mem_read(PACKET+0xc,12))==body
    # Real decoded object is passed directly to the full no-UI notification handler.
    uc.mem_write(ROLE+0x54,struct.pack('<f',9.25));uc.mem_write(ROLE+0x9c,struct.pack('<f',7.25))
    uc.mem_write(CLOCK+0x100,struct.pack('<d',123.456789));events.clear()
    write(STACK,RETURN,PACKET,0,0);uc.reg_write(UC_X86_REG_ECX,OWNER);uc.reg_write(UC_X86_REG_ESP,STACK)
    uc.emu_start(0x428cd2,RETURN,count=10000)
    result=dict(seconds=seconds,deadline=f32(123.456789+seconds))
    expected=[dict(kind='changed',value=field0c,state=dict(seconds=9.25,deadline=7.25)),
      dict(kind='clock',state=dict(seconds=seconds,deadline=7.25)),dict(kind='duration',value=seconds,state=dict(result))]
    assert state()==result and events==expected
    wire_rows.append(dict(field0c=field0c,field10=field10,seconds=seconds,offset=offset,payload=payload.hex(),result=result,events=list(events)))

# Full optional-UI branch; lookups/render/localization/format/allocation supplied.
uc.mem_map(0x2020000,0x200000)
GLOBAL,RESOURCES,ITEM_TABLE,INVENTORY,ITEM,DEFINITION,VISUAL,VISUAL_VTABLE,UI,UI_VTABLE = [0x2021000+i*0x1000 for i in range(10)]
HEAP=0x2030000
heap=HEAP
MODEL_CHANGED,UI_TEXT,GET_ARRAY=0x202c000,0x202d000,0x202e000
CUSTOM_VTABLE=0x202f000
uc.mem_write(CUSTOM_VTABLE,bytes(uc.mem_read(0x5c2c28,0x40)))
write(CUSTOM_VTABLE+0x20,GET_ARRAY)
item_present,definition_present=True,True
ui_events=[]
def cstring(address):return bytes(uc.mem_read(address,256)).split(b'\0')[0]
def ui_hook(machine,address,size,data):
 global heap
 stack=machine.reg_read(UC_X86_REG_ESP)
 pop=0;value=0
 if address==GET_ARRAY:
  pop=4
 elif address==0x578620:
  size=read(stack+4);value=heap;heap+=(size+15)&~15
 elif address==0x43d728:
  assert read(stack+4)==77
  ui_events.append(dict(kind='inventory',key=77));value=ITEM if item_present else 0;pop=4
 elif address==0x411068:
  key=read(stack+4);assert key==(2002 if item_present else 2001)
  ui_events.append(dict(kind='definition',key=key));value=DEFINITION if definition_present else 0;pop=4
 elif address==MODEL_CHANGED:
  ui_events.append(dict(kind='model',value=read(stack+4),state=state()));pop=4
 elif address==0x417e17:
  assert read(stack+4)==0x248;value=read(stack+8)
 elif address==0x57b70f:
  output,format_pointer,name=read(stack+4),read(stack+8),read(stack+12)
  text=cstring(format_pointer).replace(b'%s',cstring(name));uc.mem_write(output,text+b'\0');value=len(text)
 elif address==UI_TEXT:
  string=read(stack+4);pointer=read(string+4) if read(string+0x18)>=16 else string+4
  ui_events.append(dict(kind='text',bytes=list(cstring(pointer)),state=state()));pop=4
 machine.reg_write(UC_X86_REG_EAX,value);machine.reg_write(UC_X86_REG_EIP,read(stack));machine.reg_write(UC_X86_REG_ESP,stack+4+pop)
for address in [0x578620,0x57a6c7,0x43d728,0x411068,MODEL_CHANGED,0x417e17,0x57b70f,UI_TEXT,GET_ARRAY]:uc.hook_add(UC_HOOK_CODE,ui_hook,begin=address,end=address)
write(0x633588,GLOBAL);write(GLOBAL+0x114,RESOURCES);write(RESOURCES+0x7c,ITEM_TABLE);write(GLOBAL+0x120,INVENTORY)
write(ITEM+0xc,2002);write(DEFINITION+0x74,0xf1234567)
write(VISUAL,VISUAL_VTABLE);write(VISUAL_VTABLE+0xa4,MODEL_CHANGED);write(ROLE+0x310,VISUAL)
write(UI,UI_VTABLE);write(UI_VTABLE+8,UI_TEXT)
# Short native string avoids interpreting game names or code-page conversion.
write(DEFINITION+0x10,0);uc.mem_write(DEFINITION+0x14,b'Ammo\0'+bytes(11));write(DEFINITION+0x24,4,15)
ui_rows=[]
for ui_present in [False,True]:
 for hotkeys_present in [False,True]:
  for item_present in [False,True]:
   for definition_present in [False,True]:
    write(OWNER+0xec,UI if ui_present else 0);write(ROLE+0x2a0,RECORD);write(ROLE,0x5c2c28 if hotkeys_present else CUSTOM_VTABLE)
    write(PACKET+0xc,2,77);uc.mem_write(PACKET+0x14,struct.pack('<f',.7))
    uc.mem_write(ROLE+0x54,struct.pack('<f',9.25));uc.mem_write(ROLE+0x9c,struct.pack('<f',7.25))
    uc.mem_write(CLOCK+0x100,struct.pack('<d',123.456789));events.clear();ui_events.clear();heap=HEAP
    write(STACK,RETURN,PACKET,0,0);uc.reg_write(UC_X86_REG_ECX,OWNER);uc.reg_write(UC_X86_REG_ESP,STACK)
    uc.emu_start(0x428cd2,RETURN,count=100000)
    assert uc.reg_read(UC_X86_REG_EIP)==RETURN and uc.reg_read(UC_X86_REG_ESP)==STACK+16
    accepted=not ui_present or hotkeys_present and definition_present
    expected=[]
    if ui_present and hotkeys_present:
     expected=[dict(kind='inventory',key=77),dict(kind='definition',key=2002 if item_present else 2001)]
     if definition_present:expected.extend([dict(kind='model',value=0xf1234567,state=dict(seconds=9.25,deadline=7.25)),dict(kind='text',bytes=list(cstring(0x5c38ec).replace(b'%s',b'Ammo')),state=dict(seconds=9.25,deadline=7.25))])
    assert ui_events==expected,(ui_events,expected)
    result=dict(seconds=f32(.7),deadline=f32(123.456789+f32(.7))) if accepted else dict(seconds=9.25,deadline=7.25)
    assert state()==result
    assert bool(events)==accepted
    ui_rows.append(dict(ui=ui_present,hotkeys=hotkeys_present,item=item_present,definition=definition_present,accepted=accepted,result=result,uiEvents=list(ui_events),events=list(events)))

evidence_path=ROOT/'recovery/output/role-ammo-change-native.json'
evidence=json.loads(evidence_path.read_text());evidence.update(uiFormatBytes=list(cstring(0x5c38ec)),uiRows=ui_rows,messageType=0x3ab5,constructorLeavesBodyUninitialized=True,wireRows=wire_rows)
evidence['scope']+=' Full optional-UI428cd2 executes with actual4327ac for present arrays; null getter supplied through a virtual boundary. Native string operations execute. Inventory/item-table lookup, localized format selection, CRT formatting, model/text observers and allocation/free supplied. UI lookup/model/text precede reload; missing hotkeys/definition returns before reload. Actual42eb98 factory with24-byte allocator boundary, constructor4248d5/402289, typegetter423d7c, full425f2c writer and42ebf8 reader; decoded objects execute full428cd2 no-UI confirmation. Body not initialized by constructor.'
evidence_path.write_text(json.dumps(evidence,indent=2)+'\n')
print(f'PASS: original3ab5 factory/type and {len(wire_rows)} full96-bit codec→decoded-object→confirmation chains')

print(f'PASS: {len(ui_rows)} full optional-UI confirmation branches, early-return gates, item/default lookups, model/text updates and reload')
