# 商城拥有战车部件客户端业务设计

对应UI-58、UI-57、M5-10与M6-01。该页面只在Owned模式为所选拥有战车实例显示原部件子页；读取和图标映射均为只读，不改变账户、装备、钱包或出击战车。

## 原来源事实

原`shop_tankpage_part.xml`共15个`Window`：`SheetWindow`根、`bgHatIcon`、`bgMarkIcon`、`bgInternalPart0/1`、`bgExternalPart0/1/2`、`picHatIcon`、`picMarkIcon`、`picInternalIcon0/1`和`picExternalIcon0/1/2`。背景控件给出槽底图；七个动态`pic*Icon`没有`Image`字段。

LabPage将原part root保存到`this+84`。Owned模式1通过子窗挂到Tank根`this+8`，偏移为`[0,36]`。原loader `43b62a`从TankTable第23列取得`TankPartSlot`；`4b2635`按该值同时显示前count组PART背景和对应动态图，其余至第五槽隐藏。`tank-shop-part-parent-source.json`明确七个动态图的原provider未知，且旧的`Equipment QUERY`边界只证明当前出击战车，不能替代拥有名单中选中的非当前实例。

## 入口与接口

商城Tank拥有页进入原Part子页。`ShopSource`暴露现有可选`equipment(request: ReqEquipment): Promise<ResEquipment>`，由实际`battle.equipment`稳定透传，保留方法接收者。

`TankShopView`在Owned模式选中拥有实例后，只对目标`tankInstanceId`发起`Equipment QUERY`，并读取真实Inventory与已发布`combat-catalog.json`。响应目标必须与当前拥有选择一致；不把当前出战profile当作所选非当前实例。查询不调用`selectRole`，不写装备，不临时切换账户选择，不新增后端、协议或schema。

图标解析采用Home装备页已确认规则：由真实Inventory把绑定实例解析为`itemTableId`，再从CombatCatalog取`iconId ?? itemTableId`，构造`set:daoju0 image:data\ui\daoju\NNNNN.tga`。Inventory实例或catalog定义缺一时不生成图标，不以quantity或猜测字段代替。

## 源控件映射

| 原控件 | Web数据 |
| --- | --- |
| `bgHatIcon`、`bgMarkIcon` | 原Hat/Mark槽底图保持 |
| `bgInternalPart0/1`、`bgExternalPart0/1/2` | 所选目录`partSlotCount`前N个PART背景可见，其余隐藏 |
| `picHatIcon` | 目标实例`decorationInstanceId`对应图标 |
| `picMarkIcon` | 目标实例`markInstanceId`对应图标 |
| `picInternalIcon0/1`、`picExternalIcon0/1/2` | 目标实例`slots`中前`partSlotCount`个PART槽图标，空槽无图 |

七个动态图沿用原控件名、原矩形和`offsetY=36`。显示槽与背景使用同一选中目录定义的前N规则；不因`ownedQuantity`为零隐藏仍存在的绑定，维护clock投影同样不改binding关系。没有owned实例或catalog定义时不造图标。

## 异步与生命周期

Equipment与Inventory作为同一view bundle读取，成功数据提交前校验返回目标实例。target、mode、AccountSource、返回Buy、Close或显式刷新变化时清旧目标图与部件错误；已完成请求的迟到结果不回挂到已卸载页面或其它战车。

Equipment/Inventory bundle失败时保留当前目标和正常只读背景，由独立part error经现有Owned status输出，并提供现有刷新入口重试；失败不等于确认空loadout。普通购买、出售、余额、模型、纹理、selection、字体和源布局的既有状态保持。

## 范围限制

本实现是明确的Web只读采用，不声称恢复原动态图provider或原未知字段。生产接线已存在；真实页面、保存、双端和HD验收未执行。原UI-58完整15控件逐项业务、商城完整精度及M5-10/M6-01父项继续按tasklist保持未完成。
