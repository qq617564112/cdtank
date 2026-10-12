# 正式商城武器分类（M5-10 / UI-53）

shop_itempage.xml的rdoShopWeaponPage为(238,25)-(299,50)，根偏移(0,36)后位于(238,61)，61×25；rdoShopItemPage为(334,25)-(395,50)，正式位置(334,61)。两者Normal/Hover/Pushed与CheckMark直接使用原mycabin00/xiaowuqi及xiaodaoju资源，沿既有SourceButton消费。当前分类驱动原选中图，普通鼠标与Enter/Space接当前目录切换，购买或查询pending时禁止切换。贵重品及其他未完成大分类保持不可操作。

已恢复0x439762的ID区间分类由shared classifyItemId实现，2007与2011均属于type3武器。正式商城以服务器Shop QUERY确认的目录分类展示，武器类别当前含已开放的燃烧弹2007与问候炮弹2011。Item类别当前含八件消耗品[1,2,3,4,5,6,7,8]。原Shop动态分类producer与完整目录入口尚未恢复，该筛选明确为Web目录映射，不宣称恢复原全部购买资格。

切换分类选择该类首个已确认商品，源商品图、名称、说明和独立金币/软星币价格沿既有详情消费者；数量和货币草稿保持。两件武器购买沿当前BUY与持久账户事务，不更改purchase owner、requestId、pending或确认/拒绝逻辑。未确认武器请求重新打开时恢复Weapon分类，继续原请求。data-shop-item与现有购买选择器保持，源分类入口为data-shop-category=Weapon/Item。

燃烧弹2007由当前源catalog提供原名、说明“被命中者会燃烧9秒钟，减少生命值210点”、金币10与软星币20。原iconId2007映射daoju0/data\ui\daoju\02007.tga，DDS图集实际32×32资源为ui/regions/57/21.png。ShopSession使用QUERY返回的iconId/name/info及两种价格，现有Weapon分类自动包含2007，无新增React布局或交易实现。

宠物注射剂item3由apps/server/src/accounts/shop-catalog.ts列入当前出售目录。apps/shared/combat/item-hotkeys.ts的原ID区间分类返回type1，apps/web/src/interface/account/shop.tsx将其归入Item；商品名称、说明及两币原价直接使用QUERY确认值。iconId3按既有iconProps映射daoju0/data\ui\daoju\00003.tga，原DDS32×32图为ui/regions/57/2.png，TGA对应ui/regions/24/2.png。正式商城沿现有Item入口、商品列表、详情、BUY与源Close接线，不新增UI布局或交易逻辑。原item3与skill3范围见pet-injection-source.md。

页面根、源资源和三分辨率证据沿已完成shop-source-page-browser.md，不重复完整截图或对局。实际新购买与Item返回、源Close焦点由本轮正常2011购买业务验收覆盖。

## 实际验收

browser-ammo11-purchase-2026-10-04T10-30-45-580Z.json通过正式页面普通Weapon分类选择与2011数量2付费购买。对应-purchased.png已实际查看：源商品图、Weapon选中状态、确认余额100与购买结果可读；普通切回Item保留原七件商品[1,2,4,5,6,7,8]，源Close返回大厅并恢复商城入口焦点通过。

同一运行完成普通库存配置、托管自然两局及实际服务重启后的余额/槽位恢复。商城根与三分辨率证据复用shop-source-page-browser.md，未重复截图。原动态分类producer、完整商城分类与原GPU精度仍保持M5-10/UI-53父项未完成。

燃烧弹首次正式购买整页见browser-ammo07-purchase-2026-10-04T10-52-39-814Z-purchased.png，已实际查看：原火焰图标与燃烧弹名称、Weapon中的2007/2011两个商品、10金币/20软星币价格、成功购买×1及确认余额190可读。browser-ammo07-purchase-2026-10-04T10-52-39-814Z.json整体通过：普通BUY生成实例1、确认余额190，实际双端生命aria347/600与8个共同战斗事件一致；两自然局至tick597，Leave后资源归零。同一数据库实际服务重启后燃烧弹库存×0、slot1与余额190恢复，拒绝方余额5且库存空。对应-purchased.png与-burn.png已实际查看。网络10-51-22证据另覆盖两币原价10/20与实际持久范围。完整商城分类、原动态producer与视觉精度仍保持M5-10/UI-53父项未完成。

宠物注射剂首次正式购买见browser-pet-injection-purchase-business-2026-10-04T11-18-44-384Z.json，整体PASS；对应-purchased.png已实际查看。当前Item分类显示原注射器图标、中文名称与说明、10金币/10软星币价格、数量2及普通购买按钮，成功结果与确认余额80可见，没有阻塞本次商品选择和购买的资源或层级缺环。普通关闭商城后进入我的家，实际库存显示新实例1的宠物注射剂×2，并配置槽4；后续使用与重启范围归pet-injection专项业务证据。此次复用首次业务截图与商城根有效范围，不新增三分辨率验收，不据商品交付关闭M5-10/UI-53完整商城原依据与1:1精度。
