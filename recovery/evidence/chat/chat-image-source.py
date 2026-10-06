"""Execute original chat image parsing, resource lookup, layout and draw traversal."""
import importlib.util
import json
from pathlib import Path
import capstone
import pefile
from unicorn.x86_const import UC_X86_REG_EIP

ROOT = Path(__file__).resolve().parents[3]
spec = importlib.util.spec_from_file_location('xml_source', Path(__file__).with_name('chat-xml-source.py'))
xml_source = importlib.util.module_from_spec(spec)
spec.loader.exec_module(xml_source)
rich = xml_source.rich
BASE = 0x30000000

class Native(xml_source.Native):
    def __init__(self, text, width=10000):
        super().__init__(text)
        self.width = width
        self.failure = None
        self.lookups = []
        self.resources = {}
        p = pefile.PE(str(ROOT/'CDTank/CEGUIBase.dll'))
        p.relocate_image(BASE)
        self.base_binary = p.get_memory_mapped_image()
        self.uc.mem_map(BASE, (len(self.base_binary)+4095)&~4095)
        self.uc.mem_write(BASE, self.base_binary)
        for iat,rva in [(0x1003d160,0x1a650),(0x1003d15c,0x1a6c0),(0x1003d158,0x18f80)]:
            self.write(iat,BASE+rva)
        # String ordering is the shared CEGUI value boundary; map searches execute.
        self.callbacks[BASE+0x2aba0] = lambda: self.ret(value=int(self.s(self.arg()) < self.s(self.arg(1))))
        self.callbacks[BASE+0x1a6fc] = lambda: self.lookup_failure('imageset-not-found')
        self.callbacks[BASE+0x18fca] = lambda: self.lookup_failure('image-not-found')
        ui = json.loads((ROOT/'recovery/output/web-assets/ui.json').read_text())
        catalog = next(s for s in ui['imagesets'] if s['attributes']['Name']=='gy0' and s['path'].startswith('ui/imagesets_dds/'))
        names = ['data\\ui\\gy\\lt1.tga','data\\ui\\gy\\guangbiao.tga']
        rows = [r for r in catalog['images'] if r['Name'] in names]
        self.manager = self.alloc(0x20)
        imageset = self.alloc(0xc0)
        self.tree(self.manager,[('gy0',imageset)],0xaa)
        entries=[]
        for row in rows:
            node = self.alloc(0x180)
            image = node+0xa4
            self.fs(image+0x20,float(row['Width']));self.fs(image+0x24,float(row['Height']))
            self.resources[image] = dict(set='gy0',name=row['Name'],asset=row['asset'],width=int(row['Width']),height=int(row['Height']))
            entries.append((row['Name'],image,node))
        self.tree(imageset+0x98,entries,0x16e)
        self.write(BASE+0x197c94,self.manager)
    def tree(self,obj,entries,size):
        header=self.alloc(size)
        self.uc.mem_write(header+size-1,b'\1')
        nodes=[]
        for entry in sorted(entries):
            name,value=entry[:2]
            node=entry[2] if len(entry)>2 else self.alloc(size)
            self.putstr(node+0xc,name)
            if len(entry)==2:self.write(node+0xa4,value)
            nodes.append(node)
        for i,node in enumerate(nodes):
            self.write(node,header,header,nodes[i+1] if i+1<len(nodes) else header)
        self.write(header, nodes[0],nodes[0],nodes[-1])
        self.write(obj+4,header)
        return nodes[0]
    def lookup_failure(self,kind):
        self.failure=dict(kind=kind,requested=self.lookups[-1]['requested'],nativeBranch=hex(self.uc.reg_read(UC_X86_REG_EIP)))
        self.uc.reg_write(UC_X86_REG_EIP,rich.END)
    def hook(self,uc,p,size,user):
        if p in [BASE+0x1a6c0,BASE+0x18f80]:
            self.lookups.append(dict(kind='imageset' if p==BASE+0x1a6c0 else 'image',requested=self.s(self.arg()),nativeEntry=hex(p)))
        super().hook(uc,p,size,user)
    def lines(self):
        lines=super().lines()
        for line,p in zip(lines,range(self.read(rich.OBJ+0x4a8),self.read(rich.OBJ+0x4ac),0x14)):
            for item,q in zip(line['items'],range(self.read(p+8),self.read(p+12),0xc4)):
                if self.read(q)==2:
                    item.update(kind='image',resource=self.resources[self.read(q+8)])
        return lines
    def drawimage(self):
        p=self.arg()
        self.draws.append(dict(kind='image',resource=self.resources[self.ecx()],rect=[self.f(p+d) for d in [8,0,12,4]],colourARGB=[hex(self.read(self.arg(3)+i*24+16)) for i in range(4)]))
        self.ret(28)
    def fourcolours(self):
        for i in range(4):self.uc.mem_write(self.ecx()+i*24,bytes(self.uc.mem_read(self.arg(i),24)))
        self.ret(16,value=self.ecx())
    def render(self):
        self.bind(0x1003d140,self.drawimage)
        self.bind(0x1003d14c,self.fourcolours)
        return super().render()

def run():
    tag='<image set=gy0 name=data\\ui\\gy\\lt1.tga/>'
    cases=[('default',tag,10000),('mixed','A'+tag+'B',10000),('wrap','AB'+tag+'C',28),('oversized',tag,16),('ignored-attributes',tag[:-2]+' width=7 height=8 red=0 green=0 blue=0 alpha=0/>',10000),('inherited-colour','<colour red=255 green=0 blue=0 alpha=128>'+tag+'</colour>',10000),('missing-set','A<image name=data\\ui\\gy\\lt1.tga/>B',10000),('unknown-set','A<image set=missing name=data\\ui\\gy\\lt1.tga/>B',10000),('missing-name','A<image set=gy0/>B',10000),('unknown-image','A<image set=gy0 name=missing/>B',10000),('wrong-attribute','<image imageset=gy0 name=data\\ui\\gy\\lt1.tga/>',10000)]
    vectors=[]
    for name,text,width in cases:
        n=Native(text,width)
        n.invoke(0x10027370)
        row=dict(name=name,input=text,width=width,events=n.events,lookups=n.lookups,failure=n.failure,lines=n.lines())
        if not n.failure: row['draws']=n.render()
        row['nativeEntriesExecuted']=[hex(p) for p in [0x10027370,0x10003bd0,0x10027100,0x100268bd,0x10026a5a,BASE+0x1a650,BASE+0x1a6c0,BASE+0x3bf60,BASE+0x3a300,BASE+0x18f80,BASE+0xdf10,BASE+0xd610,0x10025500,0x10026110,0x100243e0] if p in n.visited]
        vectors.append(row)
    by_name={row['name']:row for row in vectors}
    assert len(tag)<=72
    assert by_name['default']['lines'][0]['items'][0]['width']==20
    assert by_name['default']['draws'][0]['rect']==[20,10,40,30]
    assert by_name['default']['draws'][0]['colourARGB']==['0xffffffff']*4
    assert by_name['mixed']['draws'][1]['rect']==[27,10,47,30]
    assert by_name['wrap']['draws'][1]['rect']==[20,26,40,46]
    assert by_name['ignored-attributes']['lines']==by_name['default']['lines']
    assert by_name['inherited-colour']['lines']==by_name['default']['lines']
    assert [by_name[k]['failure']['kind'] for k in ['missing-set','unknown-set','missing-name','unknown-image','wrong-attribute']]==['imageset-not-found','imageset-not-found','image-not-found','image-not-found','imageset-not-found']
    assert all(hex(p) in by_name['default']['nativeEntriesExecuted'] for p in [BASE+0x1a650,BASE+0x1a6c0,BASE+0x18f80,BASE+0x3bf60,BASE+0xdf10])
    out=dict(status='PASS',tag=tag,tagLength=len(tag),vectors=vectors,providers=['CEGUI String ordering and XMLAttributes values','Verified ui.json DDS gy0 directory nodes and Image width/height fields','Existing font metrics and draw sink'],baseRelocation=dict(original='0x10000000',mapped=hex(BASE)),failureContract='Original getImageset/getImage unsuccessful map branch raises CEGUI UnknownObjectException; stop at native exception construction entry.')
    (ROOT/'recovery/output/chat-image-source.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
    md=capstone.Cs(capstone.CS_ARCH_X86,capstone.CS_MODE_32)
    dis=[]
    for binary,base,ranges in [(n.binary,0x10000000,[(0x268bd,0x26ba1),(0x243e0,0x24c00)]),(n.base_binary,BASE,[(0x1a650,0x1a656),(0x1a6c0,0x1a77d),(0x18f80,0x19088),(0x3bf60,0x3bfb4),(0x3a300,0x3a34c),(0xdf10,0xdf64),(0xd610,0xd65c)])]:
        for start,end in ranges: dis += [f'{i.address:08x} {i.mnemonic} {i.op_str}' for i in md.disasm(binary[start:end],base+start)]
    (ROOT/'recovery/output/chat-image-source.disasm.txt').write_text('\n'.join(dis)+'\n')
    print('PASS',len(vectors),'native image vectors')
if __name__=='__main__':run()
