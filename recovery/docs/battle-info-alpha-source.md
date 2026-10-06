# 原战斗消息面板alpha反馈

原battle-information消费者执行PASS：5组文字消费/reset、10组frame clock、8组完整鼠进入/离开回调和事件顺序，证据为 `battle-info-alpha-native.json`。脚本 `recovery/evidence/hud/battle-info-alpha-native.py` 执行原EXE指令；完整消息组装、CEGUI文字/alpha调用和frame dt是明确provider。

`0x4d03a8..0x4d042c`把已组装消息交给edtBattleInfo的setText；长度大于1且首字符为换行时，再取substr(1,npos)去除首换行。随后清controller+0x95c计时并设置picBattleInfoPanel alpha1。该片只恢复文字消费边界与alpha反馈，不恢复完整原消息格式和日志容量。

frame `0x4cae7a..0x4caeb5` 仅在elapsed+0x95c小于8时累计delta+0x10。两个字段均float32秒，elapsed存储为float32和；阈值比较保留x87未舍入的和，达到8时设float32(0.2)。elapsed已经大于或等于8时不再累计、不再写alpha。向量覆盖小于/等于/越过阈值，以及和舍入至8而未舍入和仍小于8的有效边界。

原鼠进入回调 `0x4ccac7` 无条件设alpha1；离开 `0x4ccade` 仅elapsed大于或等于8时设float32(0.2)。两者不重置计时。不存在持续hover锁：阈值前进入仍可由之后frame淡化；阈值后进入恢复1，后续frame因时间已达8不重写，直到离开或新消息。

`0x4d5d3e`通过 `EventMouseEnters` 注册进入回调，`0x4d5d93`通过 `EventMouseLeaves` 注册离开回调；两处目标都是controller+0x62c的 `GameMain/edtBattleInfo`，不是整个panel。背景panel继承pointer-events:none，只有文本区域pointer-events:auto。

## 正式接线

BattleHud使用独立透明度store和subscribeBattleInfoOpacity/getBattleInfoOpacity，只有alpha变化通知该子树；实际接受现有filtered RoomEvent消息时reset。BattleInfoPanel用useSyncExternalStore订阅标量，edtBattleInfo鼠事件调用battleInfoHover。正式时钟采用当前HUD update的实际now差除1000，再供给float32秒；原consumer读取+0x10已证明，其完整原delta producer/dispatcher未执行。

消息呈现维持现有五条filtered事件投影；原消息全文生产与容量仍未恢复。

clear重置计时和alpha1，复用当前会话与资源生命周期。原game_main/room_main的阶段显隐入口仍缺，见 `hud-phase-source.md`；本片保留当前阶段呈现，不改未知WAITING规则。原Windows/GPU整体绘制、字体和完整文本解析不属于本片。
