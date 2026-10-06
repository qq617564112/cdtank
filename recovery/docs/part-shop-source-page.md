# 正式部件商城页

UI-55/M5-10通过原rdoPartPage进入独立Part页，复用shop.xml625×404根与shop_partpage.xml主要布局。9非重叠原StaticImage、3拥有分类与3商品分类、lstMyEquip/lstShopEquip两原名单、确认余额与拥有数量由React消费。Qbi与xingbi同位未重复绘制，沿既有软星币选择，原动态图选择未证。原属性保存于part-shop-source-page-source.json。

Common按classifyItemId原8–12过滤真实Shop QUERY当前84项中的74部件；拥有Common/饰品/标志按8–12/5/7消费真实Inventory。饰品/标志商品取得尚未开放，保持禁用。道具页候选及默认切分类选择排除8–12，部件不混入Item。名单消费原SelectionImage、实际源icon，候选由普通点击、方向键/Home/End及滚动控制；名称、双币价格与拥有实例/数量属于确认数据的Web行呈现，不声明原动态列绘制等价。

购买复用ReqShop/ResShop与现source.shop，PartPurchaseOwner独立维持requestId/pending/inFlight/会话代际，不改账户事务。普通购买一件，成功后只读source.inventory重新查询，不用余额推造库存。查询缺Inventory方法保持空拥有区域，该替身不能算真实库存闭环。真实装配能力通过框下“装备拥有部件”进入现装备页，App回调由主线拥有。正文说明、币种/购买/刷新/装备/事务提示放原框下，明确Web交易呈现，不冒原购买producer。

归属：part-shop.tsx/css、新part-shop-source-page/source-list、shop.tsx独立Part owner/busy/choice/render及Item排除部件、shop-source-page.tsx根Part可用合同；专属browser/source/doc。root拥有SourceButton suffix类型与App装备导航/关闭焦点，不改本片名单或交易owner。协议、数值、网络、Babylon生命周期未修改。

## 实际整页和业务证据

part-shop-source-page-accepted.json为组合字段范围索引，状态COMPOSED_USABLE_SCOPE_PENDING_MAIN_REVIEW，交主线审查。17-21-07-116Z raw整体FAIL，仅接受已完成字段与实际页面证据，不将其包装整体PASS。800/1920/3840三张-part-*.png均实际查看：9子页图、正式根/类别、真实74商品名单/原选中图/原图标/说明及框下交易控件可见且未越出屏幕，余额1000/25与拥有数0确认一致。

新Account显式资金3500金币/25软星币，普通BUY3战车取得、正常Home原出击选择实例1，再返回正式Part页。16001破旧的引擎源价格500/50、说明“移动速度+20。”直接来自确认商品，不将该文字当本片实战运动数值验收。名单End/Home候选滚动和普通点击后MONEY购买一件，真实余额1000→500、25保持；重新Inventory确认实例2，左名称/原icon/数量1与选中图更新。再按正常币种选择TOKENS购买，真实API代币余额不足拒绝，拥有实例保持1条；-owned-rejected.png已实际查看。

原拥有Hat/Mark空名单切换与Common回候选、Item排除部件均通过；框下装备入口打开正式HomeEquipment，真实候选实例2→槽0触发Equipment EQUIP/PART/slot0确认，-equipped.png已实际查看源图标已装、状态部件已保存。最终Close与正式大厅焦点由17-27-09-782Z --navigation-only单独确认PASS：Part装备入口打开HomeEquipment，关闭后dialog已关闭且activeElement匹配[data-room-card-home]。此定向检查没有部件BUY、Equipment装配变更或三分辨率截图；仅新账号普通BUY3与Home出击选择建立实际装备上下文。该raw记录3373/5423/9623/temp清理true。17-19-56-807Z、17-21-07-116Z与17-24-35-517Z原FAIL记录保留，17-21的有效整页、交易与实装字段和17-27的导航字段分别引用，不改写原raw整体状态。组合证据覆盖本片主要操作，不代表完整原版页面验收。

part-shop-source-page-types.log当前Webtype通过；主线统一必要batch发行，本片不重复全build。

## 未完成

完整26控件/原动态名单列、原商品购买确认producer、原币种动态图选择、字体/最终颜色/滚动条原精度、全部74商品实际配置和1:1仍未完成。仅实际16001购买/拒绝/装配可用，不以74目录显示代74实配。关闭晚响应沿owner隔离实现，本轮在确认后关闭，不称其边界已新实测。饰品/标志取得和维修仍未接。UI-55/M5-10保持未勾。
