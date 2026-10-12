"""Execute native emote colour from XML through SequenceImage/ImageFrame draw."""
import importlib.util
import json
from pathlib import Path
import struct
import capstone
import pefile
from unicorn import Uc, UC_ARCH_X86, UC_MODE_32, UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_ECX, UC_X86_REG_EIP, UC_X86_REG_ESI, UC_X86_REG_ESP
ROOT = Path(__file__).resolve().parents[3]
spec = importlib.util.spec_from_file_location('xml_source', Path(__file__).with_name('chat-xml-source.py'))
xml = importlib.util.module_from_spec(spec)
spec.loader.exec_module(xml)
rich = xml.rich
BASE = 0x10000000

class Native(xml.Native):
    def drawseq(self):
        args = [self.arg(i) for i in range(7)]
        colour = args[3]
        corners = [[self.f(colour + i*24 + d) for d in (0,4,8,12)] for i in range(4)]
        name = next(n for n,v in self.sequences.items() if v == self.ecx())
        p = args[0]
        row = dict(kind='emote', name=name,
                   rect=[self.f(p+d) for d in (8,0,12,4)],
                   cornersARGB=corners, cornersRGBA=[c[1:]+c[:1] for c in corners])
        # The two DLLs use the same preferred base, so preserve the complete
        # consumer data/stack region in a separate CEGUIBase execution machine.
        machine = Uc(UC_ARCH_X86, UC_MODE_32)
        binary = pefile.PE(str(ROOT/'CDTank/CEGUIBase.dll')).get_memory_mapped_image()
        machine.mem_map(BASE, (len(binary)+4095)&~4095)
        machine.mem_write(BASE, binary)
        machine.mem_map(0x2000000, 0x100000)
        machine.mem_write(0x2000000, bytes(self.uc.mem_read(0x2000000, 0x100000)))
        def write(p,*v): machine.mem_write(p, struct.pack('<'+'I'*len(v), *[x&0xffffffff for x in v]))
        def fs(p,v): machine.mem_write(p, struct.pack('<f',v))
        def read(p): return struct.unpack('<I',machine.mem_read(p,4))[0]
        def f(p): return struct.unpack('<f',machine.mem_read(p,4))[0]
        sequence = self.ecx()
        frames = 0x2060000
        resource = next(s for s in json.loads((ROOT/'recovery/output/chat-emote-render-source.json').read_text())['sequences'] if s['name']==name)
        for i,frame in enumerate(resource['frames']):
            fp=frames+i*0xcc
            rect=frame['rectangle']
            for d,v in [(8,float(rect['YPos'])),(12,float(rect['YPos'])+float(rect['Height'])),(16,float(rect['XPos'])),(20,float(rect['XPos'])+float(rect['Width']))]: fs(fp+d,v)
            fs(fp+0xc8,float(frame['Duration']))
            write(fp+4,0x2068000)
        write(sequence+0x9c,frames,frames+len(resource['frames'])*0xcc)
        write(sequence+0xac,0xffffffff)
        fs(sequence+0xa8,0)
        visited=[]
        def hook(uc,p,size,user):
            if p in (0x10027410,0x10018780,0x10018a90): visited.append(hex(p))
            if p == 0x10018a90:
                sp=uc.reg_read(UC_X86_REG_ESP)
                imageargs=[read(sp+4+4*i) for i in range(8)]
                cp=imageargs[4]
                row['imageDraw']=dict(entry=hex(p),
                    sourceRect=[f(imageargs[0]+d) for d in (8,0,12,4)],
                    destinationRect=[f(imageargs[1]+d) for d in (8,0,12,4)],
                    cornersARGB=[[f(cp+i*24+d) for d in (0,4,8,12)] for i in range(4)],
                    frameIndex=(uc.reg_read(UC_X86_REG_ESI)-frames)//0xcc)
                uc.reg_write(UC_X86_REG_EIP,read(sp))
                uc.reg_write(UC_X86_REG_ESP,sp+4+32)
        machine.hook_add(UC_HOOK_CODE,hook)
        write(rich.STACK,rich.END,*args)
        machine.reg_write(UC_X86_REG_ESP,rich.STACK)
        machine.reg_write(UC_X86_REG_ECX,sequence)
        machine.emu_start(0x10027410,rich.END,count=10000)
        assert machine.reg_read(UC_X86_REG_EIP)==rich.END
        row['nativeImageEntriesExecuted']=visited
        self.draws.append(row)
        self.ret(28)

VECTORS = [
    ('red','A<emote name=001 red=255 green=0 blue=0 alpha=255/>B'),
    ('green','A<emote name=001 red=0 green=255 blue=0 alpha=255/>B'),
    ('midpoint','A<emote name=001 red=128 green=128 blue=128 alpha=128/>B'),
    ('transparent','A<emote name=001 red=255 green=0 blue=0 alpha=0/>B'),
    ('missingRGBA','A<emote name=001/>B'),
    ('parentIsolation','<colour red=255 green=0 blue=0 alpha=255>A<emote name=001/>B</colour>C'),
    ('ownOverridesParent','<colour red=255 green=0 blue=0 alpha=255>A<emote name=001 red=0 green=255 blue=0 alpha=255/>B</colour>C'),
    ('fixedLineSpacing','A<emote name=026 red=128 green=0 blue=255 alpha=128/>B\nC<emote name=001 red=0 green=255 blue=0 alpha=255/>D'),
]

def run():
    rows=[]
    for label,text in VECTORS:
        n=Native(text)
        n.invoke(0x10027370)
        lines=n.lines()
        draws=n.render()
        items=[i for line in lines for i in line['items'] if i['kind']=='emote']
        images=[d for d in draws if d['kind']=='emote']
        assert len(items)==len(images)
        for item,draw in zip(items,images):
            assert draw['cornersARGB']==[item['colour']]*4
            assert draw['imageDraw']['cornersARGB']==draw['cornersARGB']
            assert draw['imageDraw']['destinationRect']==draw['rect']
            assert draw['rect'][2]-draw['rect'][0]==item['width']-1
            assert draw['rect'][3]-draw['rect'][1]==item['height']
            assert draw['nativeImageEntriesExecuted']==['0x10027410','0x10018780','0x10018a90']
        for item in items:
            c=item['colour']
            item['floatRGBA']=c[1:]+c[:1]
        rows.append(dict(label=label,input=text,events=n.events,lines=lines,draws=draws))
    expected=[(1,1,0,0),(1,0,1,0),(128/255,)*4,(0,1,0,0),(0,0,0,0),(0,0,0,0),(1,0,1,0)]
    for row,colour in zip(rows,expected):
        actual=next(i for l in row['lines'] for i in l['items'] if i['kind']=='emote')['colour']
        assert all(abs(a-b)<1e-6 for a,b in zip(actual,colour))
    for index in (5,6):
        assert [e['argb'] for e in rows[index]['events'] if e['kind']=='text']==['0xffff0000','0xffff0000','0xffffffff']
    images=[d for d in rows[-1]['draws'] if d['kind']=='emote']
    assert [d['rect'][1] for d in images]==[10,26]
    result=dict(status='PASS',vectorCount=len(rows),channelOrder='alpha,red,green,blue',vectors=rows,
        nativeExecution='TinyXML/XML traversal → native rich item/layout/draw → native SequenceImage::draw → native ImageFrame::draw → Imageset::draw call arguments',
        providers=['Existing CEGUI String/XMLAttributes and alpha/red/green/blue colour value/ARGB providers','Font advance: ASCII7 / Chinese14; line spacing16','Original sequence frames, durations and atlas rectangles; frame elapsed0; offset0','Imageset::draw entry is supplied return boundary'],
        boundary=dict(entry='CEGUIBase.dll:0x10018a90',requires='Imageset+0xa4 Texture width/height virtual queries and Renderer virtual draw+0x18',scope='Arguments entering original Imageset::draw are observed; texture clipping/UV/renderer output and Windows GPU pixels are not executed'))
    out=ROOT/'recovery/output/chat-emote-colour-source.json'
    out.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    md=capstone.Cs(capstone.CS_ARCH_X86,capstone.CS_MODE_32)
    parts=[]
    for dll,ranges in [('CEGUIWindowsLook.dll',[(0x100243e0,0x10024861)]),('CEGUIBase.dll',[(0x10027410,0x1002749e),(0x10018780,0x100187e8),(0x10018a90,0x10018ce9)])]:
        b=pefile.PE(str(ROOT/'CDTank'/dll)).get_memory_mapped_image()
        parts.append(dll)
        for a,z in ranges:
            parts.extend(f'{i.address:08x} {i.mnemonic} {i.op_str}' for i in md.disasm(b[a-BASE:z-BASE],a))
    out.with_suffix('.disasm.txt').write_text('\n'.join(parts)+'\n')
    print('PASS:',len(rows),'native emote colour vectors through Imageset draw arguments')

if __name__=='__main__':run()
