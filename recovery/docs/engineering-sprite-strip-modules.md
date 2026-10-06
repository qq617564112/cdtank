# Sprite与strip的实际绘制职责

Type1的node/reset/space/atlas/trail五个模块归render/effects/sprites，Type7的node/state/geometry/uv四个模块归render/effects/strips；九个旧平铺入口删除，状态/生命周期/资源合同保持。十一处CTS消费者、效果树和独立效果页面引用同步迁移。

EffectRuntime的Type1历史到四边形计算提取到sprite-draw，Type7段到世界四边形计算提取到strip-draw。两个函数返回原EffectQuadData，直接交给现有共用EffectSpriteMesh；资源/材质选择、跨族deviceStates、实例/绘制顺序及释放仍由EffectRuntime组装。

| 绘制模块 | 保持的原行为 |
|---|---|
| sprite-draw | 历史反向提交，使用entry0颜色和逐项trail alpha，float32位置加轨道，billboard位选择/相机反射/父矩阵，定向角/尺寸和原UV帧 |
| strip-draw | 原位置/轨道/角/尺寸/父矩阵组成世界矩阵，段和角顺序、UV、packed颜色保持 |

跨模型/粒子/sprite/strip使用的共用数学、颜色、相机和quad backend保持单一实现；未为每族建立独立deviceStates，GBF状态仍在统一有序流中传递。

## 验收入口

`npm run test:effects:draw`直接调用提取的生产函数和EffectRuntime实际网格提交链。原矩阵/几何/颜色/相机样本与NullEngine中的真实Babylon网格用于检查四边形、position/UV/color/index缓冲、父矩阵和清理；此命令也进入test:acceptance:render。

原规则使用对应原指令结果，通过`npx tsx tests/<名称>.cts`执行：effect-sprite-{state,reset,space,lifecycles,path-lifecycle}，effect-trail，effect-strip-{state,geometry,uv,lifecycles}，effect-render-transform、effect-color、effect-camera、effect-sprite-mesh、effect-manager-order、effect-online{004,006}-tree。`npm run test:combat:effect-runtime`检查真实技能通知到生产树/挂点和清理。

三个独立浏览器入口分别执行tests/browser-effects.mjs、browser-effect-particles.mjs、browser-skill-effect.mjs，覆盖原GBF6–9混合/深度、16原爆炸帧/时钟、node17粒子顺序/寿命/释放及Skill12树/空间声音/队列/零残留。正式CPU入口、双网页自然两局/再战/账户重启保存，以及类型/边界、正式Web/效果/粒子/技能独立构建和编译服务五模式各两局作为业务回归。

## 原规则与实际生产链证据

原sprite重置4352组、空间4352组、2176拖尾历史/13056更新、843完整非路径生命周期和1路径生命周期通过。Strip状态/几何/UV各1170组、567完整生命周期，以及3346矩阵、原颜色/拖尾alpha、24相机billboard、GBF6–9共用网格、原管理器反向遍历和两种混合树各13tick通过（engineering-sprite-strip-modules-rules.log）。

直接生产绘制链对照2176原sprite矩阵、4384原billboard/父矩阵和2508原strip变换；三帧不同UV/旧历史颜色、首项颜色与原trail alpha、float32位置加轨道通过。六组真实Type1/Type7效果树经EffectRuntime提交到实际Babylon网格，position/UV/color/index、父矩阵、非活动隐藏、网格/材质释放和共用纹理归属均通过（engineering-sprite-strip-modules-draw.log）。此检查采用NullEngine，像素范围由浏览器独立证明。

浏览器GBF6–9混合/深度与16原爆炸帧、粒子node17重叠顺序/旋转/运动/寿命/清场、Skill12树像素/GA35空间声/队列/到期/零残留全部通过（engineering-sprite-strip-modules-pixels.log、browser-{effects,effect-particles,skill-effect}.json）。效果、粒子和技能诊断的Vite缓存各自独立，并行启动不再共用优化缓存。

正常CPU资源失败重试/自动准备/运动返回、双网页本人托管及不同拥有迷彩两局自然结束、冻结结算/再战、原治疗效果声音释放和账户服务重启重进通过。终局等待71644毫秒与126722毫秒（engineering-sprite-strip-modules-{cpu,two-rounds,browser}.log）。

全仓类型和直接绘制链最终复验、214个正式可达模块边界、正式Web/效果/粒子/技能独立构建、编译账户/迷彩联机重启保存及CPU五模式各两局全部通过，所有本片命令退出0。四构建分别2分3秒、1分59秒、1分34秒、1分25秒（engineering-sprite-strip-modules-{final,build}.log，server-build-{runtime,autopilot-match}.json）。

## 范围

直接绘制链检查NullEngine实际几何提交，像素证明来自所列WebGL夹具；两者范围分别记录。诊断的GBF继承状态使用明确夹具，原D3D全部继承状态、全部sprite/strip资产/技能资格及全内容高清实战仍按M项恢复。
