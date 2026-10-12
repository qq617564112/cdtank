# 对局技能通知执行链

正式通知执行链归apps/web/src/match/skills，四个旧平铺入口已删除，导出合同和执行规则保持。

| 模块 | 实际职责 |
|---|---|
| battle-skill-effects | RoomEvent的Play/Stop分派，玩家ID转换，复活/角色移除，逐帧调度和回合清场 |
| skill-effect-frame-scheduler | 原30Hz帧调度、整数Sleep、补步上限与共用完成时钟 |
| skill-effect-notifications | 原通知记录、到期停止、角色复活队列及角色/全局释放 |
| skill-effect-runtime | 技能目录和TankView到真实EffectRuntime效果树、挂点、声音与停止句柄的适配 |

Battle只组装对局生命周期；shared/combat保留两端共用的通知协议和目录。五个CTS消费者、独立技能渲染入口和真实治疗联机浏览器夹具直接引用同一生产实现，没有旧路径别名或诊断副本。架构检查要求旧入口不存在、新入口存在，并检查正式依赖不能进入取证、工具或渲染诊断。

## 验收入口

- `npm run test:combat:effect-battle`：实际TSRPC通知路由、原帧倒计时、复活队列、移除角色与回合清场。
- `npm run test:combat:effect-clock`：原连续调度状态、整数转换和非阻塞轮询。
- `npm run test:combat:effect-messages`：原位流、通知回调/状态、队列激活/选择/到期/释放。
- `npm run test:combat:effect-runtime`：原树创建、角色挂点与实际生产通知到效果树/网格/句柄清理。
- 技能诊断运行：`npm run render:skill:dev`，再执行`node tests/browser-skill-effect.mjs <CDP>`。浏览器须允许测试音频播放；检查真实原Skill12树像素、GA35空间声音/循环/音量/停止、保留到期、复活队列和零残留。
- 正常CPU入口重试/运动/返回与`node --import tsx tests/browser-healing-item.mjs <CDP> --autopilot --reentry --owned-textures`：双网页自然两局、结算冻结与再战、拥有迷彩/治疗效果与账户重启重进。
- `npx tsc --noEmit`、`npm run test:architecture`、`npm run build:web`、`npm run render:skill:build`、`npm run test:server:compiled`：类型和依赖、独立构建、编译账户联机保存及CPU五模式各两局。

## 已通过的原程序与渲染验收

92个连续原时钟决策与8个整数转换、16个原位流往返、9组通知序列/44个回调与状态样本、原复活队列选择和清理全部通过。树创建对照覆盖6236次原创建与35218个节点；18个角色挂点案例和生产通知网格/句柄释放通过。

实际Chromium诊断中Skill12原树产生119个变化像素，GA35循环声的空间衰减为0.7116963267（原规则期望0.7116963538）。保留到期、复活队列通过，清场后网格、实例、声音、队列计时器均为零。证据：battle-skill-effects.json、skill-effect-{frame-scheduler,message,queue,actor}-native.json、effect-tree-create-native.json、browser-skill-effect.json；运行日志engineering-skill-modules-rules.log与engineering-skill-modules-pixels.log。

全仓类型、211个正式可达模块边界、正式Web构建及技能独立诊断构建通过；正式Web用时1分49秒、技能构建1分54秒。编译服务真实账户/迷彩联机保存、服务重启及五模式各两局通过，证据为engineering-skill-modules-build.log和server-build-{runtime,autopilot-match}.json。现有构建主包体积提示仍由M7-02性能任务处理。

正常CPU入口的资源失败反馈、重试、自动准备、运动与返回通过。双网页本人托管及不同拥有迷彩的两局分别66461毫秒与95597毫秒自然结束，结算一致/冻结、准备再战、库存数量、原Effect11/GA15与退出清理通过；账户服务重启后从正常页面重进，库存/快捷槽保留且新控制状态干净。证据为engineering-skill-modules-{cpu,two-rounds,browser}.log及browser-healing-item专题输出。所有本片验收命令退出0。

## 范围

独立技能页面是原通知诊断夹具，记录sourceInvocation为notification-fixture、serverSkillTriggered为false；不能作为原技能资格或服务器实际授予证明。自然对局治疗链另由正常联机夹具验收。此切片整理通知职责，全部原技能、效果模型、粒子、音频后端及目标表现的恢复和职责归拢继续按M项与E-03推进。
