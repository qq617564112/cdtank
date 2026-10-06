# 普通战斗表现缺口

现有 **M3-04 MV3全动作与混合优先级** 下的 `M3-04-LOCAL-HURT-CAMERA` 已接三部件战车151本机普通受击原相机抖动，来源与实际双端闭环见 `combat-local-hurt-camera.md`。

| 内容 | 原来源 | 正式模块与普通触发 | 绘声及清理状态 |
| --- | --- | --- | --- |
| 普通2001炮口 | 03/attack1、ELK004/tag_efattack、GA07 | fire→BattlePlayers.fire→TankView03→EffectRuntime | 双端五节点实绘、声音结束及Leave已有PASS |
| 普通2001世界Shot | 4288fe/4245c9→423956/489ba8、item2001第二技能4020→007/SE30 | 正常开火的fire.shotDisplay→TankShotDisplay | 双端原五节点、二维声音、自然结束、再战清理已有PASS |
| 普通hurt05–08 | 435745方向分类、464e72→46897a/46c396 | hit.hurtSelector→BattlePlayers.hurt→TankView.hurt | 001四部件、151三部件与105代表双端原动作和源静默已有PASS |
| 三部件本机hurt相机 | 46897a的本机role比较及相机virtual+18；4556e2与原完整shake更新 | 普通151非致死hit→本机身份和源三部件gate→ordinaryHurtCamera | 本机原抖动、远端与四部件静默、自然恢复、Leave/round clear已有PASS；不增加声音或效果树 |
| 特殊弹药炮口切换 | 4661c9重写03/attack1记录及原弹药声音分派 | BattlePlayers.applyAmmoEffect消费已确认ammoItemId与原item首效果，调用TankView.setAmmoAttackEffect | 2007/2011等已有双端普通炮口绘声及生命周期证据，直接复用 |
| 静态BOX远端场景结果 | 原scene virtual+48/type2查`.box`vector，4247aa跳过破坏仍调用423956→423092 | sceneStaticHit冻结2001和真实源BOX查询端点→既有远端007/SE30与GA07；静态身份通知为明确重建 | 来源与BOX8/29普通双端结果见scene-shot-type2-source.md；低res爆火、累计五节点与双Leave已验，高清范围开放 |
| 独立弹丸碰撞效果 | 现terrainHit与即时Shot分别存在 | terrainHit没有独立原效果消费者依据 | 不能沿007/SE30补造碰撞爆炸；不选择本片 |
| 原场景光照provider | 地图02零候选默认灯[0,200,0]、toon/0.bmp及view空间方向已有来源与原执行；非零候选选择未闭合 | 当前scene ambientWhite是重建；普通角色Attach调用方与显式effect实参尚未取得，SetLight不等于选择toon | 尚无该provider正式接线或普通实战；既有日光静态像素验收仅证明亮度变化 |

## 高频坦克表现四层状态

| 内容 | source | module | ordinary wire | actual |
| --- | --- | --- | --- | --- |
|05–08受击动作|原分类/dispatcher、001/151/105原MV3与ELK|TankView.hurt及原clock，EffectRuntime.message|hit.hurtSelector→BattlePlayers.hurt|代表车型双端原动作/源静默、恢复与清理PASS|
|105死亡爆炸/声音|原09 effect1→ELK006/tag_efcenter，GA12|TankView.life(false)、EffectRuntime原树/声音|权威alive进入09，原MV3定时消息|双端11节点实际draw/GA12ended、满血01复活/Leave再入PASS|
|001死亡模型尾帧|原四09MV3、完整ELK无09绑定|单次clock完成停尾，无替代爆炸|权威alive false→09|双端原模型散开/尾帧与独立复活/清理证据PASS；不代表独立残骸|
|复活清理|原01动作/既有角色与技能生命周期边界|TankView.life(true)、BattlePlayers presentedLife与skillEffects.revive|权威alive恢复|双端HP恢复、01draw及Leave资源清理PASS|
|受损烟雾/独立残骸|缺原触发/创建合同|无可据来源建立的新consumer|不能只由HP低或死亡事件推定|保持未完成|

完整已发布ELK目录没有05–08组；09组只见105/effect1与158/attack1，均由现通用动作消息消费者查原记录处理。没有将缺actual车型覆盖误报为缺正式消费者。

## 本机三部件受击合同

`combat-hit-native.json`保存原`46897a`完整指令。动作派发后，`4689be–4689d5`调用`4269c4`并将返回role与actor的`+258`比较；仅相同角色继续。`4689d7–4689fd`取相机管理器virtual`+28`返回的相机，调用该相机virtual`+18`，参数依次为`1,0.5,10`。原EXE常量`5cd00c`为float32 `0.5`，`5e68c8`为float32 `10`。四部件入口`46c396`在动作派发后直接返回，没有此相机分支。

当前`tests/combat-hit-native.py`给`4269c4`返回0，已有普通hurt oracle只覆盖非本机相机分支。`combat-local-hurt-camera-native.json`现已执行32条三/四部件、本机/非本机、selector1–4与两种状态模式序列；原`4269c4`及真实相机vtable`5c6dd0+18→4556e2/45573f`执行，只有三部件本机激活。active-camera选择、状态模式查询、动作应用及角色field15服务为明确供给边界。四部件保持原无相机调用。原相机激活与完整更新已有`effect-camera-shake-native.json`的90次激活、540次更新，直接复用其数学和随机消费。

`BattlePlayers.hurt`返回原三部件资格，`TankView.usesThreePartActor`按U源动作识别结构，`Battle`按本机身份调用`EffectRuntime.ordinaryHurtCamera`，复用其已持有的`EffectCameraShakeView`。双网页普通输入已产生151非致死命中，原参数和实际view变化、远端及四部件不激活、自然恢复、Leave与再战clear均PASS；生产没有修改动作、声音、伤害、相机跟随或服务器规则。

## 已保留范围

环境光初始化与setter边界见`scene-ambient-setter-caller-gap.md`：既有原执行保存graphics初值RGB0.2／alpha1；具名setter的直接引用范围未取得普通调用方，不证明计算写入或动态调用不存在，也不能由初始化值推出完整战斗日光。

地图02角色provider见`scene-actor-light-provider-gap.md`及`scene-actor-default-light-native.json`。原0002.ctl为零记录，默认灯位置[0,200,0]、资源data/image/toon/0.bmp与view空间位置差归一化有具名来源；三／四部件12组完整更新、42次SetLight保存及scene清除mode0已有原执行。该执行不覆盖纹理上传、shader提交或普通对局。正常MV3 selector不追加0x1000；gbActor::Attach(1000a0b0)向模型selector转交显式effect的入口已定位，普通游戏调用方与effect实参身份仍缺。GeomNode的s_texToon填入是独立几何资格，不替代角色Attach来源。当前正式provider与实际表现仍未恢复，不据方向合同无条件启用toon；既有方向、初始化、selector及日光像素证据直接复用。

地图18的66/67来源capture保存在`browser-scene-animation-0018-coverage-2026-10-04T05-37-29-480Z.json`及独立checkpoint/PNG。未据capture状态关闭双端可辨图像资格。其专属3311/5341/9541监听与临时目录已清理；本审计没有继续运行地图截图验收或修改生产代码。
