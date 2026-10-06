# 拥有战车纹理的消息、存储与读取（M3-03 / M6-01）

拥有战车已选 U/M/XY 是原拥有装备记录 `+0x28/+0x2c/+0x30` 的三个 unsigned32 `tanktexture` 表 ID。现有 `OwnedRoleEquipmentRecord` 消息解码已按原宽度保留三个数值，独立共享函数 `readOwnedTankTextures(record)` 直接读取这三个槽，不需要新增存储字段。值0保持0；任一字段缺失时返回 `undefined`。

## 原消息到详情页的实际链

`0x421afe` 先读取名称，然后在原位写入 unsigned32 `+0x24/+0x28/+0x2c/+0x30`。定义与纹理槽处于同一原拥有记录，字段 `+0x1c` 是拥有实例索引键。原 `0x4225b4` 批量替换记录，执行真实构造、树插入与平衡；原 `0x421f36` 按实例读取该树并返回记录指针。现有 `readOwnedRoleEquipmentPacket`、`receiveOwnedRoleEquipmentBatch` 和 `resolveOwnedRoleTank` 已覆盖这份合同。

拥有详情 `0x4b73f5–0x4b7427` 保存实例到 UI `+0x1a0`，通过 GAME `+0x118` / 管理器 `+0x40` 调用真实 `0x421f36`，再取返回记录 `+0x24` 作为定义 ID。三段选中项比较 `0x4b67fc/0x4b68bf/0x4b6982` 则读取同一记录 `+0x28/+0x2c/+0x30`，与纹理表记录 `+0xc` 的 ID 作32位相等比较。这些值不是候选 vector 的索引或文件名。

本切片将原11个 `tankshop` 的数字配置作为显式消息夹具；另含全0、`0x80000001`、`0xffffffff`，均在8种 bit alignment 执行原解码和树存储，共112例。高位值只验证 unsigned32 保存，不作为有效纹理表记录。零值与真实非零候选 ID 比较时不匹配，保持零值不能替换为商城默认。

## 共享读取与验证

`apps/shared/combat/role-owned-textures.ts` 导出 `OwnedTankTextures {U, M, XY}` 和 `readOwnedTankTextures(record)`。完整原记录返回三个 unsigned32 表 ID；当前支持的导入夹具可能缺失槽位，因此完整性在字段存在性上判断，避免缺失值被位运算转换为0。

```sh
recovery/.venv/bin/python recovery/evidence/tank-textures/owned-tank-textures-sol-native.py
npx tsx recovery/evidence/tank-textures/owned-tank-textures-sol.cts
```

PASS：112例原拥有消息、存储、getter、详情定义读取和三槽比较；生产共享解码、实例查询及纹理读取与原结果逐项一致。CTS另检查三个缺失字段分别返回 `undefined`，并检查0与带符号JS输入的 unsigned32 数值保存。输出为 `recovery/output/owned-tank-textures-sol-native.json`。

这组检查识别三个槽位交换、字段宽度缩短、有符号转换、定义/实例混用、消息游标错位和零值默认回填。出现这些错误时，应阻止将共享读取结果接入页面。

## 限定范围

原批量解码、原数字 bit reader、真实树构造/插入/查询和详情 getter 有限段均执行原机器指令。分配/释放、空名称存储、详情列表构建边界和候选 vector 内存由夹具供给；选中匹配执行真实数量与索引 getter。

既有原消息3aab证据已证明两类拥有记录按原顺序解码；这里不再执行外层运输。商城数值用于显式夹具，未证明任何服务器赠送或账户授权。`specialtank` 转换、原角色属性32 producer、末端 actor文件加载与浏览器实载不在这份验收范围内。
