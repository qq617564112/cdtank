# 0020普通001方向07受击

普通0020双001、两CPU与真实Ready实战通过：同P1→P4非致死selector3命中，HP300→257。两端提交四个原07组件全部四源网格，动画权重随正常时钟变化并与原MV3采样一致；M/U原effect1消息保持受击效果与声音静默，四组件在2461完成并自然恢复01。表现生产消费者无需修改。

## 原来源与正式入口

`combat-hit-t01-07-0020-source.json/.log`为PASS。逐原001四INI的action_7核07M/U/X/Y.MV3，并与发布GLB/metadata逐字段对照；duration均2561，各mesh16帧。M为Box109、U为Box120、X为Box110、Y为Box111，各1mesh，共4。M/U各time160 effect1/1416378268，X/Y无定时消息；完整692字节001.elk仅03/attack1，07无效果或声音绑定。

原look方向分类、selector1..4 dispatcher、flags4及正常actor时钟执行复用既有`combat-hit-native.json`与`tank-actor-clock-runtime.md`依据。正式链为World普通hit.hurtSelector3→Battle→BattlePlayers.hurt→TankView.hurt→预载原07四组件单次clock→EffectRuntime.message。

原动作clock起点为1，定时事件按`previous < eventTime <= current`跨越触发，回调time为当前clock，时间160是资源keyframe。本次M/U回调主端445、客端362，分别位于跨越后的实际帧；记录未采样到07的pre-crossing帧。1870030194完成消息与effect1分开核验，完成clock2461/overMessage0。

## 正式双端实战

`browser-combat-hit-t01-07-0020-2026-10-04T00-39-20-113Z.json/.log`完整PASS。默认001普通建房/加入、0020/mode5、两CPU满足min4；普通S拉开距离，A/D将双方look差对齐至+π/2，方向键瞄准与Space射击。49条实际输入/位置/朝向/HP样本保存，未写角色位置、伤害、胜负、时间、相机或事件。

两端记录同P1→P4一次普通selector3/value43，P4始终alive，无destroy。捕获帧257/206均在受击HP257时实际提交四原07组件；主端远处目标与客端近景原001可见倾斜受击姿态。完整原截图为`combat-hit-t01-07-0020-accepted-1.png`和`-2.png`，由该运行capture.canvas恢复。

| 网页 | 每组件实际draw | 每组件权重状态 | 最大原权重误差 |
| --- | --- | --- | --- |
| 1 | 4 | 3 | 4.996003610813204e−16 |
| 2 | 5 | 4 | 6.661338147750939e−16 |

`tests/combat-hit-t01-07-0020-actual.py`逐draw按真实mesh名选择原07 MV3节点，以每节点16原帧的GLB float32时间与当前clock计算线性morph权重；全部四源网格均实际draw，非恒定且有非零权重。`combat-hit-t01-07-0020-actual.json/.log`为PASS；root独立执行核验PASS见`combat-hit-t01-07-root-verifier.log`，并查看双实际截图。

M/U仅派发原effect1定时消息，调用前后受击消费者instances、effect voices、skill voices不增；X/Y没有该消息。两端四over消息均为2461，主端frame259/261、客端209/211分别完成并恢复01，P4 HP257。其它玩家普通开火声和效果独立存在，不计作受击新增表现。

## 清理与范围

本次普通Leave实际执行，两端players、effect instances、effect meshes、effect voices、scene voices、battle voices六计数均0。专用3298/5328/9528进程、监听与临时目录清理PASS见`combat-hit-t01-07-0020-process-cleanup.json/.log`。

未改生产模块；同map001自然结算/再战引用`browser-breach20-05442-2026-10-03T23-21-05-452Z.json`，同001死亡/复活引用`combat-death-t01-actual.json`。该短局完成07普通受击专项，无需重复180秒整局或发行构建。

## 限制

内部软件画布320×180；原GPU像素、高清性能、其他selector/战车、完整混合优先级及原伤害规则未由本片关闭。服务弹丸与43伤害仍为既有明确重建规则。
