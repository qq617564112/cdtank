# M5-02-MS 模式与地图选择建房

正常创建房间表单可打开模式/地图选择。五种模式使用原选择按钮，地图使用八个原位置与原底图/名称/缩略图。数据来自真实 ListMaps，按模式过滤后每页八件，不把其他模式的同名/同ID地图当可用项。

选择在弹窗内编辑草稿；关闭或 Escape 保留表单模式、地图、人数与友伤。确认重新核对当前目录的 mode/mapId 后写回普通建房表单，重置原地图人数限制，并清除个人模式不支持的友伤。普通“创建并加入”继续走现有账户与服务端 CreateRoom；服务端资格、密码、房间初始化和地图加载不另建旁路。

## 模块边界

- `apps/web/src/interface/lobby/room-map-options.ts`：模式过滤、八件分页、合法选择及预览引用。
- `room-map-selector.ts/css`：源控件舞台、草稿、确认/取消和键鼠焦点。
- `room-controls.ts`：当前真实目录、普通表单写回和 CreateRoom 接线。
- 来源脚本只在 `recovery/evidence/rooms/room-map-selector-source.py`；浏览器验收在 `tests/browser-room-map-selector.mjs`，不进入正式发行。

## 来源与重建边界

原 `selectgamemode.xml` / `selectgamemode_icon.xml` 提供五种模式按钮、八地图位置、地图底图和名称矩形。模式身份复用 M5-02-CM 已执行的五原回调。最小原生产者 4a5c12 执行208组，证明 record+0xc 数值经 `data\\ui\\xiaoditu\\%.4d.tga`/xiaoditu0 写入对应槽的 picMapImage。

**record+0xc 的上游 loader 等于 MapID 尚未证明**：正式 Web 将当前已恢复地图表 MapID 作为此数值来源，属于明确重建接线。相应13个唯一MapID都有原106×86图片，引用由现有资源解析器优先使用DDS地区76。草稿/确认、页面索引、模式切换默认第一地图、确认后重置表单与无效选择拒绝也是重建交互，不宣称恢复原完整回调。推荐/活动/新图/节日徽章只有静态源图，没有当前业务元数据，因此不生成标记。原完整建房/目录网络流程仍由 M5-02/UI-05 恢复。

## 本片验收

规则命令 `npm run test:rooms:map-selector`：五模式四状态源图、26真实mode/map的原预览资源；独立19地图夹具覆盖八件分页、跨模式过滤、缩页与过期选择拒绝、空目录与非法ID。真实目录各模式均不超过八张，真实浏览器不注入额外目录来伪装多页。

真实页面命令 `npm run test:rooms:map-selector:browser`，范围为普通选择/取消/确认/人数拒绝/正常CreateRoom权威WAITING、1080p/4K原矩形及原图片加载；结果在 `browser-room-map-selector.json`，详见 `room-map-selector-browser.md`。未修改战斗生命周期与账户保存，已有CPU连续两局、双端同步和重启恢复基线继续有效。

工程证据：`room-map-selector-types.log`、`room-map-selector-boundaries.log`、`room-map-selector-build-web.log`；检查新增生产模块的类型、正式依赖隔离与Web发行。原资源/操作业务验收不代替原Windows完整画面像素等价。
