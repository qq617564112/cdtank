# 正式战斗整页控制整合（M5-04）

正式PLAYING采用game_main.xml的SheetWindow/all800×600根锚点，与既有原BattleHud保持同一居中位置和min(viewportWidth/800,viewportHeight/600)比例。源btnExit为(747,0)-(793,46)，Normal/Hover/Pushed分别引用zhandou00/data\ui\zhandou\likai0.tga、likai1.tga、likai2.tga，UseStandardImagery=False、StateColorBlend=False、ClippedByParent=False。正式退出按钮由共享SourceButton消费这些原图，接已完成的Leave确认与清理。

BattleMatch正式PLAYING不显示右侧battle-match临时外框。特殊弹药数量由原八槽栏显示，不在中央反馈区重复挂载data-ammo-stock文本。正式战斗页不提供道具丢弃入口、下拉框或按钮。

feedback只承载既有增益文字、资源与退出错误，没有表单或滚动条，也不截获场景鼠标。原聊天输入独立保持，源Exit保留data-leave-room及权威处罚报价确认。

WAITING继续使用源等待框，LOADING继续使用载入页，FINISHED使用现结算页面。validation旧分支保留data-ammo-stock展示。BattleMatch订阅/数量/目标生产、权限、请求状态、房间协议、场景和Babylon生命周期沿既有业务。

## 限制

原btnExit事件回调与原服务器退出协议仍有来源边界，源图到现Leave为Web映射。增益反馈是网页补充呈现。此次仅静态接线与代码走查，未运行测试、浏览器、构建或类型检查；实际页面仍待实测。M5-04、UI-09与完整1:1验收保持开放。
