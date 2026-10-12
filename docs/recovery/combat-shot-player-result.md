# 普通2001玩家命中结果

ShotPlayer3aa3的424614取得攻击者和受害者；两者存在时，从攻击者virtual+18(selector12)读取当前弹药，遍历item+108/+10c/+110三个技能，仅对TriggerType8调用4886aa(受害者ID,技能ID,retention0)。这发生在本机角色判断之前，本机与远端攻击者均适用。

普通2001技能4020首项为effect7、binding3、tag0、SE30。非队列4886aa先调用受害者actor virtual+a8(7,3,0,1)，再通过431fe0取得受害者role+25c位置，调用485b1b(SE30,位置,selector1,方向0/0/-1)。007使用主tag_efcenter实时矩阵；声音是空间声音。Shot即时世界007使用45afc2与4858f2二维SE30，属于另一个显示入口。

TankShotPlayerResult仅接受2001/4020，复用EffectRuntime已有挂点与空间声音消费者。正式Battle处理合法hit的shotPlayerResult时，先显示受害者结果，再执行hurt。World仅在普通开火选择的目标合法受到伤害时附带冻结弹药ID；burn、免疫或拒绝伤害不附字段。原3aa3读取攻击者当前弹药；Web字段是重建权威开火显式快照，没有声明原消息携带itemId。

combat-shot-player-result-native.py执行424614至本机分派之前，并执行4886aa普通非队列分支；12组覆盖本机攻击者、本机受害者、两者均非本机、受害者存在/缺失与TriggerType0/8。431fe0位置getter执行原指令，直接返回role+25c；该位置存入的125.5/20/-77.25逐项传到声音入口。角色/表查询、actor绘制及485b1b声音为供给边界。combat-shot-player-result.cts使用正式catalog验证资源、挂点、oneShot、本机视图和声音调用顺序，覆盖非普通弹药静默。

## 普通双端验收

`browser-combat-shot-player-result-2026-10-04T13-54-00-875Z.json/.log`为PASS。正式React入口、双账户原资料预置、地图0007/模式4，普通创建/加入/CPU/Ready/Space输入；不注入hit或结果通知。两端各收到8条2001结果调用，本机/其他受害者为3/5与5/3；受害者位置逐项传入空间SE30。存在同值合法hit在双端实际绘制007全部五节点、保留实时tag_efcenter引用并自然结束，同时SE30实际播放、产生source音频输出并自然结束。同值事件关联用于呈现对照，不作为唯一消息ID计数。

两端完成五节点绘制且自然结束的007为1/6棵；其余远端显示保留原oneShot裁剪资格。空间SE30各8次，观察时各7次已有音频输出并自然结束。原hurt动作实际观察7/6次，各发生一次09死亡及满血01复活。离房后效果实例、效果网格、BattleSound和空间声音均为0。画面为160×90缩减3D分辨率，不是HD性能验收；actual-1/2.png保存真实页截图。03/004/GA07来源与生命周期复用既有普通双端证据。

专属3335/5365/9565与临时账户数据库均已清理，记录见`combat-shot-player-result-process-cleanup.json`。

## 边界

普通2001接受开火后先启动03，约0.4秒后解析目标并产生合法命中结果，不创建独立飞行弹丸。原42b020→4046a5→4288fe定时链与正式接线见`combat-fire-timing-and-effect-depth.md`；服务端场景几何和伤害判定仍为重建规则。上述13:54浏览器证据保留结果消费者的绘制与声音范围；`ordinary2001-immediate-network.md`不证明当前定时流程。本次未运行新验证。尚未确认原客户端全部飞行表现、完整3aa3字段及原服务端结果资格，不关闭M2-04-VISUAL父项。
