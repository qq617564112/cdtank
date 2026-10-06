# Home 拥有物品名单来源与独立组件

UI36 / M5-09。`myhome_playerpage.xml` 的 `lstPlayerItem` 是 WindowsLook/MultiColumnList，源区域为 192×224，位于 `zuobianbufen` 内 (12,15)。HeaderVisible=False，frame 图片为空；选中图、纵栏背景、箭头与 thumb 的资源均由本页 properties 消费。

独立 `HomeInventorySourceList` 仅接收确认库存条目的 instanceId、name、info、ownedQuantity、iconId，以及本地 selected、busy、select。拖动沿用 text/plain instanceId 与 copy；ArrowUp/Down/Home/End 只浏览已有条目并恢复目标行焦点，相关 keydown/keyup 隔离。数量和图标来自确认库存与现目录，不新增取得、保存或分配事务。

`HomeInventoryScrollbar` 使用本页 224 高度和原 minimum53/scale、比例 thumb 合同。8.5 栏宽、38 行步长、32 图标与 DOM 内容高度为 Web provider。原 MultiColumnList 空 frame/header 的扣除合同复用 `shop-multi-column-list-area-native.json`；其中已执行的是商城两个尺寸的八个向量，未将其记为 Home 尺寸的原生执行证据。

三个专属模块已接入 `HomeInventory` 的 lstPlayerItem 呈现；确认 records 与现 catalog 映射到纯 props，本地 selected/setSelected 沿用。原有统一构建和本次真实浏览器验收均通过，范围见下文。主线已亲审代码、raw和三完整图，accepted为PASS_CONFIRMED_HOME_INVENTORY_LIST_SCOPE。原 Kitbag、昵称、已保存统计、保存事务、关闭 cleanup 不受影响。正式接入与实际记录将单独登记；UI01/UI53 首次验收已完成并提交主线。当前主线最大真人扇出计时期间继续独立准备，正式 runtime 另行登记。

未完成范围：新增 hunk 工程检查、真实库存浏览/滚动/拖动验收、原列 producer、factory 栏宽、字体和完整 1:1。

首实际脚本 `tests/browser-home-inventory-list-scroll-source-page.mjs` 已独立准备并通过语法解析。端口3438/5466/9669，原marker数据库复制临时库、Page.enable/token严格绑定；先正常 Inventory 查询，缺少的1..7不同消耗品各通过合法Shop BUY一件以形成真实超过224高度的库存，不注入库存或新增资金。仅为新名单consumer上下文；记录各购买确认，不重复旧购买资格、持久或Kitbag保存验收。正常Home三完整分辨率、确认行数量与id、Arrow/HomeEnd本地候选和焦点、thumb capture/release、键盘隔离、Close严格Home焦点；不修改快捷槽，不开房。当前主线真人扇出计时，尚未启动脚本或新增工程检查。

实际 `browser-home-inventory-list-scroll-source-page-2026-10-05T01-37-11-713Z.json` PASS。原marker库复制临时库，baseline库存为空，正常Shop BUY1..7各一件确认，源数据库不写；原资金fixture前提保留，无新库存/资金注入。七确认行的instanceId3..9、名称/数量均对应真实Inventory，page224/document298，三完整800/1920/3840图已亲看；末条End可达，Home/ArrowDown/Up目标与焦点正确。thumb0→9.444445保持capture，外释放Normal无capture；End73.888893/Home0，window down/up=[]，Close严格回可操作Home按钮。浏览器无Kitbag/房间/事务写入，临时服务和库已清理。

工程复用主线 `home-inventory-source-list-production-web-build.log` 类型/构建1m22；后继 `movement-dust-water-production-web-build.log` 1m48包含同stable模块。本次 `home-inventory-list-source-web-types.log` 类型通过。无需再构建或复跑页面。确认名单、键盘浏览与thumb范围已获主线主审；箭头/wheel和原drag handler代码保持，未以本raw冒称其新增实际验收。完整Home父项保持未完成。
