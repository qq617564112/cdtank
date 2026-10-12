# 正式粒子执行链职责

Type6粒子的发射、状态、池、节点生命周期和实际绘制归apps/web/src/render/effects/particles。六个旧平铺入口删除，执行规则、导出合同和资源URL保持。

| 模块 | 实际职责 |
|---|---|
| effect-emitter-clock | 原连续/突发发射、累计小数和共享随机流消耗 |
| effect-particle-spawn | 原出生属性、点/盒/圆盘、父/全局矩阵与随机序列 |
| effect-particle-state | 原运动模式、角度、帧/随机、颜色透明和状态更新 |
| effect-particle-pool | 原packed数组容量、逐项更新、尾部交换及跳过语义 |
| effect-particle-node | 原节点启动/控制器重置、空间/路径/目标、发射与池更新顺序、结束清场 |
| effect-particle-renderer | 真实Type6半尺寸、Z角、UV帧、可见过滤、绘制顺序与网格释放 |

EffectRuntime调用生产renderer，EffectRuntimeTree调用生产node；14个CTS消费者、独立粒子页面及混合树使用同一实现。跨模型/粒子/sprite的空间、颜色、相机、路径和sprite网格保持唯一模块，未复制为粒子专用副本。架构门禁要求六个旧入口不存在、新入口存在。

## 验收入口

原指令结果由对应*-native.json提供，以下CTS直接执行迁移后的生产模块：

- effect-emitter-clock、effect-particle-state、effect-particle-pool、effect-particle-spawn、effect-particle-node。
- effect-emitter-reset、effect-particle-lifecycle、effect-particle-lifecycles、effect-particle-all-lifecycles。
- effect-particle-path-lifecycles、effect-particle-target-lifecycles、effect-particle-target-parent-lifecycles。
- effect-online004-tree、effect-online006-tree。

执行形式为`npx tsx tests/<名称>.cts`。`recovery/.venv/bin/python tests/effect-particle-browser-native.py`重新执行原node17载入/更新并产生浏览器寿命夹具；`npm run test:combat:effect-runtime`检查正式技能通知到真实树/挂点/网格清理。

`npm run render:particle:dev`后执行`npm run test:effects:particles:browser -- <CDP>`，检查真实node17纹理、重叠/顺序/旋转/运动、原寿命状态和重启/清场/释放。独立技能页面的`tests/browser-skill-effect.mjs <CDP>`保持原Skill12实际树、GA35空间声/队列/到期/零残留。

正常CPU入口和双网页本人托管自然两局/结算冻结再战/不同拥有迷彩/原治疗效果声音释放/账户重启重进，以及全仓类型、依赖边界、正式Web/粒子/技能独立构建、编译账户联机保存与五模式各两局作为迁移业务验收。

## 原指令与实际粒子证据

1970发射时钟/13790tick、7880原状态更新、16原packed循环、8865出生状态与精确随机消耗、node17九完整tick/18结束状态、3904启动重置空间、9完整节点生命周期、391单控制器生命周期、649非目标/非路径生命周期、9路径生命周期、20目标及20父矩阵生命周期、两种混合树各13完整tick、原node17七寿命步、6236原树创建/35218节点与18挂点全部通过（engineering-particle-modules-rules.log）。

实际粒子浏览器12个采样最大RGB误差为1；首帧583个可见像素，365个重叠且对顺序敏感的像素。原纹理、重叠顺序/旋转/运动、七原寿命步、重启清场和释放通过，残留网格为零、共用纹理仍由调用者持有并最终释放。独立Skill12树像素/GA35空间声音/队列/到期/零残留通过（engineering-particle-modules-pixels.log、browser-effect-particles.json、browser-skill-effect.json）。

正常CPU的资源失败重试、自动准备、运动和返回通过；双网页本人托管及不同拥有迷彩两局自然结束，夹具等待59266毫秒与103040毫秒。结算冻结/再战、原治疗Effect11/GA15与声音释放、库存数量和账户服务重启正常重进通过（engineering-particle-modules-{cpu,two-rounds,browser}.log）。

全仓类型、212个正式可达模块边界、正式Web/粒子诊断/技能诊断构建与编译服务真实账户/迷彩联机重启保存、CPU五模式各两局全部通过。三构建分别2分3秒、1分53秒、1分22秒，所有本片验收命令退出0（engineering-particle-modules-build.log、server-build-{runtime,autopilot-match}.json）。

## 范围

路径生命周期中的末尾顶点由明确夹具补给，目标/父矩阵按各原指令样本提供；原规则对照与指定纹理像素分别保留其范围。独立技能通知仍标记serverSkillTriggered=false；本片不代表全部原技能资格、全部粒子资产/效果或高清实战已恢复。
