# 拥有战车部件子页

## 原来源事实

UI-58 / UI-57 / M5-10。原`shop_tankpage_part.xml`共有15个`Window`：根、Hat/Mark背景、五个PART背景和七个`pic*Icon`动态图。LabPage将根保存于`this+84`；Owned模式1挂到Tank根`this+8`，偏移`[0,36]`。原loader `43b62a`从TankTable第23列取得`TankPartSlot`；`4b2635`按该值显示前count组PART背景和对应动态图，剩余至5槽隐藏。原XML未记录七个动态图的`Image`或provider。

## 当前采用范围

Web采用选中拥有实例的只读三源：`Equipment QUERY + tankInstanceId`返回该实例`slots` / `decorationInstanceId` / `markInstanceId` / `slotCount` / 目标`tankInstanceId`，真实Inventory提供实例到`itemTableId`映射，CombatCatalog提供`iconId ?? itemTableId`。七图按Home图标规则映射到原`picHatIcon`、`picMarkIcon`、`picInternalIcon0/1`和`picExternalIcon0/1/2`；原控件矩形与`offsetY=36`保持，背景和图标只显示所选目录`partSlotCount`前N槽，空槽无图，inventory/catalog缺一不猜icon，不按`ownedQuantity`抹binding。

接口由现`ShopSource.equipment`稳定透传`battle.equipment`，页面只读查询，不调用`selectRole`、不写装备、不改变出击选择，不新增后端、协议或schema。target/mode/source/Close/Buy变化清旧目标与error，迟到响应不回挂；Equipment/Inventory bundle失败由独立part error经现status输出并复用现刷新重试。原购买、余额、模型、纹理、selection、字体和源布局保持。

## 参考与限制

完整客户端业务说明见`tank-shop-owned-part-client-business-design.md`，通信与采用规则见`client-communication-business-rules.md`。生产接线已完成；原动态图provider未恢复，实际页面、保存、HD与完整1:1验收未执行，UI-58/M5-10/M6-01父项保持未勾。
