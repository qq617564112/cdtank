"""Execute original movement mathematics over horizontal directions and radii."""
from pathlib import Path
import json
import math
import struct
import sys
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import (UC_X86_REG_ESP, UC_X86_REG_EIP, UC_X86_REG_FPCW,
    UC_X86_REG_FPSW, UC_X86_REG_FPTAG)
ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT/'recovery'))
from effect_native import map_original_binaries
uc,_ = map_original_binaries([ROOT/'CDTank/CDTank.exe'])
uc.mem_map(0x2000000,0x20000)
STACK,STOP,POS,LOOK,FORWARD,OUT = [0x2001000+i*0x1000 for i in range(6)]
def f32(v): return struct.unpack('<f',struct.pack('<f',v))[0]
def vector(a,v=None):
    if v is not None: uc.mem_write(a,struct.pack('<3f',*v))
    return list(struct.unpack('<3f',uc.mem_read(a,12)))
def direction(a,scale=1): return [f32(math.cos(a)*scale),0,f32(math.sin(a)*scale)]
entries={a:0 for a in [0x4344e7,0x434032,0x4340fd,0x434241,0x57454b,0x424043,0x431ba8,0x57b784,0x41d98e]}
branches={a:0 for a in [0x4341da,0x434218,0x434355,0x4343c6,0x4343d0,0x43441e,0x434495,0x43449f,0x4344dd,0x4344b5]}
def observe(m,a,n,d):
    if a in entries: entries[a]+=1
    if a in branches: branches[a]+=1
for a in list(entries)+list(branches): uc.hook_add(UC_HOOK_CODE,observe,begin=a,end=a)
rows=[]
for command in range(9):
    for tank_type in range(1,5):
        for heading in [0,.71,-2.1]:
            for gap in ([-math.pi+.001,-2,-.5,-.1,-.00005,0,.00005,.1,.5,2,math.pi-.001]
                    + ([-math.pi,math.pi] if heading == 0 else [])):
                for move,turn,dt in [(30,.5,.05),(30,.5,.2),(180,.5,.2),(80,1,.2),(12,2,.2),(30,.5,0),(137.3,.73,.13),(80.001,.9999,.17)]:
                    for scale in [1,1.7] if gap in [0,.5] else [1]:
                        position=[f32(10.25),f32(3.5),f32(-20.75)]
                        look=direction(heading,scale);forward=direction(heading+gap,scale)
                        vector(POS,position);vector(LOOK,look);vector(FORWARD,forward)
                        uc.mem_write(STACK,struct.pack('<7I',STOP,OUT,POS,LOOK,FORWARD,command,tank_type)
                            +struct.pack('<3fI',move,turn,dt,0))
                        for reg,value in [(UC_X86_REG_ESP,STACK),(UC_X86_REG_FPCW,0x27f),
                            (UC_X86_REG_FPSW,0),(UC_X86_REG_FPTAG,0xffff)]:uc.reg_write(reg,value)
                        uc.emu_start(0x4344e7,STOP,count=100000)
                        assert uc.reg_read(UC_X86_REG_EIP)==STOP and uc.reg_read(UC_X86_REG_ESP)==STACK+4
                        output=dict(position=vector(POS),look=vector(LOOK),forward=vector(FORWARD))
                        assert all(math.isfinite(v) for values in output.values() for v in values)
                        if command==0: assert output==dict(position=position,look=look,forward=forward)
                        if tank_type==4 and command!=0: assert output['forward']==output['look']
                        rows.append(dict(input=dict(position=position,look=look,forward=forward,
                            command=command,tankType=tank_type,move=move,turn=turn,dt=dt),
                            heading=heading,gap=gap,scale=scale,output=output))
assert all(entries.values()) and all(branches.values()),(entries,branches)
result=dict(status='PASS',entry='0x4344e7',rows=rows,
    executedEntries={hex(a):n for a,n in entries.items()},
    executedBranches={hex(a):n for a,n in branches.items()},
    scope='Original horizontal mathematical commands0..8/types1..4; signed gaps, near alignment and opposition; minimum80, equality80 and free radius360; varied speed, turn and elapsed including0. Nonunit directions also supplied. Original math executes without substitution. Collision/controller not executed; nonhorizontal and zero-turn arcs outside this module evidence.')
out=ROOT/'recovery/output'
(out/'movement-directions-native.json').write_text(json.dumps(result,indent=2)+'\n')
summary=f'PASS: {len(rows)} original horizontal movement calls; every command/type, original math entry and recovered direction branch executed.\n'
(out/'movement-directions-native.log').write_text(summary)
(out/'movement-directions-native.md').write_text('''# 原水平移动数学

'''+summary+'''
`0x4344e7`及`0x434032/0x4340fd/0x434241`完整执行，无数学替换。JSON保留独立原代码输入/输出，并记录各数学入口及方向条件分支执行次数。

命令0–8、类型1–4，三个世界朝向、11种有符号look/forward夹角（含零、近对齐、近反向），另补轴向精确反向，八组move/turn/dt及两种方向长度。半径覆盖下限80、恰好80及360。原地转向在指定侧超过约π/2后更新forward；组合命令使用2倍转角旋转forward及3倍转角条件阈值，包含保持、旋转、越过后重设。直行夹角不超过转角时直接对齐。

## 范围

模块恢复水平非零look/forward，非负dt及正move/turn；输入和原中间f32存储使用Math.fround。原x87超出JavaScript双精度的内部精度及acos、sin/cos不宣称逐位一致；TS测试以原输出核对，位置容差0.0002、方向容差0.000002。非水平和零turn的圆弧、外部指定转弯中心、碰撞及上游控制不在此切片内。任意朝向的精确反向f32向量可能使原点积小于-1；原代码没有clamp，其CRT acos错误路径不在证据内，模块对此抛出RangeError。
''')
print(summary,end='')
