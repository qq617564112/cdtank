# 商城物品名单纵栏来源准备

UI53/M5-10。当前左右真实ShopItemSourceList已恢复商品、拥有、选中和查询事务，仍使用浏览器纵栏。原shop_itempage.xml lstShopItem为376×279、lstMyItem为192×279，两者WindowsLook/MultiColumnList、HeaderVisible=False、frame图片空；完整纵栏源资源和minExtent53均存在。

独立 `shop-multi-column-list-area-native.py` 执行原WLMultiColumnList::getListRenderArea 0x10019530，两个源名单尺寸各四组纵/横栏显隐，`shop-multi-column-list-area-native.json` PASS8。空frame与隐藏header对应零inset，启用纵栏扣其提供宽度、启用横栏扣其提供高度。向量中的8.5为显式provider，不能据此宣称原factory宽度。

原layoutComponentWidgets 0x100199b0另读取header/Font及现child尺寸，当前只保存入口辨认；不借Listbox/RichEditbox类型推断其初始宽度。已有42px Web商品行、32px图标、两价文字、真实库存和交易owner可保持。后继consumer需完整左右名单及真实分类/商品可达，原纵栏与现callback保持，未知列producer/字体/GPU保留父项。

这是来源准备，未改商城生产、未开始新浏览器验收。已有购买、余额、拥有和三res记录直接复用，不以新BUY制造长名单；右目录本已溢出可作为必要源纵栏首验上下文。页端文件归属须开发前协调具体ShopItemSourceList hunk。

主线确认owned hunk后现已接ShopItemSourceList外shell及专属ShopListScrollbar/CSS，数据属性、候选、keydown导航、QUERY/交易owner保持。右实际目录与左确认库存使用独立滚动位置；source控制映射在shell，现listbox/roleoption/data选项属性在内层。width8.5与step42为明确Webprovider，minimum53/scale；范围、轨道、比例thumb保既有原primitive合同（不夹短track，negativeTravel保留）。图片上29/下17/中7，clip命中取可见8.5与28资源交集。当前matrix期间尚未types/build/actual，不称页端验收通过。

后继HomeInventory原lstPlayerItem同为MultiColumnList、隐藏header与空frame，源192×224名单消费者可复用该原扣除合同；尺寸仍来自本页布局，不将商城279高度强套到Home。后继独立模块尚未接入生产入口。
