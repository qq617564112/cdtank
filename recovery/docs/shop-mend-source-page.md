# 商城维修中心来源与只读范围

UI54 / M5-10，维修规则依赖M6-03。正式商城原rdoMendPage当前未进入页面；shop_mendpage.xml有67个控件，主SheetWindow在(0,36)至(615,395)，左210宽当前拥有区域、Tank/Part两子页、Common/Hat/Mark过滤，右六个1/7/30天金币/代币保养按钮。现发行ui.json对应108处非空图片引用已映射，资源无缺失。

候选消费者仅复用现ShopSource.ownedRoles/inventory/roleProfile只读接口。OwnedRoles.equipment实例字段0x1c与name用于真实战车名单；Inventory确认实例和itemTableId分类用于部件名单，名称图标按目录精确匹配；余额沿确认profile0x70/0x74。名单数量明确为当前可见记录数的Web投影，不解释为原保养总数。

计划保留原全部主要区域、子页导航和名单选中图，右六维修按钮禁用、费用文字留空。保养资格、有效期、费用和请求事务无来源，不建立新协议或账户写，也不从拥有字段推耐久。原行列绘制和附着仍未知，页面业务记录只限查询与拥有浏览。

拟归属为新mend-shop-source-page/list/css以及ShopSession/ShopSourcePage的Mend分类呈现，保持现交易owner和其它商品。已向主线提交范围；当前统一构建冻结期间只有来源与独立准备，未写import生产图。

来源索引 `recovery/output/shop-mend-source-page-source.json`。正常实际拟复用合法拥有checkpoint副本，验800×600、1920×1080与3840×2160整页、只读名单/页签/候选、关闭焦点与禁用状态；当前未运行。若副本缺真实资料，需明确必要上下文，不能注入拥有库存。

完整UI54/M5-10维修功能与M6-03规则父项保持未完成。

正式页端已接入mend-shop-source-page.tsx/css，ShopSession/ShopSourcePage开启Mend分类，只读三资料查询每次挂载一次；会话关闭后的响应不写状态。root共享SourceButton已追加shop_mendpage.xml，focused Webtypes `shop-mend-source-page-web-types.log` exit0。

唯一实际 `browser-shop-mend-source-page-2026-10-04T23-48-21-005Z.json` PASS，三完整800×600、1920×1080、3840×2160截图已亲看。67控件在DOM映射，非活跃名单/页签保留hidden；可见控件全在视口内。服务确认拥有实例1“游骑兵”、2“飞毛腿”，money14000/tokens1000与源余额一致，当前可见名单数量2。六原保养按钮全部disabled/unbound，源费用字由consumer明确留空；raw costs[]未构成六字段运行测量，只以源码说明空值。

普通鼠标选首条、nativeArrowDown到第二条且选中/获得焦点，window漏键为空。普通Part页的Common/Hat/Mark依次切换，原库存确为0，名单和数量均0；返回Tank仍保有两实例，源Close返回可操作Shop入口。只读复制home-tank-active-marker-browser.sqlite并严格绑定其私有token；保留库不修改，未购买、配置、保养或开局。旧资金-only上下文沿该checkpoint来源说明。

source/accepted封装 `recovery/output/shop-mend-source-page-{source,accepted}.json`，交root主审与下一必要统一发行构建。当前并未验有部件内容的图标、长名单滚动或维修执行；该真实空名单不以购入夹具补造。父项维持开放。

主审有限接受见 accepted.mainReview；统一 `mend-complex-map-production-web-build-final.log` 严格Webtypes及Vite exit0（1m31）已包含该稳定只读消费者，未重复页面验收。

当前相关状态：`MendShopSourcePage` 的拥有部件名单行已按只读 profile 派生当前角色 `installed`，命中时由 `MendPartRowContent` 渲染既有 `HomeRoleRowStatusBadge(status="installed")` 静态原 `SmallHT E`（point 5,8、14×14，CSS 只扩 `.mend-shop-list > [data-mend-owned-part-row]` 父 scope，Home/Trade 选择器不变）；该 `installed` 复用 `tankMaintenance` → `partMaintenance` → `roleProfile` 优先 bundle 及原 MAINTAIN profile 覆盖，维修 Hat 分类已支持 `classifyItemId === 5 || 6`（coarse 3 真实 5/6），维修资格/报价/墙钟不改。该 `E` 无实测，不复用旧 PNG/native 向量宣其通过；详 shop-mend-owned-equipment-status-presentation.md、M5-10-PART-STATUS。
