# 0020普通001方向06受击

普通0020双001、两CPU与真实Ready实战通过：同P1→P4两次非致死selector2命中，HP300→257→214。两端提交四个原06组件全部14源网格，动画权重随正常时钟变化并与原MV3采样一致；M/U原effect1消息保持受击效果与声音静默，四组件在2461完成并自然恢复01。表现生产消费者无需修改。

## 原来源与正式入口

`combat-hit-t01-06-0020-source.json/.log`为PASS。原001四INI的action_6绑定06M/U/X/Y.MV3，与已发布GLB/metadata逐字段相同；duration均2561，每mesh16帧。M包含11原网格，U/X/Y各1，共14。M/U各time160 effect1/1416378268，X/Y无定时消息；完整692字节001.elk仅03/attack1，06无效果或声音绑定。

原look方向分类、selector1..4 dispatcher、flags4及正常actor时钟执行复用既有`combat-hit-native.json`与`tank-actor-clock-runtime.md`依据。正式链为World普通hit.hurtSelector2→Battle→BattlePlayers.hurt→TankView.hurt→预载原06四组件单次clock→EffectRuntime.message。其它selector、死亡/复活和场景生命周期沿既有消费者。

原动作clock起点为1，定时事件按`previous < eventTime <= current`跨越触发，回调time为当前clock，时间160是资源keyframe。本次M/U回调主端为508/322，客端478/481，分别位于跨越后的实际帧；记录未采样到06的pre-crossing帧，不把回调time称作原keyframe。1870030194完成消息与effect1分开核验，完成clock2461/overMessage0。

## 正式双端实战

`browser-combat-hit-t01-06-0020-2026-10-04T00-16-49-892Z.json/.log`完整PASS。默认001普通建房/加入、0020/mode5、两CPU满足min4；普通S拉开距离，A/D对齐双方look，方向键瞄准与Space射击。35条实际输入/位置/朝向/HP样本保存，未写角色位置、伤害、胜负、时间、相机或事件。

两端记录同P1→P4两次普通selector2/value43，P4始终alive，无destroy。捕获帧224/162均在首次受击HP257时实际提交四原06组件，主端远处目标与客端近景原001可见。完整原截图为`combat-hit-t01-06-0020-accepted-1.png`和`-2.png`，由该运行capture.canvas恢复。

| 网页 | M实际draw | U/X/Y各draw | 每组件权重状态 | 最大原权重误差 |
| --- | --- | --- | --- | --- |
| 1 | 110 | 10 | 7 | 6.661338147750939e−16 |
| 2 | 132 | 12 | 11 | 6.938893903907228e−16 |

`tests/combat-hit-t01-06-0020-actual.py`逐draw按真实mesh名选择原06 MV3节点，以每节点16原帧的GLB float32时间与当前clock计算线性morph权重；全部14源网格均实际draw，非恒定且有非零权重。`combat-hit-t01-06-0020-actual.json/.log`为PASS；root独立执行核验PASS见`combat-hit-t01-06-root-verifier-final.log`，并查看双实际截图。

M/U仅派发原effect1定时消息，调用前后受击消费者instances、effect voices、skill voices不增；X/Y没有该消息。两端四over消息均为2461，最终同P4 HP214/alive恢复01。其它玩家普通开火声和效果独立存在，不计作受击新增表现。

## 清理与范围

本次普通Leave实际执行，两端players、effect instances、effect meshes、effect voices、scene voices、battle voices六计数均0。专用3297/5327/9527进程、监听与临时目录清理PASS见`combat-hit-t01-06-0020-process-cleanup.json/.log`。

未改生产模块；同map001自然结算/再战引用`browser-breach20-05442-2026-10-03T23-21-05-452Z.json`，同001死亡/复活引用`combat-death-t01-actual.json`。该短局完成06普通受击专项，无需重复180秒整局。此片不要求额外发行构建。

## 限制

内部软件画布320×180；原GPU像素、高清性能、其他selector/战车、完整混合优先级及原伤害规则未由本片关闭。服务弹丸与43伤害仍为既有明确重建规则。
