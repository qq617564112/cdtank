# 小勇士001死亡与复活表现

原小勇士001使用四个原09 MV3死亡动作；09消息在001.elk没有绑定，死亡不派生通用爆炸或死者声音。M/U/X/Y各自完成后保留原动作尾帧，正式权威复活再切回原01。普通0007双网页同一次P3击毁可见原09散开与保留尾帧，另有双端四部件01自然复活、原击毁者GA14播放结束及普通离房重入清理证据。

## 原资源与消费者

| 部件 | 原09资源 | duration | 定时消息 |
| --- | --- | --- | --- |
| M | Data/role/001/09M.MV3 | 5601 | time320 effect1 / 1416378268 |
| U | Data/role/001/09U.MV3 | 5601 | time160 effect1 / 1416378268 |
| X | Data/role/001/09X.MV3 | 5601 | 无 |
| Y | Data/role/001/09Y.MV3 | 5601 | 无 |

`tests/combat-death-t01-source.py`逐原INI读取09文件、解析MV3原事件及duration，对照已发布四GLB引用；完整692字节原001.elk按已有原加载器布局解析，与发布groups/records相等。唯一ELK组为03/attack1→online004、tag_efattack、bindingMode3，没有09组。死亡两个effect1消息仍由正式`EffectRuntime.message`消费，lookup为空，不创建105的006、GA12或替代声音。原击毁者提示声属于`BattleSound`，不与死者静默混为一项。

正式`TankView.life(false)`停止攻击并将M/U/X/Y切至原09，`advanceAnimations`驱动各部件单次原时钟、实际GLB采样及定时消息。原actor时钟delta乘4800，因此duration5601在timeScale1约1.167秒；完成后time钳至5501、overMessage清零，保留该动作，直至权威alive恢复后`life(true)`切回原01。原actor单次/完成时钟执行依据复用现有tank-actor-clock-native-sol及effect-actor-clock证据。

## 复核

`recovery/.venv/bin/python tests/combat-death-t01-source.py`输出`combat-death-t01-source.json/.log`。正式双网页脚本为`node --import tsx tests/browser-combat-death-t01.mjs`；使用专用3289/5319/9519、临时账户库和浏览器目录，普通001选车/0007建房/加入/CPU/Ready/Space自然击毁与复活，主端用普通方向键转向观察P3，近距观察补充使用普通A/D/W移动输入；正式固定相机，不注入相机或位置，软件渲染framebuffer为320×180。每次产物保留独立时间戳。

## 实际运行

`combat-death-t01-actual.json/.log`为记录复核PASS，脚本为`tests/combat-death-t01-actual.py`。同一个普通CPU→P3 destroy在双端相等；`browser-combat-death-t01-2026-10-03T21-37-41-627Z`的双端实际09绘制包含四原GLB、顶点、世界矩阵、morph及原时钟，各部件5501/overMessage0至少保持两个不同render frame。主端远端模型与客端近景模型的原09散开及保留尾帧分别见该产物`-lastDraw-1/2.png`、`-lastTail-1/2.png`。截图不是独立残骸实体证明。

`browser-combat-death-t01-2026-10-03T21-32-08-035Z.json`为完整技术PASS：双端M/U/X/Y01实际绘制，alive恢复、HP=maxHP、deaths>0和自然respawn记录；双端普通离房后effects实例/网格/声音、BattleSound声音及玩家均0。普通离房重入专项通过`--reentry-only`执行，重入0007只载入一辆001，再离房五资源仍均0；记录由`combat-death-t01-actual.json.reentrySource`精确关联。

双端09 effect1消息照常消费，完整原001.elk无09记录，效果实例前后相等且无死者声音。原tankType1击毁者提示选择soundId55/GA14，在默认浏览器音频策略下实际start并自然end；它绑定击毁者角色位置，与死者静默分开。其他角色同时射击的炮口效果仍属于原03消息。

专用Vite关闭HMR并忽略并行家园描述文件变更，保持本次地图资源生命周期；该配置仅属于验证进程。3289/5319/9519、临时账户库及浏览器目录在退出时清理。

## 限制

双可见09来源运行保留总体FAIL：主端复活01的X部件未进入其实际绘制记录；双端四部件01与清理引用独立完整PASS运行。旧105的006/GA12证据不作为001来源。

本片不恢复原服务器伤害、死亡计数、复活时限/HP/出生点规则，也不以09模型尾帧代表独立残骸实体。普通2001当前已依据4288fe即时目标查询与反馈分支接入同开火阶段的权威结果；actor+2a0尚未证明为弹丸producer，不作为基础射击交付前置条件。原服务端查询、伤害与完整飞行表现仍未恢复，当前范围见ordinary2001-immediate-accepted.json。
