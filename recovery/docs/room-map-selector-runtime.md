# M5-02-MS 模式与地图选择建房

正常创建房间表单可打开模式/地图选择。五种模式使用原选择按钮，地图使用八个原位置与原底图/名称/缩略图。数据来自真实 ListMaps，按模式过滤后每页八件，不把其他模式的同名/同ID地图当可用项。

打开选择器及切换模式时不预选地图，也没有额外的地图确认条。点击地图或用 Enter／空格激活地图按钮后，重新核对当前目录的 mode/mapId 并立即写回建房草稿，重置原地图人数限制，清除个人模式不支持的友伤；正式大厅随即打开原建房设置窗口。编辑房间共用此入口并保留现有设置。关闭或 Escape 不改草稿。建房设置窗口的确定按钮继续走现有账户与服务端 CreateRoom；服务端资格、密码、房间初始化和地图加载不另建旁路。

## 模块边界

- `apps/web/src/interface/lobby/room-map-options.ts`：模式过滤、八件分页、合法选择及预览引用。
- `room-map-selector.tsx/css`：源控件舞台、点击提交/取消、悬停动画和键鼠焦点。
- `room-controls.ts`：当前真实目录、普通表单写回和 CreateRoom 接线。
- 来源脚本只在 `recovery/evidence/rooms/room-map-selector-source.py`；浏览器验收在 `tests/browser-room-map-selector.mjs`，不进入正式发行。

## 来源与重建边界

原 `selectgamemode.xml` / `selectgamemode_icon.xml` 提供五种模式按钮、八地图位置、地图底图和名称矩形。模式身份复用 M5-02-CM 已执行的五原回调。最小原生产者 4a5c12 执行208组，证明 record+0xc 数值经 `data\\ui\\xiaoditu\\%.4d.tga`/xiaoditu0 写入对应槽的 picMapImage。

**record+0xc 的上游 loader 等于 MapID 尚未证明**：正式 Web 将当前已恢复地图表 MapID 作为此数值来源，属于明确重建接线。相应13个唯一MapID都有原106×86图片，引用由现有资源解析器优先使用DDS地区76。原 `selectgamemode_icon.xml` 使用148×154的 `gy0/dituditu.tga` 卡片底图，没有独立 HoverImage 或悬停动画帧；当前复用原底图、预览和名称，悬停及键盘焦点让视觉内容上移6像素、120ms过渡，点击回压至2像素，命中区域保持不动。这些动效参数为Web采用值。原 `0x4a6c73–0x4a6cd2` 为八个卡片注册 MouseClick 回调 `0x4a6858`；该回调在资格检查后关闭选择器，并通过 `0x4a6936–0x4a6942` 提交模式和地图。此处为静态反汇编核对，没有执行原回调。推荐/活动/新图/节日徽章只有静态源图，没有当前业务元数据，因此不生成标记。原完整建房/目录网络流程仍由 M5-02/UI-05 恢复。

## 本片验收

当前点击直接进入建房设置与悬停动效仅做静态核对，页面实测待补；下列既有证据保留其原目录、资源和建房事务范围，不证明新增交互已经实际验收。

规则命令 `npm run test:rooms:map-selector`：五模式四状态源图、26真实mode/map的原预览资源；独立19地图夹具覆盖八件分页、跨模式过滤、缩页与过期选择拒绝、空目录与非法ID。真实目录各模式均不超过八张，真实浏览器不注入额外目录来伪装多页。

真实页面命令 `npm run test:rooms:map-selector:browser`，范围为普通选择/取消/确认/人数拒绝/正常CreateRoom权威WAITING、1080p/4K原矩形及原图片加载；结果在 `browser-room-map-selector.json`，详见 `room-map-selector-browser.md`。未修改战斗生命周期与账户保存，已有CPU连续两局、双端同步和重启恢复基线继续有效。

工程证据：`room-map-selector-types.log`、`room-map-selector-boundaries.log`、`room-map-selector-build-web.log`；检查新增生产模块的类型、正式依赖隔离与Web发行。原资源/操作业务验收不代替原Windows完整画面像素等价。
