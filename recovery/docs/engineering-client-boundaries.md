# 客户端工程职责与验收

E-03已按真实运行职责和业务回归验收，保留完整复刻范围。下表替代按迁移日期堆积的任务正文；专题文档保留可复现命令与证据。

| 职责 | 当前正式归属 | 验收证据 |
|---|---|---|
| 运行组装 | main.ts组装Babylon场景、Battle、全屏和大厅入口 | engineering-client-lobby.md：正常创建/准备取消/换队/退出及独立构建 |
| 联机与账户/房间请求 | network/game-connection、accounts、rooms；唯一运输、token认证/取消/重连、各账户和房间业务请求 | engineering-client-connection.md、engineering-client-rooms.md：时序夹具、真实联机/重启保存、装备1080p/4K及两局 |
| 对局消息状态 | match/room-feed持有房间、已接收快照/到达时间；match/battle组装入场取消、阶段、资源与界面表现 | engineering-client-room-feed.md：房间过滤、提交前后顺序、事件上下文；真实死亡复活、清场、两局 |
| 实际对局输入 | match/battle-input持有键盘/快捷槽、sequence、50ms interval和普通输入构造；Battle仅提供状态与运输适配 | engineering-match-structure.md：实际浏览器按键/控件焦点/显式合成blur、repeat/阶段/断线/托管门禁与序号；正式自然两局/再战及账户保存 |
| 目标/VIP表现 | render/battle-targets持有synthetic目标/VIP网格及材质；原placement走assets/scenes | engineering-match-structure.md：真实目标几何/材质/颜色/移动/死亡缺失释放、身份复用和场景baseline |
| 对局技能通知 | match/skills完整Play/Stop、原帧调度、保留到期、复活队列及真实效果/声音适配 | engineering-skill-modules.md：原通知/时钟/队列/树对照、真实像素/空间声音/零残留及双网页自然两局/账户重启 |
| 玩家表现与资源生命周期 | render/battle-players拥有实际战车实例、加载代号、选车/迷彩门禁、动作/运动/生死/跟随、释放 | engineering-client-players.md：延迟资源与真实节点、原死亡模型、自然两局迷彩/效果与重进 |
| 弹丸表现 | render/battle-projectiles拥有网格/材质、快照增删、坐标外推与清理 | engineering-client-projectiles.md：Babylon实例/坐标/释放及真实CPU对局 |
| 共用场景与战车资源 | assets/scenes地图载入与原破坏表现，assets/tanks战车/动作/拥有迷彩，render/materials原MV3材质；所有正式和诊断消费者共用 | engineering-resource-modules.md：原破坏/材质参数、实际地图矩阵/采样/迷彩/时钟/释放、高清账户与真实两局 |
| 战车动作与挂点 | assets/tanks的action-events/actor-clock/tag-sampler/tag-world/tag-matrices/turret-pivot及客户端role-ammo-visual；TankView和runtime共用 | engineering-tank-actions.md：原时钟/标签矩阵/炮塔轴、21车实际动作/挂点/死亡释放、真实迷彩/时钟与自然两局/账户保存、正式Web与五相关诊断/工具构建 |
| 原效果模型绘制链 | render/effects/models的renderer/mesh/node/draw/animation/material、材质组合与首次Attach缓存；TankView共用engine delta | engineering-model-modules.md：原模型/材质/缓存、44组RGB、生产模型像素/释放、战车时钟、实际技能通知树及自然两局 |
| 原粒子执行链 | render/effects/particles拥有发射时钟、出生/更新状态、packed池、节点和实际绘制；效果树/渲染/诊断共用 | engineering-particle-modules.md：原随机/发射/池/目标父矩阵/路径生命周期、node17像素/顺序/寿命/释放及自然两局 |
| Sprite与strip执行/绘制 | render/effects/sprites和strips状态/生命周期/atlas/trail/段几何；sprite-draw/strip-draw实际四边形计算 | engineering-sprite-strip-modules.md：原矩阵/颜色/生命周期及真实生产网格/UV/索引/释放，浏览器像素与自然两局 |
| Bolt与overlay执行族 | render/effects/bolts目标/随机分段/条带，overlays颜色帧/屏幕矩形/实际网格 | engineering-bolt-overlay-modules.md：原目标父矩阵/真实提交、条带和overlay实际像素/释放与自然两局 |
| 效果共用规则 | render/effects/common空间/变换/颜色/quad及strip索引/帧路径/选择/网格、类型/运动/delta/orbit；sprites外观和particles emitter空间按专有职责拆分 | engineering-common-effects.md：原数学与跨族70 CTS、实际七族像素/寿命/释放、自然两局及账户重启、正式Web与七独立构建 |
| 效果相机 | render/effects/camera的billboard/相机适配/原抖动状态/实际相机恢复，sprite与粒子共用 | engineering-camera-modules.md：原矩阵/RNG、实际抖动像素与停止到期恢复、正式离房恢复及自然两局 |
| 效果运行树 | render/effects/runtime的运行器/树/时序/生命周期/世界启动/池/provider/声音与屏幕节点生命周期；audio与camera保持设备所有权 | engineering-effect-runtime.md：74原规则与parent/retained路径、Type4真实音频、七族像素/释放及自然两局/账户重启、正式Web与五实际运行树诊断构建 |
| 正式音频资源 | audio音乐/战斗声/空间技能声，EffectSound拥有真实Type4资源/实例/音量/完成和共享描述符 | engineering-audio-modules.md：原时序、真实音频输出/自然结束/拒绝/停播/清场，空间声与自然两局/账户重启 |
| 已有对局界面 | interface/battle原HUD/头像状态、准备与结算面板、房间聊天及各自CSS；interface/resources为HUD与我的家共用字体 | engineering-battle-interface.md：原HUD高清/头像计时字形/十二人名单，四网页聊天IME/准备换队/输入隔离/清理，字体与装备高清及重启两局 |
| 正式首页与已有我的家 | interface/lobby房间/账户控件；interface/home库存、装备、战车宠物、迷彩及原布局/预览 | engineering-client-lobby.md、engineering-home-interface.md：真实账户操作/拒绝/隔离/刷新重启、1080p/4K布局预览与关闭 |
| 资源查看工具 | tools/asset-viewer独立HTML/源码/CSS/Vite，dist/tools/asset-viewer | engineering-asset-tool.md：正式首页无工具控件/目录请求，实际原地图矩阵、时钟/释放及工具构建 |
| 渲染诊断 | tests/render的七个独立入口，dist/validation；正式依赖不能引用tests/tools/evidence | engineering-render-entries.md、模型/闪电专题：独立构建及各实际像素/生命周期夹具；运行依赖门禁 |

## 职责验收结论

现有客户端运行职责均有实际所有者，E-03已完成。Battle保留网络/资源/界面的阶段与生命周期协调、准备门槛和小型状态投影；键盘/协议输入、原规则计算、实际资源/网格/UI实现已归各模块，不为行数继续引入manager/service。正式源码不导入evidence/tests/tools，七渲染诊断和资源工具通过独立入口消费同一生产实现。

shared混合契约与单端/仅取证算法仍按E-04审查迁移，不归入本项完成声明。后续功能必须进入对应实际功能所有者并执行相关业务回归。

## 当前集成结果

最终贯穿对局片已验收：Battle归match、实际输入拆分、目标归render，所有正式/诊断消费者接通；连接/快照/玩家/技能CTS、真实目标几何/颜色/移动/身份/释放及场景baseline、实际浏览器按键/焦点/repeat/门禁/计时/序号、正式生死与局号顺序/离房/相机恢复、CPU入场重试运动、双网页自然两局/结算再战/治疗释放/账户重启、全仓类型/219模块依赖/正式Web构建和编译账户/五模式两局均通过。证据见engineering-match-structure.md；此前各族、共用规则/运行树/战车动作、七渲染入口与资源工具构建及实际像素/声音/释放见上表专题。

工程归属不等于完整原资产、界面或玩法已恢复。已有界面高清验收与缩小画布的双网页验收范围分别保留；全内容高清联机性能和原像素/动画规则继续由M项证明。
