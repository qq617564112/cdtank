# 正式战车商品页主要区域

M5-10/UI-57复用shop.xml625×404根及shop_tankpage.xml子页。原子页顶边36沿完整父链累加；800×600基准下按现Web统一比例居中。TankShopSourceRegions消费38原StaticImage，覆盖右侧火力/装甲/侧后装甲/剩余天数图条、底部移动/转向/射击间隔/装填图字及左下数量/金币/软星币图条。Qbi与xingbi同区域动态选择尚无完整来源，本片保持现软星币资源选择，不重叠绘两图。

原lstTank位置显示TankShop QUERY确认的当前全部商品，源SelectionImage替换浏览器默认选中色；按钮候选、ArrowUp/Down/Home/End焦点与滚动由React拥有。原rdoBuy显示当前购买分类，txtListQuantity显示已确认目录记录数，txtName与现原模型picModel保持候选商品。名单行文字/行高为Web业务映射，不声明原动态行绘制完全等价。

已有TankPurchaseOwner、requestId/inFlight、确认/拒绝和关闭代际保持原实现。btnBuy沿SourceButton原Normal/Hover/Pushed/Disabled消费者。原参数区优先显示，现Web价格、刷新与事务提示置于原框下；重复余额和网页标题仅视觉隐藏，保留可读文本供诊断。商品介绍沿原edtDescription位置，使用本页明确标记的Web深色文字保证阅读，当前Camera/模型照明保持既有明确重建范围，不修改Babylon生命周期。

归属：UI线tank-shop.tsx呈现、tank-shop.css、新tank-shop-source-regions.tsx及browser-tank-shop-source-page.mjs/本片文档与输出。原控制属性保存在tank-shop-source-regions-source.json。现列表DOM为[data-tank-shop-item][data-selected-tank]与[data-tank-shop-product-id]；未保留重复native select。

## 实际页面与操作证据

browser-tank-shop-source-page-2026-10-04T16-25-20-118Z.json为PASS。三张-tank-800/-tank-1920/-tank-3840.png全部已实际查看，sizes记录38原图区域在场、当前QUERY10商品数量一致、原购买页签/商品名称/模型区域和框下刷新/提示可见。模型维持商品3与默认三纹理，原侧/后装甲和底参数图字恢复，参数数值仍空。

普通源名单点击商品3、刷新、原购买按钮→2500金币确认3000→500；再次普通购买余额不足保候选。当前预览DOM/engine/scene在刷新、购买和拒绝期间保持；返回Item释放、重入重新加载，Close释放与再次打开/关闭释放通过，旧帧停止并恢复大厅商城入口焦点。-purchase-kept-preview.png已实际查看，错误提示可见。介绍可读性专项browser-tank-shop-source-page-2026-10-04T16-29-26-871Z.json PASS及-readable-description.png已实际查看：1920×1080整页中文介绍为深字浅底，文字完整内容可通过普通mouseWheel阅读，scrollTop0→15；预览DOM/engine/scene保持，源Close清理并恢复大厅商城入口焦点。无BUY，不重复三res或交易；该深色呈现明确为Web修正。

账户夹具显式导入余额3000/1000，拥有商品3由真实TankShop BUY取得；本次只验商品3的预览与交易，不将10商品目录显示扩为各车表现通过。

首16-24-03-867Z rawFAIL保留，不作页面验收；当前完整raw按真实QUERY确认目录长度。tank-shop-source-page-types.log记录最终Webtype通过，3367/5417/9617及临时目录清理四项true。

```sh
npm --prefix apps/web run typecheck
node --import tsx tests/browser-tank-shop-source-page.mjs
node --import tsx tests/browser-tank-shop-source-page.mjs --readability-only
```

## 限制

火力/装甲/耐久/数值参数、原出售与迷彩完整分类、动态名单行绘制及原数量producer、原截图/GPU字体/高清锚点仍未闭合。参数图字恢复不证明其业务数值完整，当前目录数量显示属于确认目录投影。Web价格/刷新/错误区不代表原客户端交易界面。介绍采用本页#253740深色文字显示在原浅背景上；该颜色明确为Web可读呈现，原商城最终文字颜色/背景消费未证明。原MultiLine基类构造的+36c白色默认不能证明商城caller最终色，不据其指定本页为原白色。完整72控件、全部商品和1:1精度保持未完成，M5-10/UI-57未勾。
