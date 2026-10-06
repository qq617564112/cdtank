# 正式道具商城左右名单

M5-10/UI-53采用shop.xml625×404根和shop_itempage.xml，子页顶边36沿完整父链累加。右lstShopItem为全局222,97、376×279；左lstMyItem为12,50、192×279。原lstMyItem位置恢复已拥有列表，商品详情与数量/货币/确认/刷新业务置于原根框下方。800×600基准统一比例居中沿当前Web缩放，原高清窗口规则未证明。

ShopItemSourceList消费源区域、SelectionImage及daoju0图集。左右共享原4b9251行构造器：161×56行内容；左owned origin1，右product origin10；右原MultiColumnList为两列171px、行距56。React拥有候选、焦点和普通方向键/Home/End；真实商品目录超出窗口时保持原区域裁剪，正常End可到末行。

右名单以原Item kind1、Weapon kind3/4分类，取当前Shop QUERY的name/icon/getMethod/durable。原数量getter读取Durable，资格内raw0显示1；缺源metadata为空。原价getter按GGet1/2显示金钱/星币，GGet0空；两币QUERY购买价在现事务区单独可读。左名单读取真实Inventory实例，以原正数量gate绘制，第四文字由同目录ItemMoney无符号右移1显示“出售价”。库存provider和类别记录数不因绘制过滤变化。

正式左右Item/Weapon分类已按原handler双向setSelected合同联动；任一侧切换同步两组radio。两个Valuable radio按原初始化setVisible(false)不参与绘制、命中或焦点。12-36-46-416Z 三res只读导航与Close有限通过，见shop-valuable-initial-hidden-root-review.json。
ShopSource的可选inventory只读契约已经主线确认，App现source=battle有真实实现。Item会话首次查询、购买确认与刷新后重新请求Inventory；关闭或新查询使旧回包失效，不用购买数或余额推造库存。缺少此方法的测试source仅保留空名单，不能作为正式玩家验收。purchase owner/requestId/inFlight、确认/拒绝与账户事务保持现有实现。

txtMyListQuantity显示当前已确认类别的记录数。源数量行、原图标、名称、类别及价格已有独立有限验收，主审分别见shop-owned-item-row-root-review.json、shop-owned-weapon-row-root-review.json、shop-product-grid-root-review.json、shop-original-display-root-review.json和shop-owned-sale-display-root-review.json。原余额只显示QUERY/BUY确认结果；数量、币种、购买、刷新和状态沿现Web事务区域保留。
归属：UI线shop.tsx仅Item呈现/库存只读接线、shop.css仅Item选择器、ShopSourcePage仅Item源控件、新shop-item-source-list.tsx、browser-shop-item-source-lists.mjs及本片文档/输出。未修改Tank/Pet页面、模型生命周期、网络协议、账户写入或购买规则。名单选择器为[data-shop-item][data-selected-item]及[data-shop-product-id]，不再是默认select；币种select保持现业务。

## 实际页面与业务验收

browser-shop-item-source-lists-2026-10-04T16-14-41-296Z.json前三checks及同前缀-item-800/-item-1920/-item-3840.png为实际三分辨率完整页，三图已查看。左右原名单、源分类、确认拥有数量/余额和源图标/中文商品价格可见，框下交易区在各分辨率视口内。该raw最后点击屏幕外商品的验收等待失败，保留FAIL，仅采用明确已过范围。

browser-shop-item-source-lists-2026-10-04T16-17-25-639Z.json定向操作PASS5：左右独立分类，拥有候选源选中图，右列表实际鼠标滚轮和Home/End焦点；普通大包饲料×3金币100→40，确认真实库存新实例×3并重新查询显示左栏数量2；普通无敌商品×1软星币40→20，左栏再次显示新实例；数量10余额不足拒绝保持草稿与全部已确认库存；商品武器/道具分类、刷新、Close/重开查询和Escape均通过并恢复大厅商城入口焦点。-rejection.png已实际查看，错误文字与拥有列表可见。

最终三res布局专项browser-shop-item-source-lists-2026-10-04T16-19-30-364Z.json PASS3及同前缀-item-800/-item-1920/-item-3840.png已实际查看。当前数量和币种控件单行位于购买按钮上方，各视口内完整呈现；账户查询/购买行为仍采用16-17有效证据，不重复交易。

账户夹具明确导入余额100/40及既有库存301/2001/5、302/4/2；两新拥有实例经真实Shop BUY发放，不把夹具称普通获取。正式runtime真实Battle.inventory查询可从raw网络Inventory记录检查。共恰三次BUY，事务失败不改变库存与余额。专属3366/5416/9616及临时目录每次清理四项true，shop-item-source-lists-types.log记录Webtype通过；关联范围见shop-item-source-lists-accepted.json。

```sh
npm --prefix apps/web run typecheck
node --import tsx tests/browser-shop-item-source-lists.mjs
node --import tsx tests/browser-shop-item-source-lists.mjs --interactions-only
node --import tsx tests/browser-shop-item-source-lists.mjs --layout-only
```

## 限制

原购买触发/确认producer、出售事务、贵重品可见producer/正记录consumer、原滚动完整绘制、Windows字体/GPU/高清锚点未闭合。左右分类联动和初始隐藏已有有限实际验收，不能据此关闭完整原控件状态与整页精度。网页框下事务区域是正常业务保留入口，不能据本片关闭完整商城原版精度。M5-10/UI-53保持未勾。
