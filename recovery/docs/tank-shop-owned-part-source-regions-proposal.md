# 拥有战车部件子页

UI58 / UI57 / M5-10。原LabPage将shop_tankpage_part.xml根保存于this+84；Owned模式1通过isChild/addChildWindow挂到Tank根this+8，偏移0/36。来源为 tank-shop-part-parent-source.json。原15控件包括根、Hat/Mark背景、五部件背景以及七动态图。

原选择拥有记录的+24查询同TankTable；loader43b62a的column23 TankPartSlot写record+98，4b2635按该值同时显示前count个部件背景和对应动态图，剩余至5项隐藏。完整21项原槽数已保存。该数量为商城展示的原TankTable值，不代表账户购买初值或当前可装配policy。

prepared两文件为新tank-shop-owned-part-source-regions.tsx与TankShopView的Owned挂载。模块API为{ui, partSlotCount?:number}；背景Hat/Mark保原XML，部件只取前count，missing时部件背景不显示。主页面从完整目录同displayedTankId查partSlotCount。主线拥有CombatCatalog.tankTypes的字段与export，现出口未发布，补丁保持unapplied。

七个动态图仍不绑定。Equipment QUERY读取出击战车profile而不是商城所选实例，不能借该接口填候选槽值；OwnedRoles原fields到原图值的getter/caller尚未证明。此slice不增加协议、账户事务、选择出击、装卸或出售动作。

未来首次只读范围为真实保存实例1/车型3和2/车型4的Owned模式子页：三分辨率完整页、两原饰品背景、原槽数2对应部件背景可见/其余隐藏、source resource与位置、动态值空白，返回购买时子页卸载和strictClose。现Owned名单名称/图标/type/day及旧BUY/SELL业务不复验。所选部件动态图、原slot数的完整server authority和完整UI58/商城精度保持未完成。

只读driver已prepare：tests/browser-tank-shop-owned-part-source-regions.mjs，参数依次为root协调的server/Vite/CDP端口，尚未预留或运行。启动前要求目录完整21项partSlotCount与已封原表值一致；仅新背景三res×两保存实例、返回Buy卸载、strictClose。生产补丁与metadata同下共享窗口，actual pending。
