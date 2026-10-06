"""Execute original movement against unmodified cells from all extracted NAVs."""
from pathlib import Path
import collections
import json
import math
import struct
import sys
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import (UC_X86_REG_ESP, UC_X86_REG_EIP, UC_X86_REG_EAX,
    UC_X86_REG_ECX, UC_X86_REG_FPCW, UC_X86_REG_FPSW, UC_X86_REG_FPTAG)
ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries
from nav import read_nav
uc, _ = map_original_binaries([ROOT / 'CDTank/CDTank.exe'])
uc.mem_map(0x2000000, 0x200000)
STACK, STOP, POS, LOOK, FORWARD, MATRIX, CENTER, MAP = [0x2001000+i*0x1000 for i in range(8)]
CELLS = 0x2020000
queries, attempts, unique, cells_observed = [], [], {}, []
current, coordinate, pending = {}, None, None
predicate_calls = coordinate_calls = 0

def u32(a): return struct.unpack('<I', uc.mem_read(a, 4))[0]
def f32(v): return struct.unpack('<f', struct.pack('<f', v))[0]
def vec(a, value=None):
    if value is not None: uc.mem_write(a, struct.pack('<3f', *value))
    return list(struct.unpack('<3f', uc.mem_read(a, 12)))

def observe(machine, address, size, data):
    global coordinate, pending, predicate_calls, coordinate_calls
    s = uc.reg_read(UC_X86_REG_ESP)
    if address == 0x433f92:
        assert uc.reg_read(UC_X86_REG_ECX) == MAP+4
        world = vec(u32(s+4))
        origin = current['minimum']
        inverse = f32(1/12)
        coordinate = [math.trunc((world[0]-origin[0])*inverse),
            math.trunc((world[2]-origin[2])*inverse)]
        coordinate_calls += 1
    elif address == 0x45758f:
        assert uc.reg_read(UC_X86_REG_ECX) == MAP+4
        x, z = struct.unpack('<2i', uc.mem_read(s+4, 8))
        if u32(s) == 0x433fd7:
            assert [x,z] == coordinate, ([x,z], coordinate)
        inside = 0 <= x < current['width'] and 0 <= z < current['height']
        key = (x,z)
        if key not in unique:
            item = dict(index=[x,z], inBounds=inside)
            if inside:
                index = z*current['width']+x
                offset = current['cellOffset']+index*8
                source = current['raw'][offset:offset+8]
                height, flags = struct.unpack('<fI', source)
                assert (height,flags) == current['cells'][index]
                assert bytes(uc.mem_read(CELLS+index*8,8)) == source
                item.update(sourceOffset=offset, bytes=source.hex(), height=height,
                    flags=flags, valid=(flags&255)>1)
            else: item['valid'] = False
            unique[key] = len(cells_observed)
            cells_observed.append(item)
        item = cells_observed[unique[key]]
        if inside:
            index = z*current['width']+x
            offset = current['cellOffset']+index*8
            assert bytes(uc.mem_read(CELLS+index*8,8)) == current['raw'][offset:offset+8]
        pending = item
        queries.append(unique[key])
        predicate_calls += 1
    elif address == 0x4575c3:
        x,z = pending['index']
        assert uc.reg_read(UC_X86_REG_EAX) == CELLS+(z*current['width']+x)*8
    elif address == 0x4575d0:
        assert bool(uc.reg_read(UC_X86_REG_EAX)&255) == pending['valid'], pending
    elif address == 0x4340c5:
        assert u32(s+4) == MAP and u32(s+8) == 0
    elif address == 0x434cee:
        attempts.append(dict(command=u32(s+0xc),
            delta=struct.unpack('<f',uc.mem_read(s+0x8c,4))[0], queryStart=len(queries)))
    elif address == 0x435106:
        accepted = bool(uc.reg_read(UC_X86_REG_EAX)&255)
        attempt = attempts[-1]
        attempt.update(accepted=accepted, code=None if accepted else u32(u32(s)),
            queries=queries[attempt['queryStart']:])
        assert accepted == all(cells_observed[i]['valid'] for i in attempt['queries'])
for address in [0x433f92,0x45758f,0x4575c3,0x4575d0,0x4340c5,0x434cee,0x435106]:
    uc.hook_add(UC_HOOK_CODE, observe, begin=address, end=address)

def select_positions(layer):
    width,height = layer['width'],layer['height']
    valid = [(flags&255)>1 for _,flags in layer['cells']]
    def neighborhood(wanted):
        for z in range(4,height-4):
            for x in range(4,width-4):
                if valid[z*width+x] != wanted: continue
                if all(valid[zz*width+xx] == wanted
                       for zz in range(z-3,z+4) for xx in range(x-3,x+4)):
                    return x,z
        return None
    clear = neighborhood(True)
    assert clear is not None
    blocked = neighborhood(False)
    if blocked is None:
        index = valid.index(False)
        blocked = (index%width,index//width)
    mixed = None
    for z in range(4,height-4):
        for x in range(4,width-4):
            values = [valid[zz*width+xx] for zz in range(z-2,z+3) for xx in range(x-2,x+3)]
            if any(values) and not all(values):
                mixed = x,z
                break
        if mixed: break
    assert mixed is not None
    ox,oy,oz = layer['minimum']
    def world(cell): return [f32(ox+cell[0]*12+6),0,f32(oz+cell[1]*12+6)]
    positions = [('valid-neighborhood',world(clear)),('invalid-neighborhood',world(blocked)),
        ('mixed-neighborhood',world(mixed)),
        ('minimum-x',[f32(ox),0,world(clear)[2]]),
        ('outside-minimum-x',[f32(ox-30),0,world(clear)[2]]),
        ('maximum-grid-x',[f32(ox+width*12),0,world(clear)[2]]),
        ('minimum-z',[world(clear)[0],0,f32(oz)]),
        ('outside-minimum-z',[world(clear)[0],0,f32(oz-30)]),
        ('maximum-grid-z',[world(clear)[0],0,f32(oz+height*12)])]
    for flags in [256,11]:
        index = next((i for i,(_,f) in enumerate(layer['cells']) if f == flags), None)
        if index is not None: positions.append((f'flag-{flags}-neighborhood',world((index%width,index//width))))
    return positions, blocked is not None and all(not valid[z*width+x]
        for z in range(max(0,blocked[1]-3),min(height,blocked[1]+4))
        for x in range(max(0,blocked[0]-3),min(width,blocked[0]+4)))

def run(command, delta, position):
    queries.clear(); attempts.clear()
    vec(POS,position); vec(LOOK,[1,0,0]); vec(FORWARD,[1,0,0]); vec(CENTER,[987,654,321])
    matrix = struct.pack('<19f',1,0,0,0,0,1,0,0,0,0,1,0,*position,1,48,7,48)
    uc.mem_write(MATRIX,matrix)
    for reg,value in [(UC_X86_REG_FPCW,0x27f),(UC_X86_REG_FPSW,0),(UC_X86_REG_FPTAG,0xffff)]:
        uc.reg_write(reg,value)
    uc.mem_write(STACK, struct.pack('<6I',STOP,POS,LOOK,FORWARD,command,1)
        +struct.pack('<3f',30,.5,delta)+struct.pack('<3I',MATRIX,CENTER,MAP))
    uc.reg_write(UC_X86_REG_ESP,STACK)
    uc.emu_start(0x435088,STOP,count=1000000)
    assert uc.reg_read(UC_X86_REG_EIP) == STOP and uc.reg_read(UC_X86_REG_ESP) == STACK+4
    assert bytes(uc.mem_read(MATRIX,76)) == matrix and vec(CENTER) == [987,654,321]
    result = bool(uc.reg_read(UC_X86_REG_EAX)&255)
    assert result == attempts[-1]['accepted']
    assert attempts[0]['command'] == command
    assert all(a['delta'] == f32(delta) for a in attempts)
    if len(attempts)>1:
        assert [a['command'] for a in attempts] == [command,4 if command in [5,8] else 3]
    final_command = attempts[-1]['command']
    if not result or final_command in [0,3,4]: assert vec(POS) == position
    if result and final_command in [1,2]:
        expected = f32(position[0]+(1 if final_command==1 else -1)*f32(30*f32(delta)))
        assert vec(POS) == [expected,position[1],position[2]]
    return dict(command=command,delta=delta,result=result,position=vec(POS),look=vec(LOOK),
        forward=vec(FORWARD),attempts=[dict(a) for a in attempts])

paths = sorted((ROOT/'recovery/output/verified/assets/data/Data/scn').rglob('*.nav'))
assert len(paths) == 25
maps = []
for path in paths:
    parsed = read_nav(path)
    assert len(parsed['layers']) == 1
    layer = parsed['layers'][0]
    current = dict(layer,raw=path.read_bytes(),cellOffset=parsed['gridOffset']+160)
    cell_bytes = current['raw'][current['cellOffset']:parsed['geometryOffset']]
    assert len(cell_bytes) == layer['width']*layer['height']*8
    unique.clear(); cells_observed.clear()
    uc.mem_write(MAP,struct.pack('<I',1))
    uc.mem_write(MAP+4,bytes.fromhex(layer['description'])
        +struct.pack('<6f3I',*layer['minimum'],*layer['maximum'],layer['width'],layer['height'],CELLS))
    assert u32(MAP+4+0xa0) == CELLS
    uc.mem_write(CELLS,cell_bytes)
    positions, whole_invalid = select_positions(layer)
    rows = []
    for label,position in positions:
        for command in range(9):
            for delta in [.05,.2]:
                row = run(command,delta,position)
                row.update(scenario=label,start=position)
                rows.append(row)
    assert any(row['result'] for row in rows if row['scenario']=='valid-neighborhood')
    assert all(not row['result'] for row in rows if row['scenario']=='invalid-neighborhood')
    assert any(not cell['inBounds'] for cell in cells_observed)
    assert any(cell['valid'] for cell in cells_observed)
    assert any(cell['inBounds'] and not cell['valid'] for cell in cells_observed)
    maps.append(dict(id=path.stem,source=str(path.relative_to(ROOT)),width=layer['width'],
        height=layer['height'],minimum=layer['minimum'],maximum=layer['maximum'],
        layerCount=1,cellOffset=current['cellOffset'],wholeInvalidNeighborhood=whole_invalid,
        suppliedPositions=positions,cells=list(cells_observed),rows=rows))
    print(f"PASS {path.stem}: {len(rows)} wrappers, {len(cells_observed)} distinct native indices",flush=True)

rows = [row for entry in maps for row in entry['rows']]
counts = dict(maps=len(maps),wrappers=len(rows),attempts=sum(len(row['attempts']) for row in rows),
    predicateCalls=predicate_calls,coordinateCalls=coordinate_calls,
    distinctMapIndices=sum(len(entry['cells']) for entry in maps),
    accepted=sum(row['result'] for row in rows),rejected=sum(not row['result'] for row in rows),
    retries=sum(len(row['attempts'])>1 for row in rows))
result = dict(status='PASS',entry='0x435088',trialEntry='0x434cee',counts=counts,
    scope='Original wrapper, collision sampling, coordinate conversion, bounds and cell predicate execute without service or mathematical substitutions. All 25 extracted original NAVs parsed by recovery/nav.py; cell bytes copied verbatim. Caller setup supplies TankType1, aligned directions, velocities30/.5, delta.05/.2 and footprint48x48; dimensions are a fixture, not recovered vehicle dimensions. Loader and upstream map selection are not executed.',
    layerEvidence='Observed loader0x45760e stores source maximum at layer+0x8c and minimum at layer+0x80, dimensions at+0x98/+0x9c and cell pointer at+0xa0. Map+0 is count; map+4 is an inline0xa4-byte layer, not a layer pointer. Every native4340c5 receives supplied map and layer index0; every45758f/433f92 uses map+4. All25 files have one layer; no multilayer or upstream map-selection behavior inferred.',
    maps=maps)
out = ROOT/'recovery/output'
(out/'movement-real-nav-native.json').write_text(json.dumps(result,indent=2)+'\n')
summary = f"PASS: {counts['maps']} real NAVs; {counts['wrappers']} original wrappers, {counts['attempts']} trials, {counts['predicateCalls']} cell calls, {counts['coordinateCalls']} world conversions.\nPASS: source bytes, native selected cell addresses, low-byte predicate, bounds, layer0, trial acceptance, retry commands, return/stack, fixed position on failure and unchanged matrix/center.\n"
print(summary,end='')
(out/'movement-real-nav-native.log').write_text(summary)
(out/'movement-real-nav-native.md').write_text(f'''# 原NAV上的原移动包装入口

{summary}

原EXE入口`0x435088`、试探`0x434cee`、位置换算`0x433f92`、边界`0x44ef9e`及单元查询`0x45758f`直接执行。只读观察核对每次单元调用的原NAV8字节、实际单元地址与返回值；格子附加字段低字节大于1才有效。独立按源minimum和原f32倒数计算向零取整下标。25份源文件路径、测试位置、每个不同下标的源偏移及字节、全部命令结果记录在JSON。

每张地图覆盖有效、无效、混合邻域，X/Z的minimum、minimum外侧及栅格上界，命令0–8和delta0.05/0.2。含256或11的地图另取相应格子邻域。重试{counts['retries']}次，成功{counts['accepted']}次，失败{counts['rejected']}次。

原加载器`0x45760e`把源maximum写入层+0x8c，minimum写入+0x80，宽高写入+0x98/+0x9c，单元指针写入+0xa0；夹具遵从此布局。map+4是内联0xa4字节层对象；并非层指针。所有`0x4340c5`调用的层参数均为0，所有原单元查询的ECX均指向map+4；25份原NAV均单层。

## 范围

地图对象由解析结果构造，单元原字节逐字复制；本脚本未执行原文件加载器或上游地图选择。车体48×48、矩阵中间值7、TankType1、初始look/forward同向、速度30及转速0.5为显式调用夹具，48×48不代表真实车辆尺寸。无数学或地图服务替换。成功转弯可来自组合命令失败后的转向重试；失败保持位置但可能改变方向。矩阵和center在包装入口内保持不变。
''')
