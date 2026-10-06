# 正式战斗整页控制整合（M5-04）

正式PLAYING采用game_main.xml的SheetWindow/all800×600根锚点，与既有原BattleHud保持同一居中位置和min(viewportWidth/800,viewportHeight/600)比例。源btnExit为(747,0)-(793,46)，Normal/Hover/Pushed分别引用zhandou00/data\ui\zhandou\likai0.tga、likai1.tga、likai2.tga，UseStandardImagery=False、StateColorBlend=False、ClippedByParent=False。正式退出按钮由共享SourceButton消费这些原图，接已完成的Leave确认与清理。

BattleMatch正式PLAYING不再显示右侧battle-match临时外框。目标、托管和请求状态使用同一语义store，置于中心下方可展开的Web控制区域；默认收起，(309,408)-(596,556)为展开最大范围，源原头像左右两栏、顶消息、准星及底部生命条保持既有消费者。区域也避开原picMiniMap(608,408)-(800,600)保留位置，不以此宣称小地图业务已接。

特殊弹药data-ammo-stock/slot及增益反馈在控制区域收起时仍可见，使用既有确认state，位于(309,316)宽287、高最多88的独立Web反馈区。AI托管按钮与data-autopilot语义保留，源Exit保留data-leave-room。控制区域普通展开、Escape收起并恢复summary焦点；组件内键盘不传播到战斗输入，原聊天输入独立保持。

WAITING已交付源等待框继续使用，FINISHED仍使用现结算页面。本次不改变BattleMatch订阅/数量/目标生产、权限或请求状态，不改房间协议、场景和Babylon生命周期。

## 限制

原btnExit事件回调与原服务器退出协议未恢复，源图到现Leave为Web映射。控制展开、托管/目标/弹药/增益布局是Web功能投影，不补造原装饰框。原完整称号、全部道具槽、小地图、HUD阶段与GPU精度仍归M5-04及对应UI父项，整页无遮挡交付不关闭完整1:1。
