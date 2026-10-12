# 0020普通001非致死05受击

`combat-hit-t01-0020-actual.json/.log`局部实战记录核验PASS：两个普通001网页在0020收到同一目标P4的两次非致死selector1命中，均来自P1普通按键开火。双端实际提交四个原05 GLB，原MV3采样权重随自然时钟变化，M/U time160消息保持效果与声音静默，四组件原over消息在2461完成，随后恢复01。表现生产消费者无需修改。root独立运行增强记录核验并观察双原截图，结果PASS，日志`combat-hit-t01-0020-root-verifier.log`保留。

## 来源与正式入口

复用`combat-hit-native.json`原look方向分类和四组件hurt dispatcher/flags4、原actor时钟执行依据。`combat-hit-t01-0020-source.json/.log`核原001 INI/MV3与发布资源：05 M/U/X/Y均duration2561；M/U各有time160 effect1/1416378268，X/Y无定时消息。完整692字节001.elk仅03/attack1，05无绑定，禁止借用105特效或声音。

正式链为World普通弹丸命中→hurtSelector1→Battle事件→BattlePlayers.hurt→TankView.hurt→四原05单次时钟→EffectRuntime.message。原完成消息over/1870030194属于四个组件，与M/U定时消息分开核验。完成状态四时钟为2461、overMessage0，下一正常渲染状态恢复01。

## 实际局部范围

原浏览器记录为`browser-combat-hit-t01-0020-2026-10-03T23-35-05-094Z.json`及`browser-combat-hit-t01-0020-run1.log`。普通mode5/0020建房、两001账户和两CPU满足min4，普通S退后拉开距离，双方普通A/D使受击者look与射手look反向，方向键瞄准及Space射击。61条实际位置/朝向/HP和按键样本保存，无位置、HP、时钟、相机或事件注入。两次命中均value43，P4权威HP300→257→214，保持alive，无destroy。

双端捕获frame247/183中M/U/X/Y原05 GLB均实际onBeforeRender。每部件本地9次/远端7次draw，分别8/6种不同morph权重；逐draw的非零权重与原05 MV3帧时间、当前自然clock及GLB float32时间线性采样核对。记录核验保存每部件最大权重误差，不能仅以asset名或draw数量代替动画证明。

两个原截图由该记录的`capture.canvas`恢复为`combat-hit-t01-0020-accepted-05-1.png`和`-2.png`，未重跑浏览器或调整相机。主端远处目标与客端近景001实际可见。画布软件320×180，不证明高清性能或原GPU像素等价。

## 验收与清理边界

原主运行状态保留FAIL：末端断言未按identifier区分定时消息与完成消息，把X/Y的合法over消息误计作M/U time160消息。`tests/combat-hit-t01-0020-actual.py`对不可修改的原记录独立核局部范围，并保存明确sourceBrowserStatus=FAIL；专属browser断言已按两类消息正确分开。该PASS只证明已记录普通受击闭环，不宣称完整浏览器运行PASS。

此次未走到普通Leave。原JSON的lifecycle.scope中“this run checks ordinaryLeave”是原验收意图，非实际执行；独立actual与本文均明确此边界。未修改player/effect/scene消费者，普通Leave及同map/001自然FINISHED/Rematch引用`browser-breach20-05442-2026-10-03T23-21-05-452Z.json`已验证范围；同角色死亡/复活引用`combat-death-t01-actual.json`，不重复180秒整局。专属进程/端口/temp由本次正常finally清理，独立`combat-hit-t01-0020-process-cleanup.json`核3295/5325/9525关闭、相关进程及目录0，此检查不冒称页面Leave计数。

## 限制

本片只覆盖001/0020同P4的05非致死普通受击，06/07/08、其他战车、多动作混合优先级与三组件本机相机响应仍属父缺口。服务弹丸、命中几何、43伤害及HP属于既有明确重建规则，未因表现验收改变；原完整M3-04/M4-09保持未完成。
