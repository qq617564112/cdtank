# 原效果模型绘制链职责

正式Type5模型绘制链归apps/web/src/render/effects/models。八个模块与执行规则、导出合同、资源URL、缓存和释放行为一起迁移，旧平铺入口删除。

| 模块 | 实际职责 |
|---|---|
| effect-model-renderer | 原模型资源/部件与节点动画组装，递归矩阵、实际材质/网格创建、绘制和释放 |
| effect-model-mesh | 原XYZ/UV/颜色提交，GBF剔除/深度/混合/透明测试状态，Babylon网格及材质 |
| effect-model-node | Type5生命周期、保留/结束状态与模型backend调用 |
| effect-model-draw | 原模型绘制状态、父矩阵和节点混合参数 |
| effect-model-animation | 原模型时间/速率/矩阵/顶点插值及真实engine delta规则 |
| effect-model-material | 原ambient/emissive参数与材质脚本选择 |
| effect-material-combo-sol | 原顶点布局、部件类型和节点blend到材质脚本的选择 |
| effect-attach-material-sol | 原首次Attach选择缓存，后续绘制复用同一材质选择 |

EffectRuntime和EffectRuntimeTree直接使用这些生产模块。TankView仍使用同一个effectModelEngineDelta，未复制时钟规则。跨模型、粒子和其他效果共用的native-space、render-transform、sprite-state、emitter-space保持唯一实现，随后按其实际共用职责归拢。模型诊断入口、八个CTS消费者、技能通知树夹具和战车时钟浏览器@fs引用同步迁移；架构检查要求八个旧入口不存在、新入口存在。

## 验收入口

- `npm run test:effects:model`：原模型生命周期、绘制矩阵与裁剪、动画/顶点、材质参数及生产合同。
- `npm run test:effects:attach-material`：完整原AttachSelf、首次材质缓存和实际renderer及组合提交。
- `npm run test:combat:effect-runtime`：真实通知到生产模型树、角色挂点和句柄释放。
- `npm run render:model:dev`后执行`node tests/browser-effect-model.mjs <CDP>`：44个原矩阵/顶点样本的RGB比较、实际91/1175/2827节点像素与清场。
- `npm run render:skill:dev`后执行`node tests/browser-skill-effect.mjs <CDP>`：生产通知树、原空间音频、队列/到期/零残留；浏览器须允许测试音频播放。
- `npm run test:tanks:actor-clock:browser -- <CDP>`：正常TankView帧入口、原动作组件时钟、长帧/通知和异步释放，诊断工具使用同一正式模型时间模块。
- 正常CPU资源失败重试/自动准备/运动/返回；`node --import tsx tests/browser-healing-item.mjs <CDP> --autopilot --reentry --owned-textures`：普通输入的双网页自然两局、再战、原效果与释放、账户重启重进。
- `npx tsc --noEmit`、`npm run test:architecture`、`npm run build:web`、`npm run render:model:build`、`npm run render:skill:build`、`npm run tools:assets:build`、`npm run test:server:compiled`：受影响的正式/诊断/工具构建与编译服务账户保存、五模式各两局。

## 原程序与实际渲染证据

原指令与生产模块对照通过：124模型生命周期/1364tick、1674模型绘制、4动画序列44更新、40帧12120原顶点、138材质参数/23部件、46完整Attach序列/138缓存选择、132实际部件提交和483材质选择/462网格状态。首次Attach材质在blend变更后保留，释放后新实例重新选择；原缺纹理资源按原合同拒绝。

实际浏览器44组矩阵/顶点RGB最大误差为0；生产节点91/1175/2827分别产生1230/13/174变化像素，清场残留网格为零。真实Skill12树/GA35空间声/到期/复活队列与零残留通过。TankView正常帧入口的原getter、12动作序列60组件tick、长帧float32截断、通知与异步释放通过。证据：engineering-model-modules-rules.log、engineering-model-modules-pixels.log、browser-effect-model.json、browser-skill-effect.json、browser-tank-actor-clock-sol.json及对应原*-native.json。

正常CPU入口的资源失败重试、自动准备、运动与返回通过；双网页本人托管和不同拥有迷彩两局自然结束，夹具终局等待用时43199毫秒与116546毫秒。结算冻结/再战、原治疗Effect11/GA15与声音释放、库存数量和账户服务重启后的正常页面重进通过。证据：engineering-model-modules-{cpu,two-rounds,browser}.log及browser-healing-item专题输出。

全仓类型及211个正式可达模块依赖边界通过。正式Web、模型诊断、技能诊断和资源工具构建分别2分3秒、1分59秒、1分20秒、1分21秒完成；编译服务真实账户/迷彩联机重启保存及CPU五模式各两局通过。所有本片验收命令退出0。证据：engineering-model-modules-build.log、server-build-{runtime,autopilot-match}.json。构建主包体积提示继续按M7-02处理。

## 范围

模型和技能页面记录diagnostic/notification-fixture及serverSkillTriggered=false，证明原模型/通知生产模块在指定夹具下的行为；正常治疗施放另由联机夹具证明。显式夹具的GBF状态不证明原D3D全部继承状态、灯光、雾或所有效果像素已恢复。工程结构切片不代替全部原技能、资产、规则、界面及全内容高清联机验收。
