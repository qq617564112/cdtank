# 效果相机和抖动职责

effect-billboard、effect-camera、effect-camera-shake、effect-camera-shake-view归apps/web/src/render/effects/camera，四个旧平铺入口删除。Sprite与粒子共用同一billboard适配，EffectRuntime持有同一抖动实例；原随机流仍由运行组装提供。

| 模块 | 实际职责 |
|---|---|
| effect-billboard | 原半尺寸、角度和相机空间角点 |
| effect-camera | 当前Web相机到原XYZ角点的适配，坐标反射保持一次 |
| effect-camera-shake | 原参数/强度/时长、共享CRT随机消耗、eye/target与到期状态 |
| effect-camera-shake-view | Babylon相机姿态保存、延迟激活、实际视图矩阵、更新及停止/到期恢复 |

实际运行器、sprite-draw、粒子renderer、三个CTS及effect/particle/shake独立入口同步引用生产模块，没有诊断副本。相机adaptation保持既有合同，不以模块归属声明原相机控制器全部恢复。

## 验收入口

`npx tsx tests/effect-billboard.cts`、effect-camera.cts、effect-camera-shake.cts验证原角点、当前相机反射/半尺寸和原抖动姿态/随机。`npm run test:effects:draw`验证实际sprite/strip生产网格/父矩阵；effect-manager-order.cts和`npm run test:combat:effect-runtime`保持统一更新与通知树。

`npm run render:shake:dev`后执行`node tests/browser-effect-camera-shake.mjs <CDP>`验证三组原视图矩阵/实际像素、ArcRotate延迟激活、停止/到期/重激活恢复及共享随机。`node tests/browser-effect-camera-shake-leave.mjs <CDP> [正式origin]`从正常房间进入实际Battle，执行明确原抖动诊断后通过正式离房按钮检查恢复、玩家/效果释放。粒子和技能独立页面保留像素/寿命/空间声音/零残留。

正常CPU重试/准备/运动返回及双网页本人托管自然连续两局/结算冻结再战/原治疗效果声音释放/账户重启重进、类型/边界、正式Web/shake/effect/particle/skill独立构建与编译账户保存/五模式两局作为迁移回归。

## 原相机与实际恢复证据

2192原相机空间角点相对误差0，24当前相机平移/旋转billboard、90原抖动序列/540完整相机更新及CRT随机消耗通过。2176原sprite矩阵/4384billboard父矩阵/2508strip变换、六实际生产网格提交、统一管理顺序、6236原树创建/35218节点与18挂点释放同时通过（engineering-camera-modules-rules.log）。

实际Chromium三组抖动矩阵误差均为0，节点384/385/671分别变化1679/7186/5528像素；延迟激活、运行相机移动、姿态保留、停止/到期/再激活恢复和两个共享随机值通过，清场残留效果为零。原node17粒子与Skill12树/GA35空间声/队列/到期/零残留通过（engineering-camera-modules-pixels.log及browser-effect-camera-shake.json）。正常房间界面离场恢复视角、玩家和效果清理通过（engineering-camera-modules-leave.log、browser-effect-camera-shake-leave.json）。

正常CPU资源失败重试、自动准备、运动返回通过；双网页本人托管及不同拥有迷彩两局自然结束，夹具终局等待43323毫秒与97821毫秒。结算冻结/再战、原治疗Effect11/GA15与声音释放、库存数量及账户服务重启正常重进通过（engineering-camera-modules-{cpu,two-rounds,browser}.log）。

全仓类型、214个正式可达模块边界、正式Web/shake/effect/particle/skill独立构建、编译服务真实账户/迷彩联机重启保存与CPU五模式各两局全部通过，所有本片验收命令退出0。五构建分别1分59秒、1分52秒、1分18秒、1分17秒、1分20秒（engineering-camera-modules-build.log、server-build-{runtime,autopilot-match}.json）。

## 范围

抖动诊断和实际离房检查记录serverSkillTriggered=false，证明指定原效果调用后的表现与释放；原服务器全部技能资格和相机控制决策仍待恢复。当前Web相机适配、指定billboard/抖动像素与高清全内容实战性能各自保留验收范围。
