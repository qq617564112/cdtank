# 效果运行树与生命周期职责

运行器、效果树、timeline/lifecycle/tree-create/world-start、对象池、保留状态池、目标provider、声音/屏幕节点生命周期归apps/web/src/render/effects/runtime。旧平铺入口删除，正式Battle/技能通知、各族节点、audio及七诊断入口直接消费实际所有者。

| 模块 | 实际职责 |
|---|---|
| effect-runtime | 资源准备/缓存、TankView订阅/ELK链接、唯一CRT随机、实例和有序GBF提交、相机与声音适配组装 |
| effect-runtime-tree | 原节点/子树构建、倒序更新、类型创建/生命周期及释放 |
| effect-timeline、effect-lifecycle | 原开始/结束/控制器时序和阶段 |
| effect-tree-create、effect-world-start | 原树选择与世界启动坐标/父矩阵分派 |
| effect-object-pool、effect-runtime-state-pool | 原active prefix交换回收与sprite/strip跨绑定保留字段 |
| effect-target-provider | 目标位置引用、observer绑定替换和失效释放 |
| effect-sound-node、effect-screen-node | 树中的声音句柄与屏幕节点生命周期，实际声音设备归audio |

相机抖动由camera持有，绘制实现由各效果族持有，共用数学由common持有；单一deviceStates、倒序更新、随机消耗、实例清理顺序和保留字段保持既有原程序合同。战车动作和挂点仍待独立归属切片。

## 验收入口

既有70 CTS（tests/effect*.cts及skill-effect-runtime.cts）验证原树/生命周期/管理顺序/目标失效/池复用及通知接线；online004/online006分别附加--parent和--retained检查父矩阵与保留字段。使用已取证native输出，不重生原对照。

全仓类型、test:architecture、build:web以及render:{model,bolt,overlay,skill,shake}:build检查正式运行和五个实际引用运行树的诊断入口依赖；effect/particle入口未引用本片模块，保留共用规则片已通过的构建证据，正式运行不能导入evidence/tests/tools。browser-effect-sound通过真实鼠标激活检查GA01音频输出/自然结束及混合online006的停播/替换/释放；七渲染browser命令检查各族实际像素/生命周期/声音/零残留。

browser-cpu-entry和browser-healing-item --autopilot --reentry --owned-textures检查正常入场/重试/CPU运动、双网页自然两局、冻结结算/再战、原治疗效果声音和账户重启库存/快捷槽保存；test:server:compiled检查编译账户/迷彩网络重启及CPU五模式各两局。

## 当前状态

11个模块及实际消费者迁移完成。70原CTS和online004/006的四个parent/retained模式均通过，Web类型与218可达模块边界通过；七实际像素/寿命/释放、Type4真实GA01音频/自然结束和混合online006停播替换释放、正常CPU入场/重试/运动返回和正式离房恢复通过。编译账户/迷彩网络重启保存与CPU五模式各两局通过。双网页自然两局分别等待69380和76966毫秒，冻结结算/再战、原治疗Effect11/GA15释放、账户服务重启重进及库存/快捷槽保留通过。全仓类型及正式Web构建通过；五个实际引用运行树的model/bolt/overlay/skill/shake诊断构建全部通过，分别耗时1分46秒、1分18秒、1分19秒、1分20秒、1分18秒；正式Web耗时2分06秒。所有本片验收命令退出0，证据见engineering-effect-runtime-{rules,pixels,cpu,two-rounds,leave,type4,build,compiled}.log。

## 范围

本片证明现有生产链的职责、原规则和表现回归，完整原技能/账户/资产/玩法和高清联机实战性能仍由对应M项验收。
