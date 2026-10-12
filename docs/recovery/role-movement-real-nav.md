# 原NAV上的原移动包装入口

PASS: 25 real NAVs; 4518 original wrappers, 6265 trials, 40144 cell calls, 20072 world conversions.
PASS: source bytes, native selected cell addresses, low-byte predicate, bounds, layer0, trial acceptance, retry commands, return/stack, fixed position on failure and unchanged matrix/center.


原EXE入口`0x435088`、试探`0x434cee`、位置换算`0x433f92`、边界`0x44ef9e`及单元查询`0x45758f`直接执行。只读观察核对每次单元调用的原NAV8字节、实际单元地址与返回值；格子附加字段低字节大于1才有效。独立按源minimum和原f32倒数计算向零取整下标。25份源文件路径、测试位置、每个不同下标的源偏移及字节、全部命令结果记录在JSON。

每张地图覆盖有效、无效、混合邻域，X/Z的minimum、minimum外侧及栅格上界，命令0–8和delta0.05/0.2。含256或11的地图另取相应格子邻域。重试1747次，成功703次，失败3815次。

原加载器`0x45760e`把源maximum写入层+0x8c，minimum写入+0x80，宽高写入+0x98/+0x9c，单元指针写入+0xa0；夹具遵从此布局。map+4是内联0xa4字节层对象；并非层指针。所有`0x4340c5`调用的层参数均为0，所有原单元查询的ECX均指向map+4；25份原NAV均单层。

## 范围

地图对象由解析结果构造，单元原字节逐字复制；本脚本未执行原文件加载器或上游地图选择。车体48×48、矩阵中间值7、TankType1、初始look/forward同向、速度30及转速0.5为显式调用夹具，48×48不代表真实车辆尺寸。无数学或地图服务替换。成功转弯可来自组合命令失败后的转向重试；失败保持位置但可能改变方向。矩阵和center在包装入口内保持不变。

## 正式地图数据对应

`tests/role-movement-navigation.cts`从上述原执行证据读取2997个不同查询下标，核对实际Battlefield/NavigationGrid的25地图层边界、宽高、源NAV相应8字节和正式导出的单元字节，及cellAt高度/flags/有效性/越界。所有匹配。该对照证明所选层与单元数据对应，不代表Battlefield.move的中心扫掠/盒体/半径20等价于原多点采样或原静态/角色门禁。实际原loader和上游地图选择仍未执行。
