# HomeEquipment Common 已装备状态原来源与当前数据合同

范围：UI32 / M5-07 Common 名单。内容限定为原 `4e8a65` Common factory 的已装备
状态来源、`state 1` 的 `E` 字形/字体/绘制点，以及当前 Equipment target bundle 到
该状态的业务映射。

## 原工厂与字段

- 原列表 `MyTank/lstEquip` 的 controller 列表成员是 `controller+0x13c`；分类入口
  `4e8621` 的 Common 分支进入 `4e8a65`。
- `4e8a65` 经 `[0x633588]+0x120` 读取当前角色；`4e8ada..4e8ae6` 取
  `[+0x120]+0x5c`，`4e8b2b/4e8b2e` 从该角色实例区间构造遍历边界。
- 循环 `4e8b36` 对 `edi` 指向的实例调用分类 `43bd09`；`4e8b3d` 只接受结果
  `5`（Common）。`4d8366/4d83b3/4d849e` 产生名称、类别、天数文本，
  `4b9e77` 构造 `161x56` Common 行，vtable 为 `5ceee0`。
- 原已装备状态读取实例 `MyItem+0x1c`：`4e8bd5` 取当前实例，`4e8bd7` 比较
  `[instance+0x1c] == 2`。命中时 `4e8bdd/4e8be0` 以新行 `ecx` 压入 `1`，
  `4e8be2` 调用 setter `4bbcfd`；`4bbcfd` 只执行
  `mov [ecx+0x3c4], eax` 后 `ret 4`。所以原 source state `2` 映射为
  Common 行 `row+0x3c4 = 1`。
- `4b9e77` 在 `4b9ef7` 将 `[row+0x3c4]` 初始化为 `0`；非命中路径不调用
  setter。`4e8bd7` 只有 `MyItem+0x1c == 2` 比较，不在此原 source 点附加
  `ownedQuantity > 0`、当前槽位或其它业务资格门禁。

Hat/Mark preparation JSON 明确记录 category2 factory 在 `4e87a4` 调用同一
`4b9e77`，并在 `4e87c5..4e87cf` 以同一 `MyItem+0x1c == 2` 比较调用同一 setter
`4bbcfd`。因此由该 category2 factory 构造的行共享本状态合同；没有同 setter/
factory 来源的其它分类不扩入 Common 合同。

## 字体、字形与绘制点

- Common 行构造在 `4ba11c` 压入 `0x5cedf4`；`4ba138` 经
  `[0x5c03e4]`（`CEGUI::FontManager::getSingleton`），`4ba140` 经
  `[0x5c03b4]`（`getFont`），`4ba146` 将字体指针写入 `[row+0x3c8]`。
  `0x5cedf4` 的原字符串是 `SmallHT`。
- Common draw 为 `4ba194..4ba7dc`。`4ba1a7..4ba1be` 检查
  `[row+0xa4]` 与 `[row+0x10c]`；`4ba258..4ba273` 复制行矩形后，加
  `[0x5ccfe0] = 5.0` 到 x、`[0x5e68b0] = 8.0` 到 y，得到状态绘制点
  行局部 `(x+5, y+8)`。
- `4ba4d1` 检查 `[row+0x3c8]` 字体非零，`4ba501` 读取 `[row+0x3c4]`。
  source state `1` 分支为 `4ba6f7`，原字符串对象 `0x5c192c` 的值是 `E`；
  `SmallHT` 的 `data\ui\xiaoheitizi\e.tga` 导出为
  `ui/regions/11/9.png`，原尺寸 `14x14`。
- 状态分支以 `(x+5, y+8)` 的零尺寸矩形调用
  `[0x5c02d8]`（`CEGUI::Font::drawText`）；`14x14` 是 glyph 资源尺寸，不是
  额外指定的目标矩形。draw 在 `4ba7dc` `ret 0xc`。

## 原 `43ed18` 的 per-role 范围

- `43ed18` 先经 `4269c4` 取当前角色；遍历 `[ebp+8]+0x10` 记录树，将记录
  `+0x1c` 清零，并按 `43bd09` 分类投放到同一角色结构
  `+0xc/+0x1c/+0x2c/+0x3c/+0x4c/+0x5c/+0x6c/+0x7c` 各分组。
- `43ee80..43ee91` 以 getter ID `0x2c`、`43eeb6..43eec7` 以 getter ID
  `0x2d` 经 vtable `+0x18` 调用，分别对应 `field44/field45`；
  `43eeec..43ef28` 以数组 ID `1`、`43ef3f..43ef73` 以数组 ID `2`
  经 vtable `+0x20` 调用，分别对应 `array1/array2`。这些 getter 对应实例
  匹配后写 `[record+0x1c] = 2`。对应 shared `applyInventoryQuery` 的
  `InventoryRoleBindings {field44, field45, array1, array2}`。
- 因此原 Common factory 消费的 `MyItem+0x1c = 2` 是当前角色的查询结果，
  不是账户内任意战车或所有 inventory `state 2` 的全局集合。`4e8a65`
  也只遍历 `[0x633588]+0x120` 当前角色的实例区间。

## 当前业务数据入口

- `HomeEquipmentView` 发起 `equipment({operation:'QUERY', tankInstanceId})`。
  `NetworkAccounts.equipment` 将原请求透传到 `Equipment`；server
  `accounts/api.ts:157` 的 QUERY 分支已经调用
  `accounts.equipment(accountId, combatCatalog, call.req.tankInstanceId)`
  (`:165`)，response 已在 `:176` 返回
  `tankInstanceId: result.tankInstanceId` 与 `bindings: result.bindings`。
- `AccountStore.equipment(accountId, catalog, tankInstanceId)` 将请求目标临时投影到
  profile `+0xa8`，调用 `AccountTankEquipment.initialize/trim`，再返回该 target
  投影的 `slots`、`decorationInstanceId`、`markInstanceId`、`tankInstanceId`，
  同时返回 `AccountTankEquipment.bindings(accountId)`。
- `AccountTankEquipment.bindings(accountId)` 在
  `apps/server/src/accounts/tank-equipment.ts:56` 直接查询本账号全部
  `tank_equipment` 行，返回全部战车的 `{tankInstanceId, target, slot,
  instanceId}`；它不按当前 target 过滤。`project` 仅在写 target 投影时用
  `binding.tankInstanceId === tankId` 过滤槽位和装饰/标记。
- `HomeEquipmentView.bindingName` 对单个 inventory instance 调用 `bindings.find`
  时不 filter `tankInstanceId`。这是有意的占用说明：标签用于告知该库存被哪辆
  战车绑定，其它战车占用仍显示其战车名称。该 `bindingName` 范围是账户级
  bindings，不是原 `43ed18` 的 per-role 查询范围。
- 当前 `inventory.state 2` 由 `AccountTankEquipment` 的持久写入维护，表示该实例
  已绑定到账号内某辆战车；只有 `state 2` 无法指出是否为当前 target。显式选中
  战车到 Equipment 请求 `tankInstanceId` 的映射是当前 Web 采用；
  `inventory.state 2`、任意 `selected` 或 `bindingName` 存在均不能替代 target
  条件。

## 可实施采用合同

- 未来 Common `E` 位图的唯一采用条件：

  ```ts
  equipment.bindings.some(binding =>
    binding.instanceId === row.instanceId &&
    binding.tankInstanceId === equipment.tankInstanceId)
  ```

  即由本批 `equipment({operation:'QUERY', tankInstanceId})` 确认的
  `equipment.tankInstanceId` 与该行 instance 的 binding 同时匹配。
- 允许继续使用现有 `bindingName` 向用户显示该库存被哪辆战车占用；不得把它作为
  `E` 位图条件。不得用任意 selected、任意全局 `inventory.state 2`，或仅凭
  `bindingName` 存在绘制本 target 的 `E`。
- 原来源关系保持为：`43ed18` per-role `MyItem+0x1c = 2` → Common factory
  `4e8a65` 的 `row+0x3c4 = 1` → draw `4ba6f7` 的 `E`
  (`ui/regions/11/9.png`, `SmallHT`, `14x14`, 行局部 `(x+5, y+8)`)。
- 当前已确认 bundle 已包含实现该采用条件所需的 target、
  `equipment.bindings[].instanceId`、`equipment.bindings[].tankInstanceId` 与
  row instance；不新增 server/API/schema 字段。
- 库存数量、当前业务资格和当前 slot 资格不属于本原 source 合同，不加入
  `4e8bd7` 的最小 consumer 条件。

## Known Issues

- 原 `Font::drawText` 的内部位图像素、坐标轴与基线由 CEGUI 实现决定。
- Common draw 的其它状态分支没有在本 Common factory 来源内恢复 producer。
- UI、HD 与 runtime 显示未实测。
