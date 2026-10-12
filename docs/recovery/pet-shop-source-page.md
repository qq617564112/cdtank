# 正式宠物商品页主要区域

M5-10/UI-56复用shop.xml625×404根及shop_petpage.xml子页，完整父链累加原AbsoluteRect；800×600基准按现Web统一比例居中。PetShopSourceRegions消费21原StaticImage，覆盖右侧介绍背景、生命值/凶猛/好运/技能区域、底部熟练度图字、左侧数量和余额。Qbi与xingbi同位选择缺完整来源，沿现软星币选择不重叠绘制；属性保存于pet-shop-source-regions-source.json。

原lstPet位置消费真实PetShop QUERY目录，源SelectionImage显示候选，React按钮名单支持点击、ArrowUp/Down/Home/End候选/焦点/滚动。原rdoBuy显示当前购买分类，txtListQuantity显示确认目录数，txtName/picModel及txtHP维持现候选名称、PetModelPreview与确认maxHp投影。名单文字和行高属Web业务映射，未声明原动态行绘制等价。介绍和生命值用标记web-readable的#253740深色文字保证浅底阅读；生命值保持同一maxHp输入，Web字形/颜色不冒充原最终producer。

原btnBuy沿SourceButton消费Normal/Hover/Pushed/Disabled。PetPurchaseOwner/requestId/inFlight/确认拒绝/关闭代际及Babylon生命周期不改。现Web价格、刷新和事务提示置原框下，重复余额/标题视觉隐藏保留诊断文本。未知技能、凶猛、好运、熟练度数值不补造。

归属：pet-shop.tsx呈现、pet-shop.css、新pet-shop-source-regions.tsx、browser-pet-shop-source-page.mjs及本文/输出。新名单DOM为[data-pet-shop-item][data-selected-pet]、[data-pet-shop-product-id]，无重复native select；旧nativeSelect证据仅证明其原业务范围。

## 实际页面和业务证据

browser-pet-shop-source-page-2026-10-04T16-37-01-445Z.json PASS，800/1920/3840三张-pet-*.png均实际查看，21原图区域、原购买分类、真实目录8项、名称/预览/介绍/余额及框下操作在场。介绍深色可辨，普通mouseWheel可阅读全部文字，scrollTop17.5。初次三res图的txtHP采用原共享白字消费者；最终可读HP呈现由下述1920专项图证明。

显式账户夹具4000金币/1000软星币，普通名单点击pet2大麦、刷新→原购买按钮真实PetShop BUY3500确认→500；再次普通购买被金钱不足拒绝，错误提示可见。刷新、购买与拒绝保持同一预览DOM/engine/scene；切Item释放，返回Pet重新加载，Close/重开/再次Close释放且旧帧停止，恢复大厅商城入口焦点。-purchase-kept-preview.png已实际查看。交易验收限pet2，不将8项目录显示扩大为所有宠物模型精度通过。

browser-pet-shop-source-page-2026-10-04T16-38-18-926Z.json PASS及-readable-page.png已实际查看，1920整页介绍与生命值700均为清晰深色，预览保持、Close释放/焦点通过，0BUY。最后呈现复用上述三res主要结构与真实交易证据；该专项不重复交易或三res。

pet-shop-source-page-types.log Webtype通过；当前新代码发行与必要工程检查由主线统一下一batch，本片不另做全量构建。两份PASS raw均记录server/chrome/vite/temp清理。

```sh
node --import tsx tests/browser-pet-shop-source-page.mjs
node --import tsx tests/browser-pet-shop-source-page.mjs --readability-only
```

## 限制

完整75控件、技能/凶猛/好运/熟练度业务参数、原出售分类与名单动态绘制/数量producer、原最终文字颜色与字形、原截图/GPU字体/高清锚点仍未闭合。深色介绍和生命值为明确Web可读呈现，框下交易区域不是原购买producer。现宠物模型照明材质属既有重建范围；该片只保持现预览，未证明原客户端模型视觉一致。UI-56与M5-10保持未勾，主要结构和pet2普通购买/导航可用不代表整页1:1完成。
