# 0021未致死命中来源边界与现有消费者

原ShotItem接收链没有本地HP判断：非type2消息直接调用Breach破坏并播放GA13。原服务器未致死伤害判定及ShotItem生产入口尚未取得，不能把当前重建HP下的完整模型保持与静默视为原版来源。

## 来源

原42b946将4247aa注册到名称`UMsgPrNotifyShotItem`（5c3c3c）；相邻424614注册为`UMsgPrNotifyShotPlayer`。4247aa按消息+c查角色，再通过场景virtual48按消息+14的位置及+34类型查对象。类型2跳过破坏；其他类型将消息+38原参数送入44e081，再递增角色+314。44e081调用Breach45e7b0，后者不读取该参数或HP，直接切模型+e4=+e0并设置破坏状态；GA13由模型名分派。远端角色还有后续Shot展示与动作通知，它们不等同物件HP变化。

`tests/scene-breach21-hit-native.py`完整执行4247aa→44e081→45e7b0，20组类型0/1/2/3及参数0/1/54/200/ffffffff证明非type2始终切c9并播放GA13，type2保持完整且不播放。真实obj05466加载器准备完整/破损模型，原字符串比较、派生破坏和声音选择实际执行。角色/场景查找、图形加载/设备、字符串格式/存储、分配与NAV更新为明确供给边界。证据`scene-breach21-hit-native.json/.log`包含4段原指令。

唯一未闭合来源是原服务器的物件非致死伤害判定及发送ShotItem的生产入口；消息+38不能未经证据称作HP或伤害。原Breach未致死模型/声音资格没有恢复，M3-08-BREACH21-HIT保持未完成。

## 正式模块与现有接线

现有ScenePreview.updateObjects仅在权威ObjectiveSnapshot.hp为0时启动SceneBreachState破坏；hp>0保持原完整POL、alpha1，不提交破损c9。GA13只由真实objectiveDestroyed经Battle→ScenePreview.destroyObject分派，普通objectiveHit没有声音消费者。该行为是现有重建HP规则下的正式呈现合同，不新添占位受损模型或空命中接口。

致死后的原模型、动画、GA13、淡出与隐藏消费者沿用四型号已完成来源；本片实际双端选用obj05422，见`scene-breach-0021-05422.md`。本片不改变服务器、协议或Battle，NAV与HP规则仍为明确重建来源。独立可交付部分是现有模块的逐次非致死→致死实际验收；不以此补造原静默结论。

## 现有重建合同的实际双端验收

`tests/browser-scene-breach21-hit.mjs`使用当前React入口、普通0021/Ready、两个真人账户AI托管与两个CPU，无状态、位置、HP或命中通知注入。共同物件129（obj05422、SCN:129）三次自然非致死HP阶段为145.8、91.6、37.4；两端在真正onBeforeRender提交原完整POL108顶点时记录阶段，命中通知计数分别1/2/3，均先于下一次命中。

本机帧478/483/488、tick416/424/432；远端帧416/422/427、tick415/425/433。每个阶段均intactEnabled=true、fading=false、hidden=false、alpha1、soundPlayed=false、该物件GA13请求0、破损c9绘制0。该静默统计只针对物件破坏消费者；普通开火动作、炮口和Shot显示保持独立。

第四次命中消耗剩余37.4后，真实objectiveDestroyed创建对应原c9十节点并播放该源ID的GA13。自然捕获帧494/433，alpha0.9247499704/0.8980500102；GA13在[343.9215698,0,-397.9251709]播放一次、非循环、实际playing与ended，时长0.701814秒。碎片隐藏后普通CPU自然局两端OBJECTIVE结算、73目标HP0，同房正常再战round2恢复完整模型及alpha1状态，声音去重清零；离房breakables、碎片网格、效果实例、场景声音与战斗声音全部0。

`browser-scene-breach21-hit.json/.log`为PASS；自然致死画面`browser-scene-breach21-hit-natural-1.png`与`-2.png`。3286/5316/9516专属服务关闭。本片没有生产代码变更：现有模块和正式通知消费已经满足上述重建合同；原未致死生产入口缺口保持未完成，不能以浏览器静默替代原来源。
