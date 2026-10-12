# 对局组装、输入与目标表现职责

Battle归apps/web/src/match/battle.ts，保留联机/对局阶段、资源入场取消与生命周期组装。实际键盘状态、快捷槽、输入序号与50ms发送由match/battle-input.ts持有；目标/VIP网格及材质由render/battle-targets.ts持有。旧平铺Battle/targets入口删除，main与六界面类型消费者直接引用对局组装，浏览器动态路径及原私有诊断引用更新。

| 所有者 | 实际职责 |
|---|---|
| BattleInput | keydown/keyup/blur/focusin、WASD/QE/Space、快捷槽非repeat发送、PlayerInput投影与sequence、50ms实际interval、连线/阶段/托管门禁 |
| Battle | 入场session取消、地图/战车准备门槛、房间/账户请求组装、快照提交前清理与后续表现、声音listener、对局渲染与离房清理顺序 |
| BattleTargets | synthetic目标与VIP标记的网格/材质、原坐标反射、存活/消失增删及释放；sourcePlacementId原场景物件仍由ScenePreview持有 |

输入clear只清按键，enter resetSequence独立重置序号；start/stop拥有定时器，Battle只在原有完成资源入场后启动及离房时停止。chat、断线、阶段/局号改变、托管切换、再战和离房使用同一input.clear。运输仍由network持有，原UI/资源/声音由所属模块持有。

## 验收

battle-targets.cts检查实际NullEngine网格/几何/颜色/材质、capture争夺/队伍、destroy与VIP存活移动/死亡/缺失释放、原placement跳过、重复快照资源身份与clear场景baseline。browser-battle-input检查实际Chromium键盘/控件焦点、快捷槽repeat、interval/门禁/stop与序号转换；window blur通过显式合成事件验证生产监听器，JSON标注该范围。输入检查明确为生产owner的诊断实例。

game-connection、room-feed、battle-players、skill-effect-runtime的CTS检查连接取消/提交顺序/资源与通知接线。browser-life保持正式Battle局号清理、事件顺序、原死亡模型/离房和HUD隔离；正常CPU入场/重试、本人托管普通输入自然两局/再战冻结/治疗释放与账户服务重启库存快捷槽保留检查正式输入消费者。

全仓类型/test:architecture/build:web验证真实运行入口依赖。七渲染诊断和资源工具不导入Battle或BattleTargets，本片保留前片独立构建证据；本片正式Web重新构建。compiled服务真实账户/迷彩重启与CPU五模式两局验证联机保存及玩法回归。

## 当前状态

目标实际网格/材质/释放、连接/快照/玩家/技能四CTS、全仓类型/219可达模块边界及正式Web构建通过。浏览器输入转换与门禁、正式Battle局号清理/事件顺序/死亡模型/离房资源/HUD隔离、正常CPU重试与运动返回、正式离房相机恢复均通过；相机诊断先同步当前快照战车位置，使用稳定目标点对比恢复基准。编译账户/迷彩网络重启和CPU五模式各两局通过。正式双网页两局自然结束分别等待48797和110933毫秒；冻结结算/再战、原治疗Effect11/GA15与音频释放、账户服务重启后库存/快捷槽及新控制状态通过。正式Web构建耗时1分29秒；本片所有最终验收命令退出0。证据见engineering-match-structure-{rules,build,input,life,cpu,leave,two-rounds,compiled}.log和engineering-match-targets.log。

## 范围

目标标记为重建玩法表现，原玩法权威规则与全部界面/资产仍由M项恢复。输入owner诊断与正式联机自然两局分别记录，工程完成不代表高清全内容实战性能已通过。
