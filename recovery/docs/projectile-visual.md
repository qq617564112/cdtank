# 普通2001射击显示

正式客户端移除无原资产来源的黄色球体、发光材质和球体帧外推。服务器发射、BulletSnapshot、轨迹、碰撞、伤害规则保留现有重建合同；去占位不恢复原弹丸规则或证明原版没有飞行显示。

普通2001已恢复的原表现分别来自BeforeShot的角色03、动作ELK的炮口004、Shot观察者的GA07角色位置声音，以及原Shot分派允许的世界007/SE30。即时世界007在射击时按传入目标位置显示；独立ShotPlayer3aa3结果入口另将007挂在受害者tag_efcenter，并以受害者role+25c播放空间SE30。004是炮口挂点效果。来源与正式事件合同见`combat-shot-player-result.md`。

## 来源边界

原actor完成入口4647df读取actor+2a0；存在观察者时把actor+298保存的角色ID送入virtual+8，随后清零ID。4686e6构造清零观察者，4683d3–4683e6析构通过virtual+4释放。该字段属于可选完成观察者，尚未取得非零绑定来源及末端业务，也未取得独立飞行实体创建/更新入口。玩家结果424614→4886aa独立成立，不以该观察者或飞行消费者为前置条件。

已恢复的Shot通知所有者+8c与actor+2a0不同。423092→49f571→4cefc9更新角色绘制记录并选择GA07/08/09/10；485b1b→571d14→56fee9是角色位置WAV播放，不能提供飞行几何或轨迹。现有声音执行证据见`skill-effect-message.md`及`audio-runtime.md`，原回调执行见`projectile-actor-binding-sol.md`。

有界直接偏移查找中的431d80是角色记录setter，476597是另一效果的float初始化，4a98c8和4be2b3写入界面查找所得控件。它们没有连接到actor完成观察者。静态原指令保存在`projectile-flight-boundary-source.json`，可由`recovery/export_projectile_flight_boundary.py`导出。直接偏移候选没有闭合绑定，不排除间接字段写入。

## 验收

`tests/browser-combat-nosphere.mjs`使用独立服务器、Vite、浏览器和账户，普通0007/105/CPU/Ready/Space输入进入双端对局。观察权威弹丸非空时的真实画面、原03与004绘制、GA07及SE30声音生命周期、007五节点绘制和自然结束，以及自然命中、死亡、满血复活、退出与重进清理。Shot目标分派只观察实际发生的普通事件：PLAYER不创建007或SE30；SCENE显示位置Y25；FREE使用原自由瞄准点。地图及角色检测几何仍为明确重建来源。

实际双端结果为PASS，证据`browser-combat-nosphere.json/.log`及`browser-combat-nosphere-natural-1/2.png`。两端51条fire的分支均为FREE12、SCENE31、PLAYER8；所有SCENE位置Y25，所有PLAYER事件无007/SE30请求。每端10棵FREE和22棵SCENE的007树实际绘制全部五节点并自然结束，12/31次SE30分别自然结束。51次GA07实际自然结束；004全五节点绘制并结束26/62棵；03实际网格提交520/1820次。权威弹丸非空171/172帧，球体网格始终为0。每端8次自然命中，本地P1死亡09后满血200恢复01；退出及新房重进退出后的效果实例、效果网格、两类声音和玩家计数均为0。同值fire关联用于说明双端呈现，不作为唯一事件ID计数。同房再战沿用`browser-combat-shot-rematch.json`已验证的正式清场合同。

飞行显示消费者仍未恢复。客户端即时目标/显示与当前重建服务端弹丸时序分别记录；玩家结果恢复不证明原即时伤害权威已恢复。
