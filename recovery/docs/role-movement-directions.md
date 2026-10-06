# 原水平移动数学

PASS: 11808 original horizontal movement calls; every command/type, original math entry and recovered direction branch executed.

`0x4344e7`及`0x434032/0x4340fd/0x434241`完整执行，无数学替换。JSON保留独立原代码输入/输出，并记录各数学入口及方向条件分支执行次数。

命令0–8、类型1–4，三个世界朝向、11种有符号look/forward夹角（含零、近对齐、近反向），另补轴向精确反向，八组move/turn/dt及两种方向长度。半径覆盖下限80、恰好80及360。原地转向在指定侧超过约π/2后更新forward；组合命令使用2倍转角旋转forward及3倍转角条件阈值，包含保持、旋转、越过后重设。直行夹角不超过转角时直接对齐。

## 范围

模块恢复水平非零look/forward，非负dt及正move/turn；输入和原中间f32存储使用Math.fround。原x87超出JavaScript双精度的内部精度及acos、sin/cos不宣称逐位一致；TS测试以原输出核对，位置容差0.0002、方向容差0.000002。非水平和零turn的圆弧、外部指定转弯中心、碰撞及上游控制不在此切片内。任意朝向的精确反向f32向量可能使原点积小于-1；原代码没有clamp，其CRT acos错误路径不在证据内，模块对此抛出RangeError。
