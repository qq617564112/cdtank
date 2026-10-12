# E-R05-H React HUD实际浏览器验收

`tests/browser-react-hud.mjs`以独立3273服务、5303Vite缓存和9503Chromium运行两账号普通客户端。一局正常玩家输入与自然CPU/本人托管对战提供本片HUD业务事件，不注入位置、HP、伤害、胜负或计时。

检查针对具体迁移缺口：普通Space开火是否贯通实际装填、同次装填是否显示多个fraction、持续开火是否受reload.duration约束；自然命中后真实snapshot HP是否同步至生命条、原三颜色插值与水平clip；真实死亡是否使用源头像并隐藏装填、复活是否恢复；自然首局结算、双人普通再战、离房再入是否清理上一局投影。25ms观测记录真实页面与权威snapshot，仅在已确认值匹配时核对颜色。

1080p和4K检查原800×600源生命条几何与实际BigHT位图计时资源解码。Babylon内部画布按软件设备预算降低，UI保持实际高清viewport；本片不以该预算验证3D高清性能。页面映射继续采用既有明示重建规则，不宣称恢复原HUD全部网络字段。

正常账号缺少完整原属性来源时，明确导入`world-role-attributes-native.json`中tank1/part0拥有战车与宠物字段，通过账户选择offset0xa8/0xa4提供来源；战斗运行仍只由正常建房、加入、Ready、原生输入、CPU和本人托管触发。各次输出独立时间前缀，失败状态保留。

## 实际业务结果

`recovery/output/react-hud-2026-10-03T17-17-57-052Z.json`整体PASS。普通Space开火记录20个真实样本，装填显示0、13、15、21、23、25、43、76、79、81及100，源垂直clip随fraction变化，持续开火未提前跨越装填duration。

同一自然首局提供两网页960/815条HUD变化记录：实际HP下降同步生命条，原三颜色插值精确匹配；wound、dead、attack、yeah与normal头像实际出现，25条死亡样本均使用原local死亡资源。自然复活恢复生命与头像，FINISHED隐藏装填。双方普通再战round1→round2重新显示存活生命，离房隐藏或卸载HUD，正常新WAITING恢复投影。首终局及再战、离房重入阶段89372ms。

真实mode4计时器`4:59`解码4个BigHT原图；生命条实际1080p矩形`799.8,1013.4,322.2,50.4`，4K矩形`1599.6,2026.8,644.4,100.8`符合原统一scale。此业务段只覆盖实际mode4计时器，不将其代替五mode全部布局。

独立3273、5303、9503端口已释放，服务、Chromium、Vite与临时目录清理全部通过。

综合索引：`react-hud-2026-10-03-accepted.json`。其余四模式计时layout采用已验证原布局/控制器合同，本片不增加五模式实际对局，不关闭原HUD全字段精度父任务。中文组合输入与键盘隔离复用`react-chat-2026-10-03-accepted.json`；本次HUD不修改聊天或Battle输入、没有新增键处理，原`hud.css`根`pointer-events:none`保持。普通Space实际击发提供当前HUD不阻挡玩家战斗输入的直接证据。
