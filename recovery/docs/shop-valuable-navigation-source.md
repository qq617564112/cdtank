# 商城贵重品控件的原初始状态

UI53 / M5-10。原ConvenientPage包含左右贵重品radio和对应工厂。49ebe2将rdoMyValuablePage保存owner+50，49ec95将rdoShopValuablePage保存owner+5c；随后49ebf6与49eca9均以false调用原导入CEGUI Window::setVisible(bool)，所以正式初始状态是隐藏。

[父控制器来源](../output/shop-owned-valuable-parent-source.json)保存原visibility调用、具名导入及4a1564的selectedWindow handler。ownedItem、Weapon、Valuable在选中后分别调用各工厂，并选择右对应radio；handler存在不代表贵重品入口可见。

[界限内visibility缺口](../output/shop-valuable-visibility-producer-gap.json)确认49e988..4a1ae5中直接setVisible调用只有这两次false。未证明后续true producer；停止同界限扩扫。当前正式QUERY104项的category6为空，不能以空名单给隐藏入口补造可见导航。

原初始隐藏状态已在正式ShopSourcePage恢复；12-36-46-416Z 三res完整图与左右分类联动、Close只读验收通过。原启用第三radio的补丁保持未应用。取得真实可见producer后方可恢复对应导航。正Valuable商品、owned分支内容与原可售权威继续保持缺口。
