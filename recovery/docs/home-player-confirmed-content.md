# 我的家玩家页确认内容

M5-09/UI-36正式玩家整页以原myhome_playerpage.xml的txtMoney/txtCoin/txtItemQuantity消费现账户确认数据。金币与软星币直接读取Battle.roleProfile返回资料字节+70/+74两个LE uint32，当前数量来自Battle.inventory记录按既有Weapon/Item分类投影的记录条数。数量不是库存份数相加，原动态数量producer尚未证明，不声明等价。

原StaticText四角FFFFFFFF、右对齐余额/居中数量与矩形沿SourceStaticText和HomeSourceLayout完整父链消费，不增Web余额条。现RoleProfile只读查询独立于资源/Inventory，保持每次打开的active owner，关闭晚响应不写页状态。账户没有资料时余额空白，物品查询、选择和返回正常可用；余额查询错误进入现事务提示区，不推造零值。未知称号、家族、创意点、技能点、积分、介绍及总结保持空白。

归属：home-inventory.tsx只读查询/传入确认值，home-player-source-page.tsx原三个文字控件，新browser-home-player-confirmed-content.mjs及专属source/accepted/doc。未改App、共享协议、账户事务、快捷槽写入规则或Babylon；home.css本轮未修改。源属性与数据映射保存在home-player-confirmed-content-source.json。

## 实际页面与业务证据

browser-home-player-confirmed-content-2026-10-04T17-34-05-141Z.json PASS。新账户未导入库存时原余额为空、确认数量0且库存操作已就绪。验收资金200金币/30软星币为显式账户资料夹具，拥有物品未导入。正常大厅打开商城、实际商品1宠物饲料MONEY购买一份，真实Shop确认200→190、30保持；关闭商城返回我的家，新的RoleProfile只读确认与Inventory查询使原位置显示190/30，Item当前名单实例与数量1、原选择图更新。Weapon空名单数量0，回Item数量1。

800×600、1920×1080和3840×2160三张-player-*.png实际整页均已查看，原根框、主要资料/名单/快捷槽区域及框下业务入口可见，余额与数量可辨；高清数字存在既有字形间距失真，原高清字体规则尚未闭合。普通Source Close回正式大厅我的家焦点，重开保持Item及确认值。网络只有一次Shop BUY，没有Kitbag请求；既有配置/取消、中文输入与框下滚动证据沿home-player-source-page.md复用，不声称本轮重新验证。3374/5424/9624与临时目录清理全部true。

home-player-confirmed-content-types.log记录当前Webtype PASS。由主线统一必要发行batch，本片不重复全build。

## 未完成

原动态数量绘制、右资料与总结内容、介绍与昵称修改原按钮、贵重品、高清字形与完整66控件/1:1仍未完成。此范围补齐实际购买后返回的确认余额和名单数量，不代表整页原版还原完成；M5-09/UI-36保持未勾。
