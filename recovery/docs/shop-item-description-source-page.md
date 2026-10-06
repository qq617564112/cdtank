# 商城道具说明子页

UI52 / M5-10。原shop_itemdesc.xml含四控件：all为190×85，kuang在(18,18)至(218,103)，txtType在(58,26)至(180,42)，edtDescription在(23,46)至(213,97)。源根允许超出父边界，主框使用原lobby_ditu0九片图片。

现正式ShopItemSourceList已显示真实Shop QUERY商品名称、图标与两币价格；选中商品的info仍在框下Web段落。此片拟以完整四控件说明根消费该确认info，txtType因原setter语义未知留空。原列表名称、图标与价格及购买数量、币种、余额、拒绝反馈保持现业务。

说明根附着为明确Web适配：沿现框下资料区，local根(-6,392)使原kuang在ShopStage(12,410)，至(212,495)。根内资源及文字矩形来自原XML，原弹出触发与父挂载未确认。新shop-item-description-source.tsx/css负责纯呈现，ShopSession仅替换现shop-product显示；账户和交易不改。

首实际计划复用UI35已合法保存SQLite后继副本，仅QUERY并浏览道具/武器；不再次购买、选用、装备、建房或Ready。800×600、1920×1080、3840×2160检查整个正式商城及说明框，精确比对服务info，必要长中文说明滚动与源Close回Shop入口焦点。未执行实际，不作页面PASS。

原txtType、动态挂载/显示触发、字体/framebuffer和完整商城父项保持未完成。

页端已接入，focused Webtypes `shop-item-description-source-page-web-types.log` exit0。三完整截图已亲看，原说明主框与确认中文info可读，四控件均在视口内，八frame层映射；商品列表名称、图标、价格与购买数量、币种、按钮保持可见。txtType为空，未补造原类型语义。

组合证据：`browser-shop-item-description-source-page-2026-10-04T23-38-25-204Z.json`保留原FAIL，其三分辨率与确认介绍字段有效。`browser-shop-item-description-source-page-2026-10-04T23-39-11-665Z.json` navigation-only PASS，resolutions为空且无新图：正常武器候选确认info更新，源Close恢复可操作Shop入口，全程只QUERY无BUY。复用UI35合法SQLite副本，原库不修改；原资金-only夹具前提沿UI35记录，未新增资金/库存注入。

当前最长道具说明34字符在190×51原区域内完整容纳，actual没有溢出；不以该范围声称长文滚动已验。source/accepted封装保存于 `recovery/output/shop-item-description-source-page-{source,accepted}.json`，root已亲审三图/code/raw与navigation，accepted为PASS_COMPOSED_SHOP_ITEM_DESCRIPTION_SCOPE并附mainReview；shop-description-production-web-build.log统一生产Webtypes/Vite exit0包含最终模块。
