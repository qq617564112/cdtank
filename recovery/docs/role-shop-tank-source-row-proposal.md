# 正式坦克商城名单原行

UI57 / M5-10。主要名单区域采用原4bbd0a产品行，161×56，选中底图161×51，图标5,8与名称44,4。仅接入 Tank 分支，保留 Pet 消费者、候选、详情、模型预览、QUERY及购买事务；现选中商品金币价仍在既有事务区显示。

shop_tankpage.xml 原加载4b2fef，LabPage/lstTank 存于owner+34。product factory4b5d70通过产品record+c查原TankTable记录，4d7e58读取同名称，4bbd0a使用同TankTable ID+c构造未拥有产品行。getSize4b923b/draw4bc12a提供行与文字位置；图标为tanke0/data\ui\tanke\%03d.tga。

完整43b62a loader既有21实际行及本次4d7e58 native调用确认TankTable.ID/TankName同身份；名称对象+10，inline buffer+14。正式TankShopCatalog以shop坦克ID查同TankTable.ID/TankName。现十个正价正式商品原图集均32×32，正式SourceLayout优先原imagesets_dds/tanke_0，来源记录 role-shop-tank-source-icon-provider.json。

原其余三文字getter输出及附加图标语义尚未确认。三段文字分别保留44,18、104,18、44,32空位，附加图标不绑定。没有把moneyPrice或其他当前字段借作未确认原文字，也不推断原可售资格。

准备三个文件：tank-shop-row-content.tsx/CSS及role-shop-source-list.tsx的Tank分支。补丁role-shop-tank-row-consumer.patch已在13:21:03原子接入，主线23563 build内finaltype0/build1m25/copy0。13-30-13-074Z实际三res名单、End155与strictClose通过，六张Tank完整图亲看，有限索引role-shop-tank-pet-text-accepted.json。预留3569/5599/9799；定向runner复用合法09-57保存账户副本，正常Shop→Tank QUERY十商品，在800/1920/3840验证新行、真实overflow/End末行155可见、选择及strictClose。无BUY、装备、旧Pet/Item重复验收。完整页面与原字体父项保持。

主线有限审查 role-shop-tank-pet-text-root-review.json 已关联共同验收索引。
