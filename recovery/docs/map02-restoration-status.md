# 地图 0002 整图恢复清单

## 当前执行基线

地图002按最新目标视为完成，实现与既有证据供其余地图复用；不再追加局部测试、补证或验收。既有证据的范围记录保持。当前地图04整图实现约束见map04-execution-constraints.md。

执行约束：地图02全部整体修改完成前，禁止浏览器验证、单消费者运行、失败补证和局部证据封装；停止小批次队列，现有证据复用。整体实现范围及共享接口见 `map02-whole-map-implementation.md`。

当前固定地图 0002。整图恢复、多人与高清交付尚未完成。范围按原始 placements、状态消费者、环境动画与声音、正常游戏事件和生命周期登记；单个模型的有限验收不替代整图验收。

## 原始内容与正式消费者

来源：`../output/web-assets/scene-placements.json` 中 `id=0002`。原场景 93 条记录，另有 Castle 304/305，74 个 collisionBoxes；terrain 为 `Data/map/0002/0002.glb`。

| 内容 | 原始数量 | 当前状态 | 尚缺内容 |
|---|---:|---|---|
| Breach 05425 | 16 | 完整材质有限接受 | 正式 c9/GA32 Preview 与 ENV60 已接；117/123 合并代表普通首跑 PASS，离线8/6节点矩阵exact；有限主审已回链 |
| Breach 05426 | 10 | 完整材质有限接受 | 正式 c9/GA32 Preview 与 ENV60 已接；117/123 合并代表普通首跑 PASS，离线8/6节点矩阵exact；有限主审已回链 |
| Breach 05427 | 6 | 完整材质有限接受；新六节点 c9/GA32 正式导出及 Preview 已接 | source126 唯一普通首跑 PASS；host 六节点多姿态/双 GA32/Leave 已实证，有限主审已回链 |
| Breach 05422 | 8 | 完整材质有限接受 | 正式 c9/GA13 Preview 与 ENV60 已接；401 合并代表普通首跑 PASS，离线10节点矩阵exact；有限主审已回链 |
| Breach 05428 | 20 | source214 五节点 c9/GA30 双端实际多姿态、声音、淡出、Leave 有限接受 | 其余实例只按源与加载覆盖，未独立逐实例像素验收 |
| Plant 05413 | 29 | 原材质 owner、纹理及 plant80 sway 正式消费者已接 | 正式 source-ID hidden snapshot/root接线已落；new327普通type100接触双snapshot/root隐藏/host绘制停止/双Leave有限接受（原rawINCOMPLETE观察字段缺口保）。同raw双端各13来源有两实际绘制位置；全29独立像素与原GPU等价仍未验 |
| Sound BG06/BG05/BG11/BG12 | 4 | 四 voice 播放、循环、增益与正常 Leave 有限接受；整局后旧四音频暂停，新房 revision1→3 四源 voice 恢复 | 主端活跃房间自动恢复同owner/四BG续播及正常Leave已有限记录；原30s规则来源与高清范围未闭合 |
| Castle 05447/05448 | 2 | 原 ID304/305 与原资源正式接线；304 战斗阶段、声、两局和 Leave 有限组合证据；305普通47命中至破坏、双c2/n2/c3绘制及事务/Leave有限接受 | 305主端受损/倒塌画面与声音输出已收，客端独立像素/可听未收；既有证据未覆盖的原伤害数字表现 |
| Terrain | 1 | 58 opaque +18 GREATER100 原材质组正式接线，双端有限绘制接受 | 全图可见性、原采样/culling 等价与高清性能 |
| Water/waves | 原专属资源 | 32 DDS RGBA 与 UV/shader 源字段；河岸水面有限可见 | 同new327 raw双端 water/waves96vertices三实际纹理/offset推进已记录；new南/东入口首轮INCOMPLETE，双route unavailable/到达0/whole0；whole画面水时序归属/原GPU等价仍未验 |

四条 Sound 的空 geometry asset 属专属声音消费者。地图没有 General/CVD/Crush class placement。当前 texture-gaps-sol 索引中，地图 0002 与上表模型没有对应未解纹理记录；这不替代全部资源和 GPU 等价验收。

## 可复用证据

- Terrain：`scene-terrain02-material-player-evidence.json`，有限原材质/42与52原 part 绘制及双 Leave。
- Intact：`scene-breach02-intact-material-root-review.json` 及 05426、05427、05428、05422 的具名 root-review；复用原 POL、材质字段及普通入口。
- Broken27：`scene-breach02-05427-destruction-root-review.json`，host 六节点多姿态/原矩阵几何误差0、双 GA32 与同事务/Leave 有限接受；remote 结果反馈与声音触发已观察，root2432 实例和画面未证明。
- Broken28：`scene-breach02-05428-destruction-root-review.json`，`PASS_FINITE_MAP02_HOST214_C9_GA30_POSE_DUAL_LEAVE_SCOPE`；`scene-breach02-05428-actual.json` same-frame 五节点矩阵/几何 exact。工程 `map02-resource-ready-engineering.json`。
- Castle：`castle02-composed-evidence.json`，304 的 n1/n2/c2/c3、GA48/se03/se07、普通自然终局与 rematch 组合；原 raw INCOMPLETE 及有限补证边界保留。305 新状态证据不从 304 推定。
- Castle305：`castle02-305-player-evidence.json` 回链实际 `castle02-305-root-review.json`；原HP2000、47普通命中/一次破坏、双端48事务完全一致，双n1/c2/n2/c3实际绘制，主端GA48/se03/se07输出及实际停止/双正常Leave已收。客端peak0与远景像素范围保留，未扩大为独立可听/像素或spout全实例验收。
- Plant：`scene-plant02-material-source.json`、具名 sway/material native/module 旧证；`scene-plant02-player-gap.json` 保留两次普通路线未绘制结果。
- Water：`scene-water02-source.json` 与 `scene-water02-bank-evidence.json` 提供水面可见/双 Leave；`scene-plant02-contact-player-evidence.json` 登记新327同raw双端 water/waves 的96vertices、三实际纹理及 offset 推进。`map02-water-natural-player-evidence.json` 回链实际 `map02-water-natural-root-review.json` / `ACCEPTED_FINITE_NEW_WATER_ROUTE_INPUT_DRAW_LEAVE_WITH_BANK_VIEW_GAP`，登记新南/东普通路线首轮INCOMPLETE、到达0/whole0、双正常Leave五资源0；whole画面水时序与原GPU等价仍未验。
- Sound：`scene-environment-sound02-source.json` 与 `scene-environment-sound02-actual.json`，播放接受，旧 raw FAIL/reentry 缺口保留。
- 生命周期：既有 `continuous-sessions-accepted.json` 地图 2 两次 session 与 modes 2/3 两局一致性证据复用，不能代新增消费者的整图重入与全部内容覆盖。
- 整局与重入：`map02-full-session-player-evidence.json` 回链 `map02-full-session-root-review.json`，mode1 两自然300s TIME_LIMIT、1670共同tick完全一致、R6→R7正常新房重入及两次双Leave资源0有限接受；双1920/3840实际render尺寸与软件帧间隔已记录。327两局及重入均未隐藏，不证明hidden→visible恢复；305只n1绘制。软件渲染慢帧与原GPU等价仍开放；mode2后续有限范围见下一条，mode3未完成。
- Mode2：实际 `map02-mode2-full-session-root-review.json` 有限接受两自然OBJECTIVE终局wall66684/54650ms、270共同tick全同、正常R6→R7重入及两次双Leave清零。双方PLAYING实际1920帧107/103、3840帧19/20；标名playing的3840-2截图已是结果页，不算客端PLAYING整帧。原首轮控制入口FAIL保留。mode2不新增mode1的Castle/ENV伤害权限，高清流畅性与mode3仍未完成。
- Mode3：实际 `map02-mode3-directed-root-review.json` / `INCOMPLETE_MODE3_HD_DISCONNECT_WITH_VIEWPORT_FIX_ACCEPTED`；`browser-map02-full-session-2026-10-05T17-46-07-498Z.json` 保持 FAIL，cleanups为空；双端已有 round1/3840 与 round2/1920 的 PLAYING 实际尺寸，不能据此关闭两局、Leave及重入范围。失败时双端viewport/client/backbuffer均1920×1080，原15px尺寸缺口已修，断联原因仍未证。`map02-render-timing-actual.json` 唯一离线汇总仅按 room/round/实际尺寸分组；SwiftShader 的3840帧间隔中位数主/客1317/1985.35ms、环境 advance 1.45/2.6ms。详见 `map02-render-timing-evidence.md`，高清性能仍未完成。
- Mode3普通生命周期：实际 `map02-mode3-normal-lifecycle-root-review.json` / `PASS_FINITE_MAP02_MODE3_NORMAL_ENTRY_INPUT_LEAVE_REENTRY_SCOPE`；71174实际出口0及root亲三空。新17-55-21 raw PASS的1920普通输入、42共同tick全同、R6→R7新房重入、两次正常双Leave全部资源/ledger/voice/input清零与BG revision1→3有限接受，无webSocketClosed。该tail未证明自然两局、Plant hidden-reset或4K连接与性能，原两FAIL及4K/时序数据分列保留。

全部60 Breach具名状态消费者已正式接线；新25/26/22的三个代表见 scene-breach02-remaining-player-evidence.json 与 map02-remaining-breach-root-review.json（有限接受）。其余实例保留源/加载范围。

## 下一接口与责任

| 缺项 | Map 负责 | Root 负责 | FX 边界 |
|---|---|---|---|
| Plant327隐藏后再战恢复 | 新18-09-00 raw INCOMPLETE；双同revision1 round1 hidden/rootfalse→round2 visible/roottrue已实际成立，guest4draw/host新round无draw。见map02-plant-round-reset-evidence.md | 合法mode2四账户普通触碰→自然OBJECTIVE wall44555→正常Rematch→双Leave资源0已记录；实际map02-plant-round-reset-root-review.json / ACCEPTED_FINITE_DUAL_PLANT327_ROUND_RESET_GUEST_DRAW_HOST_DRAW_GAP；主端draw缺口保留，不自动第二次 | 只读新round归属及必要owner事实；无新声效或旧像素门禁 |
| 原场景ambient | 保Plant原材质公式与现具名来源；明确当前白光provider为重建，不能从初始化0.2推出战斗日光 | 共享scene ambient同时影响角色材质；原场景选灯/producer确定后协调正式接口 | 具名事件材质消费者按原provider复用，不猜配颜色 |
| 环境可见表现精度 | 复用已有双13Plants实际摆动、水纹理/offset推进及原材质记录；新南/东普通入口双route unavailable/whole0，见map02-water-new-entry-prepared.md；实际可见时序缺口仍开放 | 正式普通输入与原相机入口；不通过改时钟或场景状态取得画面 | 原BG生命周期已有限接受，新增触发效果需真实来源 |
| 活跃房间重连 | map02-active-reconnect-owner-evidence.json登记主端真实断线后同scene/水/29Plant根/四BG引用续用，客端资源保持；正常双Leave全部清理 | 正式重建同账户30s保留/自动认证恢复同player接口已接，70569实际出口0/18-55-30有限raw及实际room-reconnect-root-review.json / PASS_FINITE_FIXED_MAP02_SAME_ACCOUNT_AUTOMATIC_ROOM_RECOVERY_INPUT_OWNERS_LEAVE_SCOPE成立；原规则来源仍open | 同voice/audio续播与旧四音频Leave暂停实际记录；不新增声门禁 |
| 高清性能与连接 | SwiftShader实际dimension/时序证据已交；环境advance毫秒级不支持盲改Plant/water | 正式连接与真实GPU设备的可用入口；保软件4K断联和慢帧缺口 | 仅按实际具名成本与资源原因定位，不泛改shader |

普通 2001 muzzle、result、Damage、Benefit 与 Castle text 的既有源/模块/实证直接复用。Map7 remote007/SE30 实证不自动成为地图2同局实证；本次126首仅只读追加真实 shotItemResult2001 归属记录，独立缺失不阻止正常 Leave。

## 整图完成条件与限制

全部 60 Breach 原 placement 的 intact 与许可状态消费者、29 Plant、4 Sound、两 Castle、terrain/water 的资源边界需闭合，并登记真实可见/动作/声音范围。然后结合合法模式目录完成地图 2 的普通两局、重入/退出、碰撞与多人事务一致覆盖；1920/4K 和实际性能仍单独未完成。mode1 为当前破坏实际入口；既有 mode2/3 一致性证据不构成其他模式的全部画面验收，正式 config.MAPS/ListMaps 原表目录登记见 map02-original-mode-inventory.json，地图 2 合法模式为1,2,3。

原 ENV HP200/fade/权限、当前 ambientWhite provider 属明示重建，不宣原策略或原 ambient 等价。Water、Plant、Sound 的旧失败及其他地图05/10姿态缺口保持。只有具体新原因或新普通消费者才能推进相应缺环；不以旧路线重复采样代替解决。父任务 M3、M7 与 M8 完整多人高清交付仍开放。
