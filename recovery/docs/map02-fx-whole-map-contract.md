# 地图02整图效果与声音实现合同

执行范围遵循[整图执行约束](map02-execution-constraints.md)。本文件描述整图实现接口，不作为新的运行、绘制或声音验收结果。地图02整体修改完成后统一验证，既有来源和实战结果复用。

## 全部原内容的消费者

`scene-placements.json`的0002记录包含60 Breach、29 Plant、4 Sound；另有Castle304/305。地图02没有General、Crush或屏幕效果placement。

| 原内容 | 数量 | 已有资源与消费者 | 正式输入 |
|---|---:|---|---|
| obj05425 | 16 | scene-breach-0014.json，c9八节点，SceneBreachVisual；GA32 | sourcePlacementId对应的sceneObjectDestroyed |
| obj05426 | 10 | 同库，c9六节点；GA32 | 同上 |
| obj05427 | 6 | scene-breach-0002-05427.json，c9六节点；GA32 | 同上 |
| obj05428 | 20 | scene-breach-0014.json，c9五节点；GA30 | 同上 |
| obj05422 | 8 | scene-breach-0021.json，c9十节点；GA13 | 同上 |
| Sound318/319/338/339 | 4 | scene-environment-sound-0002.json，MapEnvironmentSound；BG06/BG05/BG11/BG12 | 本图载入、当前相机listener、音量与场景离开 |
| Castle304/305 | 2 | scene-castle-0002.json，obj05447/05448，SceneCastlePresentation与SceneCastleVisual | castleDamage与Castle快照 |
| Castle浮字 | 每Castle独立队列 | SceneCastleDamageText与原Damage字体renderer | 同一次真实presentation.damage的delta |

ScenePreview已覆盖以上五种Breach的库选择与按原sourcePlacementId创建；destroyObject按模型选择原声音一次。SceneBreachVisual.load已在原time0建立隐藏几何并等待现有mesh的shader编译，advance维持原动画delta与淡出合同。

Plant摆动、隐藏状态、terrain和water由地图资源模块负责。原声音消费者不从Plant隐藏、water纹理帧或地图重入额外派发效果。

## 共享事件与生命周期

Root拥有Battle和ScenePreview共享接线。现Battle的sceneObjectHit.castleDamage进入damageCastle；非Castle的sceneObjectDestroyed进入现破坏桥，不另造通知。sourcePlacementId保留原实例身份；服务器HP、许可破坏、碰撞释放和胜负政策不由FX定义。

Castle伤害数字在入队时使用原Castle位置经原X反射和整数投影一次，后续帧仅推进队列时钟与当前viewZ，不每帧重新投影screen位置。原字体缺minus时保持字符缺失，后续digits照常绘制。

同场景Rematch恢复Breach状态、破损time0与一次声音标记，并清Castle旧浮字队列。四处BG保留同voice续播。真实场景Leave或dispose清破损renderer/纹理、Castle动作与浮字、环境voice；重新进入创建新场景owner。自动恢复同房连接继续使用现owner，不重复加载BG或重放旧破坏。

Castle载入完成及同房恢复以权威快照调用`SceneCastlePresentation.restore({currentHP,maxHP}, elapsedSeconds)`，elapsed由`serverTime−destroyedAt`供给。stage2对应n1、正HP低于`trunc(maxHP/3)`对应stage1/n2、HP0对应stage0/c3。仅stage变化设置动作；同stage1/2保留正在播放的c2。c3新恢复沿现动作clock推进elapsed，同stage0通过`view.seekDestroyed(elapsedSeconds)`定位现有c3clock并采样，不重建动作、mesh或owner，不另设动画时钟。

静默恢复复用040/039持续spout与原槽mask，正HP仅补当前原HP区间，已记mask不重复创建；HP0停旧040和持续se03后建立五个039。se03仅作为040当前持续声音恢复。恢复不重播GA48、se07、041、历史浮字或destroyCallback。仅当前HP不足以确定离线期间是否曾经过所有历史区间，未观察到的旧spout区间不推定。共享view.action新增可选第三参数elapsedSeconds，需原样转交SceneCastleVisual.action。

初始恢复在effects runtime启动后消费最新快照；载入及重连期间保留权威状态，不提前消费Castle/Breach历史impact。持续se03的真实循环voice即使AudioContext尚未运行也保留同handle；媒体播放被浏览器NotAllowedError阻止时，既有pointer/key交互只重试仍由owner持有的paused循环voice。一次性GA48/se07不延迟补播，stop/clear移除voice后不因后续交互重新创建。

普通2001的muzzle、shotPlayerResult、shotItemResult、Damage、Benefit与死亡/复活消费者沿既有正式事件复用。即时表现合同不要求独立flight实体；Result的远端视野裁剪保持现原入口，未观察到handle不能直接判为缺失。

## 整图时间接口

战车动画使用已恢复的`Math.fround(effectModelEngineDelta(browserDelta))`：原getter先按double比较0.5阈值，再存f32。SceneBreachVisual内部也已有独立模型时间适配；传给这些入口的时间不能先存f32再重新应用double阈值，否则0.499999999舍入为0.5后会错误变成0.1。

原地图更新`459634`（具名函数指针`5c7184`）将其传入f32 delta分派给原场景物件，并在`4596c5–4596d3`将同值传给水面`462d14`；该函数自身没有调用战车getter。地图物件/水面的上游时钟资格不能仅凭actor场景`45004a`的getter推定。当前Plant、水面offset和Castle文字接受各自供给delta，water纹理选择另沿wall timer。统一接线应保留这些区别；在地图caller时间来源闭合前，不对所有消费者添加统一截断，不改变服务器damage/fade/胜负的绝对时序。

## 尚缺来源与整图交付边界

地图02原CTL为空，仅证明默认选灯分支；默认toon纹理、位置和SetLight方向已有来源。普通actor的显式Attach effect身份、几何s_texToon填入及scene ambient具名producer仍缺，见[原光照来源边界](scene-actor-light-provider-gap.md)。现白光provider属于Web重建；没有来源支持无条件改用toon或任意ambient颜色。

本图资源、正式事件和生命周期接口已有实现不代表全部双端实际可见可听、全部placement或原GPU等价已交付。整图统一验证覆盖合法模式1/2/3、正常多人输入、运动碰撞、生命周期、退出重入及高清范围；现有局部失败和有限证据保持其原范围。
