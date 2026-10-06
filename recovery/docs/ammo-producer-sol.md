# 实体开火请求与弹量生产边界

M2-02：原实体瞄准入口 `0x4288fe` 在目标角色存在、场景物件目标不存在时发送 `0x3a9d`，随后按当前槽查找物件并通知本机装填。完整分支没有改变角色弹量、拥有数量或本局库存数量，也没有发送 `0x3ab5` 确认。240组原执行与8组原位流编解码已通过。

## 原执行合同

- `0x4252ea` 经 `0x42409a/0x402289` 构造请求，安装虚表 `0x5c3188`。实际 `0x4240cd` 返回类型 `0x3a9d`。
- `0x428ad9` 调用目标角色整数getter18，取得记录 `+0x0c` 对象ID，写入消息 `+0x0c`。
- `0x422d90` 分别写入发射角色及目标角色的状态快照，位于消息 `+0x10/+0x34`，各36字节。快照含角色 `+0x258` DWORD、固定参数2、位置x/z、两方向量化值、相对时钟f32，以及记录 `+0x48/+0x4c` 两个float。方向量化、两个角色getter和原float转换均实际执行。
- 目标存在视觉对象时，`0x435745` 返回0至3分别调用视觉virtual `+0x88`，参数1至4；返回4不调用。该视觉调用发生在发送之前。
- `0x413e8c` 发送后，当前槽0或1直接通知物件2001；槽2或8经实际数组getter及 `0x43d186` 查到库存实例后，用记录 `+0x0c` 表ID通知。特殊槽库存缺失时，请求仍已发送，但不调用装填通知，原截止时间保持。
- 实际 `0x423092` 读取当前弹量，值恰好为1取角色 `+0x54`，其他值取 `+0x50`；写入f32相对时钟与时长之和到角色 `+0x9c`，再报告时长。该通知不减弹、不补弹。

240组覆盖当前弹量0/1/2/5/ffffffff、槽0/1/2/8、库存存在/缺失、目标视觉存在/缺失和五种分类返回。当前弹量0的库存本局数量也设为0，原分支仍发送请求；这只证明本入口未拒绝该夹具状态，不证明外层普通输入或服务器会接受零数量开火。每组保存发射/目标完整数字记录及库存记录，返回后逐字节一致；运行时写监视器确认无弹量/库存数量字段写入。角色flag12被清零，截止时间仅在完成装填通知时改变。

## 原请求352位线路

实际writer `0x42531d` 与reader `0x425353` 通过状态writer `0x41d8c9` 与reader `0x41d84c` 处理352位正文：先写32位目标ID，再各写160位发射/目标快照。每个快照依次为x32、z32、方向字段 `+0x14` 16、方向字段 `+0x10` 16、字段 `+0` 16、字段 `+4` 16、时间32。均为原LSB-first位流。

内存快照 `+0x1c/+0x20` 的两个float不进入该线路。reader也不改这两个位置；测试以aa预填，读回后仍为aaaaaaaa，不能为它们声明解码默认值。快照字段 `+0` 与 `+4` 的高16位不写出，读回保留低16位。8种起始位偏移的实际payload、读满位数与解码字段已逐项核对。

## 验证与证据

运行 `recovery/.venv/bin/python tests/role-ammo-producer-sol-native.py`。结果为240组完整实体请求及8组352位codec通过。

- 测试：`tests/role-ammo-producer-sol-native.py`
- 原执行JSON：`recovery/output/role-ammo-producer-sol-native.json`
- 运行日志：`recovery/output/role-ammo-producer-sol-native.log`

## 共享实体请求模块

`apps/shared/combat/role-entity-fire.ts` 提供类型 `RoleEntityFireSnapshot`、`RoleEntityFireRequest` 与以下接口：

- `createRoleEntityFireRequest(targetObjectId, actor, target)`：复制目标ID和两份完整九DWORD快照，按原32位内存保存。所有字段必须由调用方提供；方向为已经量化的整数，三个float线路字段为原始32位位值。
- `encodeRoleEntityFireRequest(request, startBit = 0)`：只编码已验证的352位正文，不带envelope。快照 `field00/field04/direction10/direction14` 仅编码低16位；尾部 `field1cBits/field20Bits` 不写出。
- `decodeRoleEntityFireRequest(bytes, preserved, startBit = 0)`：调用方必须显式提供 `actorTailBits/targetTailBits`，各为两个DWORD。这四个值被保留到返回的36字节快照；线路中不存在这些字段，接口不生成默认值。

`field00/field04` 分别对应快照 `+0/+4`；`xBits/zBits` 对应 `+8/+c`；`direction10/direction14` 对应 `+10/+14`；`secondsBits` 对应 `+18`；`field1cBits/field20Bits` 对应 `+1c/+20`。本实体分支从角色 `+258` 取得field00，显式参数2写field04，位置x/z与相对时钟写对应float位；尾部来自实际记录 `+48/+4c` getter。接口使用原偏移名称保留尚未确定的业务语义。

运行 `npx tsx tests/role-entity-fire-sol.cts`。独立构造的请求逐项对照240组原执行发送正文，每组对照八种原payload；八种原解码结果、字段高位截断、显式aa尾部保留和实际float尾部保留通过。短报文拒绝为共享模块入口检查。共享结果与日志：`recovery/output/role-entity-fire-sol.json/.log`。

## 限制

角色/目标查询、阶段、场景目标查询、视觉分类、相对时钟、最终网络发送及观察者边界由夹具供给；场景物件目标和两种目标同时存在的距离选择分支未执行。角色getter、消息构造/析构、两次状态快照、方向量化、特殊槽库存查找、装填通知与codec实际执行。

原服务器已丢失。当前证据不能确定3a9d成功判定、服务端耗弹/补弹、属性8/库存删除消息的产生条件，或3ab5与这些操作的先后关系。客户端请求、属性接收和确认接收是分开的合同；此入口未提供可实现的原耗弹producer，未新增共享producer模块。
