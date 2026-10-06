# 建房玩法／地图选择器来源

M5-02-MS：原八槽选择器、五玩法按钮及当前26个模式／地图组合的预览资源已确认。`picMapImage` 的原动态图片生产者为 `0x4a5c12`，当前13个独立 MapID 均有已发布原预览，无缺失项。

## 原布局

`selectgamemode.xml` 的 `SheetWindow` 原矩形为 `(62,80)–(736,515)`。五个命名按钮从左到右为破坏、混战、团队、占领、擒王；五原回调及原编号0–4的执行证据复用 `room-mode-icon-source.md`，Web编号为1–5。

地图容器 `youbiandaditu` 相对根窗为 `(1,35)–(674,404)`。第一排四槽起点 `(10,15)`、`(171,15)`、`(334,15)`、`(497,15)`，大小158×168；第二排对应起点y=182，大小158×167。`selectgamemode_icon.xml` 根 `all` 大小158×168，内层 `ditu` 为 `(7,12)–(155,166)`，`picMapImage` 相对 `ditu` 为 `(21,20)–(127,106)`，大小106×86。预览和原图片裁切尺寸一致。

`picMapImage` 在XML中没有固定 `Image`，由原生产者赋值。卡片底图、五玩法按钮的三状态图片、分页按钮、四种地图徽标等52条固定图片属性均在 `ui.json` 解析到现有PNG；原XML属性与发布布局一致。精确矩形与每条资源引用见输出JSON的 `layouts` 和 `staticResources`。

## 原动态图片生产者

`0x4a5c6e–0x4a5c74` 计算槽位索引 `page*8+slot`；`0x4a5c77–0x4a5c84` 选择控制器 `+0x28+mode*16` 的地图向量。`0x4a5c94–0x4a5c9f` 从向量选定记录读取 `+0xc` 的地图整数。

`0x4a5ca2` 引用 `0x5ccdf4` 的 `data\ui\xiaoditu\%.4d.tga`，`0x4a5cb3` 格式化该整数；`0x4a5c2d` 保存 `0x5cce10` 的 `xiaoditu0`。`0x4a5cf7–0x4a5cfe` 向控制器 `+0xbc+slot*4` 控件调用双字符串 `StaticImage::setImage`（IAT `0x5c0134`）。没有模式前缀、减一或 `_hui` 后缀。

原控件初始化在 `0x4a4b60` 查找 `ModeIcon0/picMapImage`，`0x4a4b8e` 保存到 `+0xbc`；`0x4a4cfc` 查找 `ModeIcon7/picMapImage`，`0x4a4d24` 保存到 `+0xd8`。这与生产者的八槽控件偏移一致。

## 当前预览映射

来源为 `m001.json`–`m005.json` 的26条记录，13个独立 MapID。图片名为 `data\ui\xiaoditu\{MapID四位十进制}.tga`，imageset为 `xiaoditu0`。`ui/imagesets/xiaoditu_0.imageset` 对应以下PNG；`ui/imagesets_dds/xiaoditu_0.imageset` 另发布相同命名与裁切矩形到 `ui/regions/76/`。运行时可使用已发布imageset解析约定。

| MapID | PNG | 原裁切起点 |
| --- | --- | --- |
| 0002 | ui/regions/43/2.png | 212,0 |
| 0004 | ui/regions/43/6.png | 636,0 |
| 0005 | ui/regions/43/8.png | 848,0 |
| 0006 | ui/regions/43/10.png | 106,86 |
| 0007 | ui/regions/43/12.png | 318,86 |
| 0010 | ui/regions/43/18.png | 0,172 |
| 0011 | ui/regions/43/20.png | 212,172 |
| 0014 | ui/regions/43/26.png | 848,172 |
| 0017 | ui/regions/43/32.png | 530,258 |
| 0018 | ui/regions/43/34.png | 742,258 |
| 0020 | ui/regions/43/38.png | 212,344 |
| 0021 | ui/regions/43/40.png | 424,344 |
| 0022 | ui/regions/43/42.png | 636,344 |

全部原裁切为106×86；完整模式／地图名称对应关系见JSON的 `previews`。

## 可复现执行证据

```sh
recovery/.venv/bin/python recovery/evidence/rooms/room-map-selector-source.py
```

输出 `recovery/output/room-map-selector-source.json`：26个模式／地图组合×八槽，共208次原生产者指令执行，验证原格式化结果、imageset、setImage实际目标、分页索引与栈平衡；另验证两XML发布属性、52条固定资源引用及26个预览的已发布PNG存在性与原裁切尺寸。结果PASS。原生产者与首末槽初始化反汇编包含在输出中。

## 限制

执行从原图片生产者输入开始，提供地图向量和记录 `+0xc`，printf和CEGUI字符串／setImage出口使用明确hook。上游原表加载到记录 `+0xc` 的链路及完整地图点击／在线建房回调未执行；后续入口为 `0x4a5c12` 的模式向量来源和原八图控件事件注册 `0x4a56c0–0x4a56d2`（事件编号 `0xe4`）。本证据确认当前表MapID对应的原预览资源与赋图公式，不能关闭完整M5-02父项。
