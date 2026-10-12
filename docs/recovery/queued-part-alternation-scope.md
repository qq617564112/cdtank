# 两项部件被动表现轮换

当前缺环是正常玩家同时装备17031／17032后，原31→32→31的五秒队列轮换实际绘制、静默及清理。单项13501、13502与自然复活证据直接复用queued-part-effects-business.md、queued-part13502-actual.md和queued-part13502-life.md；原队列来源复用role-queued-glow-source.json及现SkillEffectNotifications，不重复来源或模块执行。

正式消费者已具备queuedPartSkillIds资格与play→revive首项入口。原488cad停止当前项并激活后继，4046a5真实elapsed调度，现advanceTimers仅remaining<delta时轮换并重设5秒；stop后旧树可自然收尾，实际remove不是立即轮换的门禁。

专属browser-queued-part-alternation.mjs复用已真实购买tank3／pet2的检查点，正常认证Shop BUY17031／17032及Equipment PART0／1，再双普通React mode4/map7 Ready。只读包装原play／alternate／advanceTimers与真实绘制，记录13501／13502队列、两次原期限轮换、2500／2755新句柄、至多三次真实onAfterRender完整画布、声音轨迹和正常SourceClose清理。原资金预房夹具沿检查点披露；不注入活跃资格、时钟或通知，不改生产。

普通首actual browser-queued-part-alternation-2026-10-05T03-25-09-133Z.json已完成。真实BUY17031／17032实例4／5，余额93980→92480→90980，正常EQUIP槽0／1；双React正式PLAYING快照资格[13501,13502]。预房角色与资金沿真实购入检查点明确，不以本次证明角色购买页面。

双端原play各两项duration0／role1，2500→2755→2500句柄6→7→8。真实elapsed两次间隔本机5.094200／5.100400秒、观察端5.074000／5.109000秒，各在5至5+当前delta内；旧节点quiescent移除后同次alternate启动下一项，后继timer归5秒。实际timerBefore为空，因调度先删timer再调用alternate，不据空字段声称直接采到严格比较分支。

六张640×360原onAfterRender完整画布中双31首次与返回黄色粒子可辨；两张32中间画布无可辨粒子。32原2828实际绘制成立，轮换后32像素保缺口，不能由旧单项像素替代。两端所有三个激活slot音源0，树声音请求空、真实capture两种voice均0。普通SourceClose后worldnull与实例／网格／skillvoices／treevoices／Battlevoices全0，进程正常清理GPU。

专属tests/queued-part-alternation-actual.py核验生成recovery/output/queued-part-alternation-actual.json。有限范围为正常双项队列、真实五秒时序、旧stop／新start、31返回像素、原静默及Leave；32轮换像素／HD父开放。部件持久化／死亡复活／旧单项证据不在本片重复。
