# 房卡 Home 入口实际验收

browser-room-card-home-entry-2026-10-04T03-54-20-307Z.json一次完整PASS5，accepted索引收录13实际PNG：三分辨率Normal/Hover/Pushed共9图、三个库存模态图及一个refresh pending禁用图。原来源见room-card-home-entry-source.md。

3316专属服务普通API建立12房，与系统5房构成17房目录。普通下一页选R17作为初态。800×600/1920×1080/3840×2160均验证btnMyHome源(4,276)/81×38矩形及目的几何、视口可见、elementFromPoint命中、alpha1与图片层pointer-events:none。原Normal/Hover/Pushed资产精确引用，源3×3同质opaque内区映射九张实际截图，全部样本RGB逐项一致；800实际PNG已目视检查。原btnMyHome图中文字为“玩家信息”，当前aria“我的家”与打开库存为明确Web入口投影。

三分辨率普通源按钮打开既有HomeInventoryView，真实当前账户Inventory响应成功，新账户records为空，界面显示空库存。目录保持下层，库存ArrowRight/a输入不改变目录选择、页码、排序或world；800/4K普通返回按钮、1080p Escape分别关闭库存，焦点回原源按钮，page2/2、R17、ID排序与中文昵称保持。

可信Enter与Space分别再次打开并取得新Inventory响应，每次关闭恢复源焦点与目录。共五份成功真实Inventory响应，无Kitbag写请求，未创建游戏world，未注入物品或游戏状态。

真实普通refresh pending期间短暂停专属服务，Home source按钮disabled/Disabled，缺DisabledImage故零图片层，可信点击不能打开库存。实际busy截图中心RGB(38,59,73)等当前Web面板。finally恢复服务器，响应后按钮恢复可用。所有3316/5340/9540进程与临时目录清理成功。

## 边界

原完整MyHome回调与原完整窗口未恢复；原btnMyHome图/位置/draw明确，当前库存入口、资格和返回焦点沿既有React业务。库存页完整原样式/GPU画面不属本片，未声明完整MyHome等价。验证限定空库存真实查询与模态入口，不重复物品装配、五模式或账户重启。
