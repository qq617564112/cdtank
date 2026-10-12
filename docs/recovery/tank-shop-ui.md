# 正式商城首件战车购买

M6-06-T03在现AccountShopView同一商城根页开放原shop.xml的rdoTankPage，返回道具分类沿原rdoItemPage。TankShopView使用shop_tankpage.xml的左商品列表lstTank（全局12,50，192×279）、原右背景/详情框、金钱区与btnBuy（217,286，230×43）；btnBuy直接消费mycabin00的goumai1/2/3图态。商品目录与余额由TankShop QUERY确认。

首件为原战车3游骑兵，金钱价2500，表代币价250；原购买方式2比较金钱。本片仅提供MONEY购买，未提供代币付款入口。价格、默认纹理与拥有字段来源见tank-purchase-source.md。原购买成功服务器未恢复，当前可售目录、购买建档、确认结果及详情文字接线是明确Web重建。

M5-10-T03-P将TankProductPreview接到原picModel（225,52，218×217），使用确认商品tankId与默认textures，以及同一商城scale；原picModel没有静态Image，模型由独立场景消费者绘制。介绍映射原edtDescription（460,124，122×45）并可滚动，售价显示在右详情区，不遮模型。此文字映射不代表完整原数值详情，商城预览不复用我的家环绕镜头。

AccountShopView跨关闭持有TankPurchaseOwner，保存选中定义、未确认BUY requestId与inFlight。相同候选重试保留原requestId，同步inFlight阻止双扣请求；拒绝保持候选，查询与购买迟回复不写旧页面，关闭后完成可刷新新会话。确认显示服务器purchased记录+1c实例，余额只采用确认回复，不自动调用选车。普通关闭恢复既有商城入口焦点，键盘隔离沿同一modal，提交后恢复购买按钮焦点。

ShopSource.tankShop为可选回调，正式入口由主线提供；旧Item验证fixture可继续只提供shop。Item请求owner与交易流程保持原接口。选择器为data-shop-root-category=Tank/Item、data-tank-shop-item、data-tank-shop-product、data-tank-shop-buy、data-tank-shop-balance、data-tank-shop-refresh、data-tank-shop-status与data-purchased-tank-instance。

返回Item分类调用既有Shop QUERY刷新，余额沿权威回复更新；返回Tank分类挂载后执行TankShop QUERY。两个目录不把彼此购买前余额作为新确认状态。

首次普通正式Tank分类购买、拒绝、返回与我的家选车由业务浏览器证据验收；不重复原商城三分辨率或像素裁切，完整商城分类与1:1父项保持未完成。

购买接线的Web项目TypeScript检查通过：npx tsc --noEmit --project apps/web/tsconfig.json。

正式购买业务由tank-purchase-network-2026-10-04T12-20-26-645Z.json与browser-tank-purchase-2026-10-04T12-21-16-128Z.json通过。普通Tank分类选择游骑兵、付2500金币确认余额500与拥有实例1，返回Item确认余额500；余额不足拒绝保候选。源Close返回后在我的家选择新实例，tank3实际绘制32次、普通开火与Leave通过。购买及Home/战斗截图由主线实际查看；该购买业务证据不包含商城模型预览；预览独立有效证据为browser-tank-shop-preview-2026-10-04T12-33-17-667Z.json。三分辨率实际源模型/三纹理绘制、刷新/购买/拒绝保留场景、切页/关闭释放和重开均通过，见tank-shop-preview-browser.md。商城镜头/照明仍为明确重建，完整原页面精度保持未完成。
