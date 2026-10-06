# 迷彩页面拥有战车名单

UI59 / M5-10。原Texture模式4b62b2分派到4b6468工厂，对同MyTank调用名称4d7e10、类别4d960f、剩余天数4d88f1，再以原实例+1c与owned1调用4bb3bc。4b6365读取5ce534的列宽为161。来源见 recovery/output/tank-shop-texture-owned-row-source-preparation.json。

精确两文件补丁 recovery/output/tank-shop-texture-owned-row-consumer.patch 复用 HomeOwnedTankRowContent与既有CSS。OwnedRoles.name/+24/+34直接透传，类别从完整21项CombatCatalog.tankTypes读取。缺值空白，真实分钟0显示（0天）。现列表4px inset保持，原inset来源尚未确认；行采用原161×56，selection161×51。现迷彩选择、preview、保存和账户事务接口保持。

只读验收器 tests/browser-tank-shop-texture-owned-row.mjs 使用现真实保存副本实例1/车型3与实例2/车型4，普通Shop→Tank→Texture导航，800/1920/3840六张完整页确认新行名称、类别、天数、图集身份、selection/focus与strictShopClose，未更改draft时SAVE禁用。预留建议3596/5626/9826，待root协调。两文件已于2026-10-05 17:09:43.681610885 UTC原子接线，合原箭头有限边界hunk。统一工程与3596首次实际待root发行；尚未启动Chrome。

## 原子页附着来源

原LabPage载入shop_tankpage.xml后将根存于this+8，载入shop_tankpage_texture.xml后存于this+c0；mode2按isChild确认并以addChildWindow将+c0挂到+8。Tank根AbsoluteRect的left0/top36与现offset0/36一致。逐指令与具名CEGUI imports见 recovery/output/tank-shop-texture-parent-source.json；原最终framebuffer与完整页面精度仍待证。

## 币种图状态来源

原4b6a84读取全局634ee8的Q/X配置，以setVisible互斥切换全页三张daibi与三张xingdian。Q返回0时daibi可见；Q非0且X返回0时xingdian可见。具名控件绑定及逐指令见 recovery/output/tank-shop-texture-currency-source.json。当前未确认该Q/X配置producer，不能从每个迷彩方案rarity推导原全页图状态；保持此具体缺口。

## 未完成范围

原额外已装图标、列表inset原值、完整Texture页面精度保持开放。该切片不涵盖SAVE事务或完整模型preview验收。
