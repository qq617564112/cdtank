# 房卡购物入口实际验收

browser-room-card-shop-entry-2026-10-04T04-32-32-693Z.json完整PASS5，accepted索引收录13实际PNG：三分辨率Normal/Hover/Pushed共9图、三个商城模态图及refresh pending禁用图。原来源见room-card-shop-entry-source.md。

3317专属服务普通API建立12房，与系统5房构成17房目录，普通下一页选R17为初态。800×600/1920×1080/3840×2160均验证btnShopping源(85,276)/89×39矩形与目的几何、视口可见、elementFromPoint命中、图片alpha1与pointer-events:none。原N/H/P资产精确引用，九张实际截图的原源3×3同质opaque内区RGB逐项一致；800实际PNG已目视检查，原图片中文字为“商店”。

每个分辨率普通原按钮打开既有AccountShopView，真实Shop QUERY成功返回7件商品，中文商品内容包含响应中首件商品名称。新账户未提供money/tokens，界面显示“账户尚无余额资料”，不造余额。目录保留为下层；商城ArrowRight/a键不改变目录选择、页码、排序或world。800/4K返回按钮、1080p Escape分别关闭商城，焦点回源购物按钮，page2/2、R17、ID排序与中文昵称保持。

可信Enter与Space分别再次打开并取得新QUERY响应，每次关闭恢复源焦点与目录。合计五份成功真实Shop QUERY，BUY请求与Kitbag请求均为0，未触购买或账户写入，未创建游戏world。

普通refresh pending期间短暂停专属服务，源购物按钮disabled/state Disabled，缺DisabledImage故零图片层，可信点击不能打开商城。实际busy截图中心RGB(38,59,73)等当前Web面板；finally恢复服务，响应后按钮恢复。3317/5341/9541与临时目录全部清理。

## 边界

原完整Shopping回调与商城/大厅全窗口布局、GPU画面仍未恢复；现入口到React商城与返回来源焦点为明确Web投影，本片不关闭原完整shop.xml或roomlist.xml。原04-31-48raw FAIL保留其源图与busy证据，未将错误余额假设改成账户资料。验收限定查询，不重跑购买、五模式或账户重启。
