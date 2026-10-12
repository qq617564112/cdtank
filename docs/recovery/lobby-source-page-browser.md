# 正式大厅整页页面验收

正式原大厅框架已替换临时纵向面板与房卡大dialog。800×600、1920×1080、3840×2160 同一整页stage的源背景、左房间区、右玩家框和底聊天区均有真实截图；正常目录浏览、翻页选择、创建取消、加入退出及我的家/商城返回保持中文昵称与焦点。整页截图在 browser-lobby-source-page-2026-10-04T05-52-01-834Z-{800,1080p,4k}-{first,second}.png。

该运行完成五个实际页面scope：三分辨率源几何与正常选房、页二R17、Home/Shop查询打开/Escape返回源按钮焦点；ID/EMPTY排序和页复位；原模式地图选择取消和原建房中文草稿取消均回原创建入口；正常源快速进入R17，Join响应playerId与WAITING/mapLoaded一致，再源Close Leave回完整大厅。正式页没有#tank/CPU/旧房间select/旧创建表单/aside.controls和房卡dialog。六PNG独立lobby-source-page-pixels.json对照明确无遮源区域：主背景顶带832–10490不透明样点/图、右框14–922样点/图全部最大RGBA误差0。

我的家必要玩家导航复用既有页面。在 browser-lobby-source-page-2026-10-04T05-54-34-528Z.json 完整成功的首scope中，装备、战车与宠物、对局记录、键位及快捷聊天逐项普通点击打开、Escape返回正式大厅通过；不重复账户事务/保存或库存业务。

验收汇总索引为browser-lobby-source-page-accepted.json，逐片保留原运行状态和完成范围。

主线 browser-lobby-chat.json 已验证正式整页普通中文双端唯一身份消息、输入组合候选Enter/重复Enter、模式地图→创建WAITING大厅隔离、源Leave后清理与重新发送，直接引用该有效业务，不重复聊天开发或全套操作。

## 边界与证据

六图原运行的整体FAIL保留：其五scope和PNG已完成，末端辅助像素抽样未满足采点数量。源像素独立复核仅取明确无遮背景/右框区域，不称全部整页、聊天框复杂重叠或滤镜边缘逐像素等价。05-54-34导航scope成功证据保留，后段密码提示的夹具条件未完成；05-57-07最后片已完成普通外部新房R18自动发现、候选Enter零Join、错误中文密码拒绝/保持草稿、正确中文密码普通Enter成功Join与R18 WAITING/mapLoaded；后续等待页开启未到Close控件，整体FAIL保持。该片正常Leave终点引用首scope的R17及主线聊天sourceLeave，未宣称一次完整运行PASS。

正式在线名单、玩家资料、关系业务及Home库存/角色根页的后续交付分别见lobby-presence-accepted.json、player-info-page-browser.md、player-info-blacklist-browser.md、home-page-browser.md和home-roles-page-browser.md。完整原客户端1:1、Windows/GPU/display与原回调仍属未完成父项；当前源图DDS/TGA选择来源边界见lobby-source-page-source.md。正式源页签定位与整页实际画面见lobby-whole-page-browser.md。当前五秒目录更新、Web身份输入与源按钮到现API映射的范围见lobby-source-page-source.md。发行、类型和模块边界由root统一核验。

像素复核：

```sh
recovery/.venv/bin/python tests/lobby-source-page-pixels.py recovery/output/browser-lobby-source-page-2026-10-04T05-52-01-834Z-pixel-input.json
```
