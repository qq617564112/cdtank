# 我的家帽子与标志原名单行

UI32 / M5-07。原4e8621类别1到4e8865、类别2到4e8651，43bd09读取MyItem+c定义ID并调4396e0，10001..12000返回3，12001..13000返回4。两分支分别调用同4d8366名称、4d83b3类别、4d849e天数。类别1（4e8865）与类别2（4e8651）工厂与Common4e8a65同读命中实例`MyItem+0x1c==2`，命中以`4bbcfd(1)`写`row+0x3c4=1`，同SmallHT原状态1→E。当前完整目录包含40帽子、45标志、0气球，完整原category3涵盖Hat10001..11000与Balloon11001..12000，category4为Mark12001..13000；原gamestring690为坦克帽子、691为坦克气球、692为坦克标志。

两分支使用同`4b9e77`原构造器与`161×56`几何，复用Common原行内容及可选kindLabel。当前Home按原分类过滤，帽子/气球（category3）与标志（category4）各自复用原行；已装备行按confirmed `equipment.decorationInstanceId`（帽子/气球）或`equipment.markInstanceId`（标志）匹配本target并透传`installed`，共用`HomeRoleRowStatusBadge(status="installed")`原状态1→E（SmallHT region ui/regions/11/9.png，point 5,8 14×14随父scale）。字段天数仅同MyItem+10原显示，不推期限政策；未新增状态、字体或缓存。

## 取得范围

精确10001..10040的40件帽子已接普通正价Shop QUERY/BUY：成功BUY写合法owned instance并进入Home `DECORATION`装配，本页复用该owned记录与装配selector，详decoration-purchase-client-business-design.md；未新增取得链、售价、期限或server政策。气球11001..12000与标志12001..13000的普通取得尚未确认，不据此构造记录或新增可售列表。

## 待验范围

既有Common几何与槽事务保持复用；商城支付、合法正记录页面的行文字/图标/选择/关闭、新E的目标确认/拒绝/关闭重开、三分辨率完整图与HD均未实测；额外已装状态已有source/confirm接线、实测待做；完整UI32、整页1:1与93控件父项保持未完成。
