# 原角色碰撞尺寸初值

完整原角色base构造器431bcf及联网角色构造器42275e各在0/55/aa/ff四种预填内存下执行，共8样本。原gbengine矩阵构造器10031f30也执行；唯一供应服务是由原PE导入表确认的CRT memcpy，按源64字节复制语义实现。

base的431d01/431d0b/431d15分别写role+2f8/+2fc/+300为f32的49/24/52，即role+2b8矩阵后部+40/+44/+48。矩阵前16float初始化为identity，role+28c中心与+2a0/+2a4/+2a8记录指针清零；联网构造器保留上述尺寸，改vtable为5c2c28并初始化联网字段。每个样本断言返回地址、栈、返回角色指针、matrix、尺寸和记录/中心。

因此此前48×48合成碰撞夹具只证明供应尺寸的包装行为，不是原战车尺寸来源。本证据证明初值，不能单独证明整个角色生命周期内不变；尚需检查后续矩阵/OBB别名赋值及战车定义/状态变更。尺寸不能由网页GLB包围盒或临时bodyRadius20猜算。

复现：`recovery/.venv/bin/python recovery/evidence/movement/role-movement-footprint-native.py`，已加入`npm run test:evidence:movement`。产物movement-footprint-native.json/log；静态候选写入记录movement-footprint-writes.txt仅用于定位，不作为全生命周期无修改证明。完整碰撞包装见role-movement-wrapper.md。
