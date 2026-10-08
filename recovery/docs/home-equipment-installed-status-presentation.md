# HomeEquipment Common/帽子/气球/标志已装备状态表现

范围：UI32 / M5-07。Common 与帽子/气球/标志装备名单的原状态 `1`→`E` 标识已接入正式 Web consumer，并在 production 接线；本文件登记已确认的目标链、两个角色范围、图像与共享 consumer，以及尚未实测的边界。

## 确认目标链

- 装备页按本车 target 查询 `equipment({operation:'QUERY', tankInstanceId})`，confirmed bundle 的 `equipment.tankInstanceId` 为本行所属战车。
- 原 Home `MyTank/lstEquip` 三分类工厂 Common `4e8a65`（分类5）、Hat/Balloon `4e8865`（分类3）、Mark `4e8651`（分类4）同读 `MyItem+0x1c == 2` 并以 `4bbcfd(1)` 写 `row+0x3c4 = 1`，共用 `4b9e77` 原行；详 home-role-equipment-row-status-source.md。
- 原 `4e8bd7` 的 `MyItem+0x1c == 2` producer 在当前 Web 采用为同 target 的绑定判定：

  ```ts
  equipment.bindings.some(binding =>
    binding.instanceId === row.instanceId &&
    binding.tankInstanceId === equipment.tankInstanceId)
  ```

- Common 行与帽子/气球/标志行都把本车已确认 target 的 `installed` 传给各自 row consumer。
- `selected`、任意全局 `inventory.state 2`、仅凭 `bindingName` 存在都不触发本页 `E`；未附加 `ownedQuantity > 0` 或当前槽位额外门禁，现 `available`/drag/槽位/QUERY/保存规则不改。

## 两个角色范围

- 目标 `E`：以上同 target 绑定判定，只标注本页该战车的已装备行。
- 全账号占用标签：`bindingName` 仍按账户级 bindings 显示库存被哪辆战车占用，可指向其它战车；该标签不触发本页 `E`，其它战车占用不画本页 `E`。
- Trade/Mend/Shop 复用同 row 但不传 `installed`，不扩入本 scope。

## 图像与共享 consumer

- `E` 为原 `SmallHT` 图片字符 `set:xiaoheitizi0 image:data\ui\xiaoheitizi\e.tga`，经 `sourceUiImage` 命中 `ui/regions/11/9.png`，自然尺寸 `14×14`。
- Common row 复用共享 `HomeRoleRowStatusBadge(status="installed")`；当前使用标识复用同一 consumer 的 `status="current"`（原 `N`，`ui/regions/11/10.png`），两者共用同一图像消费路径。
- 徽标为原 region 位图：`position:absolute; left:5px; top:8px; width:14px; height:14px; background-position:left top; background-size:14px 14px`，位于行局部坐标，随父级源页面 scale 缩放。
- 保留原 `current`/`installed` attr 与 ARIA（`本车已装备`）。这是采用表达：以原 `14×14` region 放入 point `(5,8)`，随父 scale；原静态图像不换成 `Xiangjiao` 动态字体。

## 不涉及新协议

- 复用已确认的 `equipment.tankInstanceId`、`equipment.bindings[].instanceId`、`equipment.bindings[].tankInstanceId` 与 row instance；不新增 server/API/schema 字段，不改现有 available/drag/slot/query/保存。

## 尚未实测边界

- 已具原静态 source 与 production 接线；普通 UI 实测、资源 decode、target 切换与确认拒绝、关闭重开、HD 门禁均未完成。
- 原 14-42-06 Common 名单旧 PNG 仍只含 name/icon/类别/天数/候选/Close，旧 Home 分类截图不含新 `E`/切 target/拒绝/关闭重开实测，不能复用宣 `E` 实测。
- 原 `Font::drawText` 内部像素放置/坐标轴/基线由 CEGUI 实现决定；两父 root 原 scale 供应为 Web 采用，不称 CEGUI 轴/pixel/Font baseline 恢复。
- 原来源映射与当前数据合同详 home-equipment-installed-status-source.md。
