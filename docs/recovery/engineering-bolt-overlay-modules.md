# Bolt与overlay完整执行族

Type2的effect-bolt-node/segments/draw归render/effects/bolts，Type8的effect-overlay-node/draw/mesh归render/effects/overlays。六个旧平铺入口删除，原目标绑定、随机流消耗、时间/重建、几何、资源URL和释放规则保持。

| 族 | 实际职责 |
|---|---|
| bolts | 原目标绑定/失效，开始和每次更新最多一次重建及剩余时间，随机分段与世界坐标，面向相机的条带顶点和三角索引 |
| overlays | 原颜色/帧状态，屏幕像素矩形/UV/顶点提交，GBF状态与Babylon材质网格，更新隐藏与释放 |

EffectRuntime和树直接调用同一生产实现；共用EffectSpriteMesh的条带索引、目标/角色provider与父矩阵测试、十个CTS消费者、两个独立渲染页面同步迁移。跨族随机流、deviceStates和绘制顺序继续由运行组装保持唯一，不建立各族副本。

## 验收入口

`npx tsx tests/<名称>.cts`执行原指令结果到正式模块的对照：effect-bolt-{segments,lifecycles,draw}，effect-sol-bolt-{parent,attached-lifecycles,render-parent}，effect-sol-{provider-target,entity-provider}，effect-overlay-{lifecycle,draw}。另外保留effect-family-draw、effect-manager-order和`npm run test:combat:effect-runtime`验证跨族网格、统一更新顺序及通知树。

`npm run render:bolt:dev`和`npm run render:overlay:dev`分别提供独立页面；`tests/browser-effect-bolt.mjs <CDP>`验证原Bolt.png/GBF7、六组原相机/矩阵条带像素和运行时顶点/清场；`tests/browser-effect-overlay.mjs <CDP>`验证原node905纹理、十九原颜色/帧样本、实际运行六顶点和清场。两页面采用各自独立Vite缓存。

技能独立页面保持原Skill12树像素/GA35空间声/队列/到期/零残留；正常CPU入口、双网页自然两局/结算冻结/再战/原治疗效果声音释放与账户重启重进保持。全仓类型/边界、正式Web/bolt/overlay/技能独立构建、编译账户/迷彩联机保存及CPU五模式各两局作为业务回归。

## 原规则和实际像素证据

808原端点/随机分段、202完整bolt生命周期、606原条带顶点、101生产树/505附着样本、606附着序列/8532原start/tick/stop操作、168原附着draw/84真实网格提交通过；后者最大误差0，56样本能识别父矩阵重复应用。目标及角色中心provider各12序列168操作，三子节点绑定/失效/释放通过；原overlay完整生命周期和76屏幕矩形/颜色/UV/XYZRHW提交通过。Sprite/strip直接生产绘制链、原统一管理顺序、技能树/挂点/释放同时通过（engineering-bolt-overlay-modules-rules.log）。

实际Chromium的bolt六组相机/矩阵条带样本及overlay十九颜色/帧样本最大RGB误差均为0。生产bolt提交20顶点、overlay提交6顶点，两者清场残留网格为零；Skill12树像素/GA35空间声/队列/到期/零残留通过（engineering-bolt-overlay-modules-pixels.log、browser-effect-{bolt,overlay}.json、browser-skill-effect.json）。

正常CPU资源失败重试、自动准备、运动返回通过；双网页本人托管和不同拥有迷彩两局自然结束，夹具等待79074毫秒与105948毫秒。结算冻结/再战、原治疗Effect11/GA15与声音释放、库存数量和账户服务重启正常重进通过（engineering-bolt-overlay-modules-{cpu,two-rounds,browser}.log）。

全仓类型、214个正式可达模块边界、正式Web/bolt/overlay/技能独立构建、编译服务真实账户/迷彩联机重启保存及CPU五模式各两局全部通过，所有本片验收命令退出0。四构建分别2分2秒、1分52秒、1分23秒、1分28秒（engineering-bolt-overlay-modules-build.log、server-build-{runtime,autopilot-match}.json）。

## 范围

目标provider及父矩阵按原指令样本验证，不代表服务器全部原技能授予/目标决策已恢复。诊断像素仅证明指定原纹理/GBF/颜色/相机样本，完整原资产和D3D继承状态、高清全部内容性能继续按M项验收。
