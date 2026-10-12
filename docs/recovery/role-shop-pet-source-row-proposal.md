# 正式宠物商城名单原行

UI56 / M5-10。交付目标为正式 Pet 页主要名单区域，替换现18px name·money 网页行，保留现 QUERY、候选、详情、预览和购买事务。Tank 分支保持原现行消费者。

shop_petpage.xml 原加载入口4b0363，CastlePage/lstPet 为同页名单，4b0468 保存 owner+50。product factory4af876 清名单、增加161px列，遍历原商品 vector 后传 name getter4d7e58、第二行 getter4d8c0b、第三行 getter4d9bc1 到4bd110，owned=false，产品 ID 来自原record+c，随后加入同owner+50。owned factory4b18e2 的 MyPet 路径与产品分支分别记录。

原 vtable5cef8c 指向 getSize4b923b/draw4bd520。行161×56，选中底图161×51；图标5,8，name44,4，第二行44,18，第三行44,32。产品图标格式 data\ui\gy\maogou_%d.tga，参数为产品record+c。原 draw 的三个文本分别读取 base+4、this+174、this+20c，不能把第二行作为类别标签。来源见 role-shop-pet-row-source.json 与复现脚本。

拟归属新 pet-shop-row-content.tsx/CSS、role-shop-source-list.tsx 仅Pet分支。既有entry.id/name直接透传，无需pet-shop.tsx重复hunk。现正式PetShop以PetTable.ID/PetName提供petId/name，原 raw 商品record+c/+14与当前provider身份由主线核定；不新增API。两文字getter尚未限定输出合同，保持空白，不按成员偏移推断价格或时长，不借moneyPrice或maxHp。当前PetShop QUERY金额不改，现选中商品金币售价保留在既有事务区可读。不得声明该记录布局是PetTable二进制布局。

实际验收使用合法保存账户副本，正常Shop→Pet QUERY 当前八商品；800×600、1920×1080、3840×2160仅新行name/icon/161×56、真实overflow末行正常End可达、候选与strictClose。无BUY/装备/旧Tank或旧Item行重复验收。原正价可售目录仍是现重建资格，不以新原行关闭原availability父缺口。

正式 Pet 分支已接入三个文件，最终 Web 类型检查退出0。正常 Shop→Pet 只读流程在800、1920、3840完成原161×56行、56px行距、名称与图集、End末行105可见及严格Close返回；六张完整图已亲看。有限验收见 role-shop-pet-source-row-accepted.json，统一工程已由主线发行：24150最终类型检查0、94429 Web构建0/1m35、release copy0。未确认的两段文字保持空白，完整页面父项保留。

预留唯一3567/5597/9797，定向runner browser-role-shop-pet-source-row.mjs已syntax通过。每分辨率保存top与End末行bottom完整图及实际row/icon/clip指标后断言；使用09-57合法Itemcheckpoint副本，不产生新的BUY。

role-shop-pet-name-provider-native.json已资格原ID/name：复用完整43a91c Pet loader10实际行，ID列0写record+c、PetName列1写stdstring对象record+10；原4d7e58读取同对象buffer+14/length+24/capacity+28，10原GB18030名称在文字copy边界逐一相同。正式PetShopCatalog提供同PetTable.ID/PetName。
