# Map02 水面动画新入口准备

M3-06/M7-02：原水面资源、shader字段、实际texture/offset推进和正常Leave证据复用。剩余范围为普通玩家画面中的可辨动画时序；此前北岸受阻路线保持FAIL。

`tests/map02-water-entry-prepared.cts` 使用已发布water bounds、正式Map02 NAV、当前Castle2/ENV60静态碰撞与原battle-camera公式，唯一离线执行出口0。输出 `map02-water-entry-prepared.json/.log`。

原NAV策略单独不包含建筑碰撞。新候选要求其canTraverse与当前field.move静态碰撞均接受；clearance使用49×52角色 footprint的外接圆。这是保守路径筛选，不替代原OBB权威移动，也不修改生产策略。用原body yaw和相机公式派生eye，firstSurfaceHit仅提供当前碰撞几何的视线依据，不代表视觉mesh全部无遮挡。

| 候选 | 当前两出生点的路径点数 | 原相机到水面中心的提前碰撞 |
|---|---|---|
| 南岸(-850,-620) | 4/6 | 无 |
| 东侧(-250,-400) | 9/9 | 无 |

下一普通输入优先南岸新入口：真实W/A/D导航并转车身朝水面，保持正式相机；只在实际到达与water/waves真实draw后记录自然时序画面。主端南岸、客端东侧先后观察各自新入口，不因被动远景或单帧texture变化冒双端可见动画。未到达则保存路径输入和实际阻挡，不启动旧北岸路线或盲目追加。

离线入口资格是 prepared 范围；普通移动实测见下文。原source模型、时钟、相机、规则与shader保持。

独立driver为 `tests/browser-map02-water-natural-prepared.mjs`，观察器为 `tests/observers/map02-water-natural-browser.mjs`。建议隔离ports3600/5630/9830，编译server与当前正式Web资源复用。双Login后Create/Join前安装，host南岸、guest东侧依次普通导航，每端最长120s；到达后三张自然whole与同scope的真实draw/texture/offset读数配对。成功出口只标AWAITING_WHOLE_TEMPORAL_REVIEW；是否可辨水面动画由完整画面审定。失败保存INCOMPLETE并正常Leave，既有退出资源读数与environment disposal同时保存。

## 普通入口结果

唯一 session27319 实际出口0，原 `browser-map02-water-natural-2026-10-05T18-34-04-504Z.json` 为 INCOMPLETE。主端59、客端14条普通输入后，两端规划均返回 route unavailable；实际到达0、whole截图0。主端最后记录位置为(-1439.82,-546.69)，客端为(-1241.2,514.32)，均未取得对应观察岸边资格。最后输入不是失败时的精确状态，不能据此归因具体碰撞或生产缺陷。

双端各一次water load，累计water/waves实际绘制主端85/85、客端48/48。bank阶段未进入，阶段draw数组为空；水面画面动画时序仍未观察。正常双Leave的players、Plant roots、effects、scene voices、battle voices均0；finally临时目录已移除，serverExit1、ChromeExit0，亲查3600/5630/9830为空。

证据包装为 `../output/map02-water-natural-player-evidence.json`。两个rendered账户使用预房显式导入tank1/pet1记录，另有两个认证被动账户；本范围不证明取得流程。地图0002整图恢复与高清性能保持开放。

实际有限主审：`../output/map02-water-natural-root-review.json` / `ACCEPTED_FINITE_NEW_WATER_ROUTE_INPUT_DRAW_LEAVE_WITH_BANK_VIEW_GAP`，接受普通路线输入、累计双water/waves绘制与正常Leave清理；原raw INCOMPLETE、到达0/whole0与岸边画面时序缺口保持。
