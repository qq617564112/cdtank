# 原运动全命令执行

144组完整`0x4344e7`执行通过：command0–8 × TankType1–4 × look/forward同向或垂直 × delta0.05/0.2。每组断言位置、look、forward解析公式及原返回栈。数学入口`0x434032`（转心）、`0x4340fd`（原地转向）、`0x434241`（方向对齐）、`0x57454b`（轴旋转）、`0x424043`（归一化）、`0x431ba8/0x57b784`（点积角度/acos）、`0x41d98e`（分量限制）均执行原指令；hook仅统计入口，不替代服务。

## 已验证公式

本组位置P=[10,0,20]、look L=[1,0,0]，forward F=L或[0,0,1]；v=30、w=0.5。d=float32(v×float32(delta))，a=float32(w×float32(delta))，r=max(v/w,80)=80，b=float32(d/r)。方向D(q)=[cos(q),0,sin(q)]，角度按原+Y轴旋转符号换算为X/Z平面角。

| command | 位置结果 | look |
| --- | --- | --- |
| 0 | P | L |
| 1 | P+[d,0,0] | L |
| 2 | P−[d,0,0] | L |
| 3 | P | D(−a) |
| 4 | P | D(a) |
| 5 | P+[r sin(b),0,r(1−cos(b))] | D(b) |
| 6 | P+[r sin(b),0,−r(1−cos(b))] | D(−b) |
| 7 | P+[−r sin(b),0,r(1−cos(b))] | D(−b) |
| 8 | P+[−r sin(b),0,−r(1−cos(b))] | D(b) |

位置按look方向推进，forward是另一独立方向，不能将两者互换。command1/2没有额外倒退速度折扣。组合5–8按半径弧线推进，look角增量是d/r；半径被限制到80时，与w×delta不同。

TankType4对每个非零command将forward直接复制为更新后的look。TankType1–3本组同向输入：command0–4保留F；command5/8的F=D(2a)，command6/7的F=D(−2a)。本组垂直输入：command1/2/3的F=D(π/2−a)，command4/5/8保留F，command6/7的F=D(π/2−2a)。这些断言验证原对齐的实际方向分支，并非所有初始夹角的统一公式。

例如delta0.2：直行/倒退X=16/4；command5位置约[15.994377,0,20.224899]、look约[0.997189,0,0.074930]；Type1同向forward约[0.980067,0,0.198669]，Type4 forward等于look。

## 边界

本入口直接接受delta，不执行上游`0x433190/0x435088`截断、controller命令门禁、地图碰撞`0x434cee`或失败回退，也未执行上游时钟生产。范围仅上述两种初始方向与v/w组合；未验证其他夹角的对齐/越过分支、非水平向量及其他速度半径。没有接入生产actors。

复现：`recovery/.venv/bin/python recovery/evidence/movement/role-movement-commands-native.py`。JSON保存原执行与公式期望，disasm保留指令和命令跳表，log保存通过结果。
