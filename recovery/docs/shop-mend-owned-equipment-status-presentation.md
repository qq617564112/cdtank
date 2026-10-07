# 商城/维修中心拥有部件行当前角色已装备状态表现

范围：UI54 / UI55 / M5-10。原 `ShopEquipPage/lstMyEquip` 拥有行的 `#808080` 文本状态、
原 `ShopEquipPage/lstShopEquip` 可售行的无状态、以及原 `ShopMendPage/lstPart` 拥有行的
静态 `SmallHT E` 已接入正式 Web consumer 并在 production 接线。本文件登记原来源、实际
producer→consumer、字段等式、生命周期、分类精度与当前门禁，并区分当前角色安装与全账户
占用。新状态无实测。

## 原来源

- 商城拥有 `ShopEquipPage/lstMyEquip`：Common `515410`、Hat/Balloon `515684`、Mark
  `515912` 三个工厂共用行类 `4ba7df`、vtable `5ceef8`、状态成员 `+0x4ec`。工厂在行加入
  列表后检查 `[MyItem+0x1c] == 2`，命中时 `4bc85e` 写 `[row+0x4ec] = 1`。draw `4bac37`
  在 `4bad42` 只按 `+0x4ec` 是否为零在 `-1` 与 `0xff808080` 间切换文本颜色，不画 `E`。
- 商城可售 `ShopEquipPage/lstShopEquip`：Common `514de4`、Hat/Balloon `514f42`、Mark
  `515097` 三支用同一行类建立，但没有状态 setter，现有来源保持 `[row+0x4ec] = 0`。
- 维修 `ShopMendPage/lstPart`：入口 `518f8a` 三支（Common `0` / Hat/Balloon `1` / Mark `2`）
  共用行类 `4b9e77`、vtable `5ceee0`、状态成员 `+0x3c4`。同样的 `[MyItem+0x1c] == 2`
  命中经 `4bbcfd` 写 `1`；draw `4ba194` 在 `4ba501` 读状态，`1` 在 `4ba6f7` 绘制静态
  `SmallHT` `E`，状态点 `(x+5, y+8)`、尺寸 `14×14`。
- 原 `OwnedTank`/`OwnedPet` 维修构造状态 `0` 的结论不变，不在本 scope。原 5ceef8（商城灰字）
  与 5ceee0（维修 E）不得互推。
- 详 shop-mend-owned-equipment-status-source.md。

## 实际 producer → consumer

- 当前角色安装等式：

  ```ts
  installed =
    category === 'Common'
      ? slots.includes(row.instanceId)
      : category === 'Hat'
        ? decorationInstanceId === row.instanceId
        : markInstanceId === row.instanceId;
  ```

  字段来自只读 profile：`slots[0..4] = u32le(profile.bytes, 0x148 + slot*4)`、
  `decorationInstanceId = u32le(profile.bytes, 0x118)`、
  `markInstanceId = u32le(profile.bytes, 0x13c)`。profile 缺席或短于字段时按未知 `false`。
- 商城拥有 `PartShopView`：`partSale({operation:'QUERY'})` 的 `sale.profile` 即上述只读
  profile；`profileInstalled(sale?.profile, ownedCategory, instanceId)` 派生 `installed`，
  经 `ShopSourceListEntry.installed` 传给 `PartShopSourceList` → `PartShopRowContent`。
  只对真实拥有行（`lstMyEquip`）生效；product 行不传 `installed`，`PartShopRowContent`
  亦以 `installed === true && !product` 为着色门禁。命中时只用已有
  `SourceFeedbackText.colour` 把名称/类别/天数/售价四段文本置 `#808080`，不灰 icon、
  不灰整行、不换 `E`。
- 维修拥有部件 `MendShopSourcePage`：既有 bundle 为
  `tankMaintenance({operation:'QUERY'})` → `partMaintenance({operation:'QUERY'})` →
  `roleProfile()` 优先取 profile；`profileInstalled(profile?.profile, category, instanceId)`
  派生 `installed`。`MendPartRowContent` 新增可选 `installed`，命中时在 icon 之后渲染既有
  `HomeRoleRowStatusBadge status="installed"`（静态原 `SmallHT` `E`）。
- 商城可售 `lstShopEquip`：不传 `installed`，保持无状态，不灰行。

## 字段与生命周期

- 状态是纯 render/refresh bundle 派生，不入库、不写 server、不增协议或字段。
- 商城：每次 refresh（挂载、原 `setSale` 刷新覆盖、购买后重查）用当次 bundle 重算；
  owned 分类切换与重新查询重建，不沿用上一角色或上一分类缓存。SELL 结果经原
  `setSale(result)` 覆盖 `sale`，含同一只读 profile。商城拥有不新增
  `ShopSource.roleProfile()` fallback QUERY。
- 维修：effect 按 `source`/`onBusy` 每次挂载重建 bundle；原 MAINTAIN 覆盖
  `setProfile({profile: result.profile})`，与既有报价/资格/墙钟/事务同链，不新增协议。

## 分类与精度

- 商城：`515684`（拥有 Hat/Balloon）与 `514f42`（可售 Hat/Balloon）均按 `439762 == 5`；
  Web 商城 Hat 筛选保持 `classifyItemId === 5`，未把气球外推。
- 维修：`518f8a` coarse `3` 的真实分类覆盖帽子 `5` 与气球 `6`；Web 维修 Hat 筛选为
  `classifyItemId === 5 || 6`。
- 当前可售目录没有气球/标志记录，保持缺少，不造商品、价格或记录。

## 当前角色与全账户占用

- 本状态源是当前角色的安装关系，对应 `515410/515684/515912` 的 `MyItem+0x1c == 2` 与
  `518f8a` 三支的同一比较。
- 全账户 `AccountStore.inventory().records[].state === 2` 由所有战车的
  `tankEquipment.bindings(accountId)` 写入，可指向其它战车；不能替代本状态。
- `selected`、`ownedQuantity > 0`、槽位、价格、`canMaintain`、绑定标签都不推出本状态。

## 当前门禁

- 已 production 接线，一次集中静态走查已完成；原普通页面、资源 decode、生命周期、切页/切分类/重开与 HD 仍待实测。
- 新 `#808080` 灰字与维修 `E` 均无实测；不复用旧 PNG 或 native 向量宣其通过。
- 行几何与文本字体为 Web 采用：复用现 `Xiangjiao` 用户选字体与源布局；`E` 仍为静态原
  `SmallHT` `e.tga`（region `11/9`），不称原字库 renderer/像素或 HD 恢复。
- 父 UI54/UI55/M5-10/M6-01 未满足项保持 `[ ]`。
- 原来源映射与当前数据合同详 shop-mend-owned-equipment-status-source.md。
