# 技能效果通知契约

`UMsgPlaySkillEffect`按数字类型`0x4170`(16752)路由，`UMsgStopSkillEffect`按`0x4171`(16753)路由。Play包含技能表ID、零起始效果槽、保留倒计数、角色ID和世界XZ位置；Stop只包含技能表ID与角色ID。两者没有道具实例ID或效果实例ID。

## 路由与packet

| 消息 | listener constructor／vtable | type getter | packet vtable | writer／reader | 对象大小 |
| --- | --- | --- | --- | --- | --- |
| Play | 0x48619d／0x5c9f80 | 0x4894bd → 0x4170 | 0x5ca2a8 | 0x4893cb／0x48944e | 0x24 |
| Stop | 0x4861db／0x5c9f98 | 0x48961d → 0x4171 | 0x5ca2d0 | 0x4895be／0x4895f2 | 0x14 |

注册0x488a79供给Play handler0x488291，0x488ac4供给Stop handler0x486b4a。0x488a9e／0x488ae9将debug名称0x5ca1d8／0x5ca1c4写到adapter，实际注册函数0x48baff在0x48bb14调用listener虚表+0xc取得数字键，再查找并插入该数字键。packet虚表+4与listener虚表+0xc使用相同getter；packet+8为reader，+0xc为writer。Play factory0x48935a申请0x24字节并写packet虚表，Stop factory0x48954d申请0x14字节。

## Play字段

| 对象偏移 | body bit偏移／宽度 | 字段 | 原指令证据 |
| --- | --- | --- | --- |
| +0x0c | 0／16 | skillTableId | 0x4882a7读该值，经0x413c65技能表manager和0x411068查记录；0x43ac11–0x43ac20把skill.dat第0列SkillTableID存到record+0xc |
| +0x10 | 16／4 | effectSlot | 0x4882f1／0x48838a以该值索引skill record+0x70，0x48851a／0x4885a5同时索引record+0xd0；0对应Effect1，1对应Effect2，2对应Effect3 |
| +0x14 | 20／16 | retentionCountdown | 0x488493测试非零；0x488502–0x488505复制到保留record+0xc；0x4869b6每次保留计数更新减1，等于0时停止 |
| +0x18 | 36／32 | roleId | 0x4882cd–0x4882d7测试该值；非零在0x48835f–0x48836b作为0x48a226角色registry查找键；0表示世界位置效果 |
| +0x1c | 68／32 | worldX: float32 | 0x48833a–0x48833d将其放到世界效果XYZ第一个分量 |
| +0x20 | 100／32 | worldZ: float32 | 0x48831f–0x48832a将其放到XYZ第三个分量；中间Y在0x488334–0x488336设0 |

body总计132bit，字段按低位优先紧密排列；没有把4bit的effectSlot扩成整字节或插入padding。32bit位置字段由原指令直接复制浮点payload。writer依次调用0x401c7a，reader依次调用0x401d58，后者读前将目标清零。这个契约描述body；数字type在外层packet envelope如何封装需使用总协议的既有实现。

技能表loader0x43ac83–0x43acf0从column7开始，循环三次，每次读四列：EffectN存record+0x70+4×slot，SoundN字符串存record+0x7c+0x1c×slot，EffectTagN存record+0xd0+4×slot，EffectMethodN存record+0xdc+4×slot。Play handler使用EffectN／SoundN／EffectTagN，未读取EffectMethodN。effectSlot的wire字段可容纳0–15，但该handler没有范围检查；表中实际只有三个槽。

## Play应用

`roleId=0`时，handler将EffectN格式化为`_root\\online\\%03d`，EffectN=0则直接返回。0x48831f–0x488345调用0x45afc2，位置为`[worldX,0,worldZ]`、末参数1，随后销毁临时字符串。原handler执行fixture得到Effect19→`_root\\online\\019`、`[12.5,0,-4]`；Effect31也按相同规则选择。

`roleId!=0`时，先查角色与role+0x310的绘制对象；角色或绘制对象缺失、EffectN=0时返回。非零roleId查找失败不回退到世界位置分支，原执行fixture覆盖缺失角色和缺失绘制对象两种返回。通常在0x488598–0x4885b2调用该绘制对象virtual+0xa8，四参数依次为`(EffectN,3,EffectTagN,1)`。位置字段不用于此分支。该虚方法返回的handle仅在保留分支存入客户端record；packet不含这个handle。virtual+0xa8及挂点、裁剪与停止语义见下节的原生actor桥接证据。

保留分支需同时满足retentionCountdown非零以及0x48603a的技能白名单：`8,10,11,19,4005,30001,30003`。它先用0x4868d9查客户端保留vector，匹配三元组`(roleId,skillTableId,effectSlot)`；已有项时返回，不增加效果、不刷新倒计数。新项在0x4884f7–0x48850b存入：

| 客户端record偏移 | 内容 |
| --- | --- |
| +0 | roleId |
| +4 | skillTableId |
| +8 | effectSlot |
| +0xc | retentionCountdown |
| +0x10 | 绘制对象virtual+0xa8返回的本地效果handle |
| +0x18起 | 本地声音状态 |

保留分支在0x488517–0x488536调用`(EffectN,3,EffectTagN,0)`并保存handle，之后0x488589–0x488590插入保留vector。Skill12「扫光光（扫把）」的Effect1=19、EffectTag1=0，因此role非零时走通常分支`(19,3,0,1)`，即使retentionCountdown非零也不进入这个保留白名单。它的原type5子节点自身有生命周期。

技能ID13501–13506另外由0x486122判定，在0x488398–0x48848e把record加入按roleId组织的容器；record仍复制role／skill／slot／countdown，当前分支没有立即调用virtual+0xa8。复活、轮换与释放消费如下。

保留倒计数更新0x48698f把传入整数累加到global0x892b4c；累计达到30时将累计值清0，对所有record倒计数减1，归0则停止效果与声音并移除。原执行fixture以更新参数29、1、30验证倒计数2→2→1→删除。更新参数是30Hz固定模拟步数：主系统基类构造0x4019b5以参数30调用0x4060bc；0x406154按1/30秒步长返回1–3步，追赶上限为3。0x401000／0x40107d把步数传入主系统virtual+0x14（0x415da6），0x415f75／0x415fa2传到当前游戏状态virtual+8；活动游戏状态0x442af0／0x442b30遍历子系统virtual+8，技能系统0x486019跳到virtual+0x24（0x48698f）。因此packet保留计数以30个模拟步为一次递减，正常步速下一次为一秒。累计超过30的余量会被丢弃，不补发多次递减。

## Stop字段与应用

| 对象偏移 | body bit偏移／宽度 | 字段 |
| --- | --- | --- |
| +0x0c | 0／16 | skillTableId |
| +0x10 | 16／32 | roleId |

body总计48bit。Stop handler0x486b4a遍历保留vector：0x486b5f–0x486b65比较record+4与packet+0xc(skill)，0x486b67–0x486b6c比较record+0与packet+0x10(role)。匹配时经record+0x10调用0x47b81b取得本地效果，再调用0x4791de停止；record+0x18经0x48568d停止声音，然后释放和移除record。继续遍历，所有效果槽匹配同一skill／role都会移除。Stop不指定slot，不停止未被此vector保留的一次性效果，也没有在此handler移除13501–13506的独立队列。

## 验证与限制

`recovery/evidence/skills/skill-effect-message-native.py`执行两个原listener构造、type getters、两个packet原writer／reader和原0x401c7a／0x401d58 bitstream，验证两种body在0–7全部bit alignment共16次逐值roundtrip与紧密wire payload。原Play handler执行5个分支：世界位置槽0／2、普通角色效果、非白名单非零倒计数、白名单保留效果；另执行缺失角色／绘制对象返回、三元组去重与原Stop多槽匹配，以及倒计数到期。原skill.dat的Skill12条目同时保存到fixture。原table／role存储、绘制／声音接口、分配器与vector插入／删除通过供给边界记录；原handler分支、字段复制、技能白名单、去重搜索和Stop匹配逻辑执行原机器指令。

反汇编证据及执行样本保存在`recovery/output/skill-effect-message-native.json`。此项未执行socket传输、真实角色场景／声音渲染或施放权限／库存消耗业务。

## 独立生产通知状态模块

`apps/web/src/match/skills/skill-effect-notifications.ts`接收共享`PlaySkillEffectMessage`／`StopSkillEffectMessage`。backend供给技能表、角色查找及actor存在判断、world／attached效果、声音、停止、record释放和角色效果重置（resetRoleEffects）。`SkillEffectDefinition.effects`使用`effectId`／`tag`／`sound`字段，可直接接受`CombatSkillDefinition`；EffectMethod保留在catalog但不参与此原handler。

`play`按原488291处理world、普通oneShot、白名单持续记录与13501–13506角色队列；`stop`按原486b4a停止skill／role下全部持续槽；`update`按原48698f接收整数更新参数，累计>=30归0且只遍历一次，每record减1。重复持续三元组不刷新倒计时，普通oneShot和特殊角色queue不进入持续vector。`records`／`queues`暴露只读记录和角色分组；`revive`／`alternate`执行下述原生queue消费规则，`advanceTimers`以实际秒数更新5秒单次任务；`clearRole`／`clear`完成角色／系统释放，`queueTimers`提供只读计时状态。

native fixture扩充为9个序列、44个逐步callback／state样本，覆盖全部7个保留白名单、13500／13507普通边界与13501–13506特殊队列、同角色追加／另一角色分组、duration0、非白名单duration非零、tuple重复、Stop跨槽／角色／技能匹配、累计29+1与单次90／100只减1、缺技能／角色／actor／EffectN0。原特殊queue分支的分配与record复制执行原指令，外部map查找／插入及vector append通过供给边界记录；persistent tuple搜索和Stop比较执行原代码。输出`states`包括每条action之后的完整callback列表、retained records、role queues和累计更新参数。

`tests/skill-effect-notifications.cts`使用同一供给表／角色／效果／声音边界，执行实际通知模块，逐值比较44个callback顺序与记录／queue／accumulator状态，通过；`tsc --noEmit`通过。模块可通过下述生产runtime backend创建真实效果树；Battle生命周期与服务器消息入口仍待接入。

## 特殊角色队列消费与释放

`OnPlayerRevival` 0x488f73由角色事件分支0x425a45调用，按roleId查manager+0x1c／+0x20的queue map。不存在或空队列直接返回；非空队列选择首record，按record.role／skill／slot查角色与技能，调用actor virtual+0xa8 `(EffectN,3,EffectTagN,0)`并覆盖record+0x10，调用声音位置selector=-1、offset `[0,0,-1]`，将声音状态覆盖record+0x18。该调用保留record与原队列顺序，不删除、移动或递减记录。仅当queue长度>1时注册轮换定时器。

轮换定时器0x48894f接收 `(name,5.0,manager,0x488cad,0,roleId,currentSkillId)`。名称由0x487c36(roleId)与global0x892b30拼接。同一个role以当前skill作为下一次回调参数。0x486705将role／skill保存到callback对象+8／+0xc；0x486775把二者传给内部callback，0x42522f按内部对象+0x10（manager）和+0xc（0）设置this，再跳到+8（0x488cad）。

`_SkillAlternation` 0x488cad查同一role队列，按skillId找当前record；停止其effect handle和声音，选择下一record，末尾则回到首项。随后取消role定时器，激活所选record的效果／声音并覆盖handle／声音状态，再注册同名5秒单次定时器，回调参数换为所选record的role／skill。record仍留在原vector；inactive record保存已经停止的旧handle，下一次激活时覆盖。轮换不读取或递减record.duration，普通StopSkillEffect仍只处理持续vector。

5.0的单位是秒。主系统0x415da6经0x40607b读秒时钟，与前次global0x634db8相减，将实际经过秒数传给scheduler0x4046a5。0x40607b使用QueryPerformanceCounter／frequency，或timeGetTime乘0.001，两者均为秒。0x48894f创建scheduler+0xc上的单次任务；0x4046f7–0x40471b比较remaining与delta，remaining>=delta时只相减，remaining<delta才执行callback并标记删除。因此恰好5秒使remaining归0，下一次正delta才触发。队列回调重新注册任务，间隔从注册时重新开始。

角色释放入口0x488678先调用0x486c36移除同role所有持续record，再调用0x487edc清理特殊queue。0x487edc在角色及actor存在时先调用角色manager0x42a527(roleId)，随后取消role定时器；按vector顺序停止每record效果／声音、erase、free；销毁vector并free queue，再从map erase角色。0x487d9d对所有role queue执行相同定时取消与record／vector／map释放。全系统0x48860e清理持续vector并调用0x487d9d；0x488693用于结束游戏，析构0x488c38也调用0x48860e。queue消费接入需要角色复活、轮换回调、角色移除和全系统清理四个生命周期入口，以及按role命名的单次秒定时器。

`recovery/evidence/skills/skill-effect-queue-native.py`执行原复活和轮换指令，覆盖8个case（首项启动、连续轮换与回首、单项无定时器、空队列、缺角色queue）；比较attach参数、selector／offset、停止／取消顺序、定时注册参数、handle覆盖、duration与队列数量不变。另执行原0x487edc与0x487d9d，验证单角色／全量cleanup的全部3条record和queue释放、定时取消、map erase；执行原0x4046a5的4.75／0.25／0.01秒更新，验证到0与越过0的触发差异；执行原0x406154的1／2／3步输出及原活动游戏状态virtual dispatch到0x48698f，验证累计3个模拟步。输出保存在`recovery/output/skill-effect-queue-native.json`。table／role／effect／sound、容器擦除和定时注册边界由fixture供给，队列选择、调用顺序、状态覆盖、单次倒计时比较和固定步长计算执行原机器指令。

## 队列生产状态对照与调度接入

通知模块的`revive(roleId)`启动queue首条并在多条时注册5秒单次任务；`alternate(roleId,skillId)`停止匹配当前skill、选下一条（尾部回首）、取消旧计时并注册新计时。`advanceTimers(deltaSeconds)`按原scheduler使用float32输入与remaining，非正delta不推进；严格remaining<delta才轮换，恰好到0延后至下一次正delta。迭代取本次任务快照，回调创建的新任务从下次调用开始推进。缺角色／技能时保留queue并依照原函数条件继续计时。

`clearRole`先释放持续vector同role记录，再按原0x487edc查角色／actor并调用backend.resetRoleEffects，取消role任务，顺序停止／release全部queue record并删除分组。`clear`先清理持续vector，再按roleId升序释放各queue并取消任务；累计模拟步值不因清理重置，保持原0x48860e行为。backend的record.release对应记录释放，JS容器删除对应原vector／map释放。

`tests/skill-effect-queues.cts`比较同一`skill-effect-queue-native.json`的复活与连续轮换callback、handle、duration、队列数量和定时参数；比较全部三条record的角色与全量清理顺序，并按原scheduler样本推进4.75／0.25／0.01秒。单条queue不定时、缺queue复活无callback、全量清理与取消后的零callback也通过。原`tests/skill-effect-notifications.cts`的44条消息／状态样本继续通过。

现有EffectRuntime通过scene.onBeforeRender取得engine.getDeltaTime()/1000更新，可为`advanceTimers`提供实际经过秒数。Battle的50毫秒timer仅发送PlayerInput，不能作为原30Hz模拟步数。`update(simulationSteps)`需由明确的30Hz模拟时钟或相应权威步源供给；角色复活、移除、回合清理和消息入口需由Battle接入，EffectRuntime需提供对应world／attached／stop handle和声音backend。当前通知模块不创建施放授权或库存消耗。Battle已实例化`createSkillEffectNotifications`生产backend，通过RoomEvent接收原通知字段，并接入复活、角色移除、结算、再战和断线清理；实际道具授权与World通知产生仍未接通。

## 原生actor接口与生产runtime桥接

三份actor vtable的virtual+0xa8均为0x467a08（表地址0x5c8468／0x5c8688／0x5c88c8）。它将EffectN格式化为`_root\\online\\%.3d`，以原gbCrc32Compute获得definition ID；binding mode3使用EffectTagN索引global0x6d2258开始的7个字符串：0=center，1=front，2=back，3=left，4=right，5=soot，6=attack，对应`EFFECT_PRIMARY_TAGS`的完整原字符串次序。0x466676确认actor挂点map条目存在，0x46748f取共享矩阵引用，经0x47b29e启动。manager先查询可复用source对象，未命中以retain=false调用0x4795fa递归创建，插入active vector并调用root virtual+0x34 attached start。

四参数最后一项决定裁剪，未传给tree retain字段。最后参数1时0x467a38–0x467a5d调用ClipPoint；离屏且不是本机角色的actor返回0，离屏本机actor仍创建。参数0跳过裁剪。原gbGfxManager.ClipPoint（gbengine 0x10027bd0）逐六平面检查point，进入任一平面外侧或边界即返回1。世界通知0x45afc2的sourceFlag1同样在0x45b003–0x45b024裁剪，离屏时跳过世界对象分配。普通通知与持续通知都使用非retain递归树，持续record持有handle不改变原子节点自然生命周期。

原0x4791de按本地handle查active vector，找到后0x47f3c4将节点置phase3、调用end、清时间／位置／方向字段，从末子节点开始递归停止；无子节点且非retain时释放。原0x42a527先用0x464950(1)恢复actor+0x23d可见flag，再删除该角色在role manager+0x58中登记的世界名称记录。它不停止该actor所有其他特效。

`EffectRuntime.spawnAttachedEffect`按原online名称查询definition，使用TankView的稳定primaryTag矩阵引用，复用原递归tree与model／particle／sprite等已有实现。每实例返回递增本地handle，`stopEffect`查该handle并执行新增`EffectRuntimeTree.stop`／`EffectNodeLifecycle.stop`的原逆序递归结束规则，随后释放渲染资源。裁剪使用当前Web相机frustum，保留本机角色例外；world坐标反射X后作相同裁剪并按原native XYZ启动世界树。`resetRoleEffects`恢复该TankView根节点可见。load预载online根引用的已发布纹理，消息handler无额外异步资源时序。

`apps/web/src/match/skills/skill-effect-runtime.ts`的`createSkillEffectNotifications(runtime,catalog,roles)`是生产backend工厂。catalog直接提供原技能Effect／Tag／Sound，roles提供数字roleId到TankView及当前本机TankView查找；backend驱动真实world／attached tree、声音与handle停止。record.release由JS引用释放完成。调用者先await runtime.load，并在战场运行期间runtime.start；收到Play／Stop交给该通知模块，复活／移除调用revive／clearRole，结束回合调用notifications.clear和runtime.clear，实际帧秒调用advanceTimers，30Hz模拟步数调用update。工厂不触发或授予技能，不读取诊断激活入口。

`tests/skill-effect-actor-native.py`执行原0x467a08及0x47b29e，覆盖全部7挂点×普通／持续旗标、离屏非本机拒绝、本机例外、参数0不裁剪及缺挂点，共18case，记录名称、tag index、create retain=false与attached start；另执行世界离屏跳过分配、active manager handle stop、原online019全部11节点graph的22次end／release顺序与可见flag setter。table／tag map／pool／renderer start作为供给边界，原参数分支、manager创建／激活、handle查找和递归停止执行真实指令。`tests/skill-effect-runtime.cts`逐值比较actor选择结果、真实11节点create retain状态、同一矩阵引用及全部22次生产end／release顺序，执行实际生产backend的Skill12 root创建、模型mesh输出、世界坐标、handle停止和可见恢复；Babylon NullEngine及已发布资源作为供给边界。

## 技能声音桥接与浏览器验证

原声音wrapper0x485b1b将SoundN拼成`data\\sound/<SoundN>.wav`，位置来自role+0x25c。selector=1一次播放，selector=-1经0x571d76–0x571d82设置OpenAL looping。0x56fee9设置AL_POSITION为传入角色位置、AL_VELOCITY与AL_DIRECTION；通知路径二者均为`[0,0,-1]`。空间参数沿用已恢复原初始化100／2／1600及AL_LINEAR_DISTANCE_CLAMPED，master volume来自原SoundVolume。`skill-effect-actor-native.py`执行真实0x571d14、0x56fee9、0x5750cb、0x5750e8与0x575049，供给缓存／时钟／OpenAL边界，确认两个selector的loop开关、实际位置、参考距离100、rolloff2、最大距离1600、gain和source play。

新`EffectSkillSound`用原WAV、HTMLAudioElement／MediaElementSource与Web Audio声像、独立原线性衰减Gain和master Gain。selector=-1设置loop，声音位置在播放时复制角色native XYZ；listener跟随当前Web相机并反射X回native坐标。循环／停止、自然结束、runtime.clear和音量设置直接作用于音源并断开图连接。浏览器音频context挂起时丢弃新播放，通过真实键盘／指针恢复context后只播放后续通知。

`tests/browser-skill-effect.mjs`运行实际TankView／EffectRuntime／通知backend：原Skill12→online019完整11节点、center稳定挂点、原00012.cvd模型显示209个差异像素、GA35.wav一次播放；另实际GA35 selector=-1循环、原位置／线性Gain（0.7116963267，公式0.7116963538）、master音量与停止通过。持续skill8/effect100在29+1+30模拟步更新后停止；13501／13502 queue复活创建online031，在5秒恰好到0不轮换，下一0.01秒停止031并创建032；单role清理及world online004创建／停止后实例、mesh、声音、queue timer全部为0。该浏览器验证使用notification fixture，`serverSkillTriggered=false`，未验证服务器业务施放。原type5浏览器44个原生矩阵／顶点RGB样本及原online004／006 attached整树26tick继续通过。输出`skill-effect-actor-native.json`与`browser-skill-effect.json`。

## 运行限制

Battle尚未挂接真实技能通知入口、roleId映射、30Hz步源及角色生命周期。当前相机、Web equalpower声像和原OpenAL多普勒不是逐样本原实现；velocity已取证，Web Audio不提供原多普勒接口。原role manager登记的世界名称覆盖物未在当前生产场景中创建，resetRoleEffects只恢复实际存在的actor可见状态。既有原资源缺口仍包括m120 model及online126/node3093所需`lazhu.tga`；这类树不能完成原资源绘制，不替换资源。完整施放授权、库存消耗与角色数值变更由权威业务入口负责。


## Web战斗通知入口

`MsgRoomEvent`新增可选`playSkillEffect`与`stopSkillEffect`，保留原Play/Stop字段类型；TSRPC协议已重新生成。WorldEvent复用这个契约。重建服务端玩家ID为P加递增数字，客户端以该数字匹配原通知roleId；roleId0仍走原世界坐标分支。正式World当前不产生这两个字段，普通炮弹技能2001的Effect1为0，不添加假定效果。

Battle载入真实combat-catalog后创建生产桥接，按房间过滤收到的事件。角色复活启动原queue，移除前清理record，结算与再战清理持有状态，断线与退出先清理record再停止EffectRuntime。每帧将实际秒数交给原单次scheduler；BattleSkillEffects现使用SkillEffectFrameScheduler.poll(performance.now()/1000)，按已恢复原406154决策与完成时钟返回模拟步数；等待期间原queue scheduler仍按实际秒数更新。非阻塞等待与原Sleep的差异见下文连续模拟步调度合同。

`npm run test:combat:effect-battle`使用实际WsServer/WsClient传输原Play/Stop字段，验证60Hz帧输入下每秒30步、队列复活与5秒轮换、角色清理、回合清理及缺角色处理。证据battle-skill-effects.json，测试服务端明确提供通知，未计作库存授权施放或浏览器画面。`skill-effect-runtime.cts`通过同一BattleSkillEffects事件入口驱动生产online019树并验证网格、句柄和释放。`test:network`通过原房间隔离、身份、移动开火、结算再战回归。

## 连续模拟步调度与非阻塞合同

`tests/skill-effect-frame-scheduler-native.py`执行0x4060bc原构造与0x406154连续更新，供给秒时钟0x40607b和Win32 Sleep边界，原x87算术、0x57bb64整数转换、0x410c5d初始化与所有状态写回执行原指令。构造参数30得到float64 interval=1/30，maxSteps=3；不是按屏幕刷新率计算的余数积分器。

原调用开始读取now并减global0x630a60，得到上次更新完成以来的工作耗时delta。首次调用抛弃这个delta，调用0x410c5d再次读取时钟，保存内部clock起点／previous、清paused／pausedDuration，强制delta=interval并标记初始化。之后：

- delta>interval时返回`min(trunc(delta/interval)+1,3)`，不Sleep。
- delta<=interval时调用`Sleep(trunc((interval-delta)*1000))`，包括Sleep(0)，返回1。
- 两个分支都在末尾重新读取秒时钟，写global0x630a60。Sleep实际耗时／系统延迟被包含在这个完成时刻，下一次delta从完成之后开始；没有余数保存或Sleep超时补步。

0x57bb64对正／负浮点数均向零取整。实际边界：delta=0→Sleep33ms／1步，0.016→Sleep17ms／1步，delta恰好1/30→Sleep0／1步，略高于1/30→2步，恰好2/30→3步，0.1／1秒→上限3步。普通floor(delta/interval)的实现会在1/30附近与原规则不同。

统计字段也保留原行为：每调用先增加sampleCount并存inverseDelta=1/delta；检查**此前**sampleDuration>=1时，用已经增加的sampleCount除此前duration写averageRate、归零count／duration。之后将本次分支duration加入sampleDuration：Sleep分支固定加interval，追赶分支加实际delta，不乘返回步数。连续零耗时调用可产生inverseDelta=Infinity，但不影响步数／Sleep决策。初始化内部clock字段之后原406154不再更改它们。92次连续调用包含不同work耗时、模拟Sleep完成／超时、统计跨1秒与零delta；11个独立取整边界、8个正负conversion也对照通过。

`apps/web/src/match/skills/skill-effect-frame-scheduler.ts`提供两种调用方式：

```ts
const scheduler = new SkillEffectFrameScheduler();
// 每实际渲染帧，声音／queue秒计时独立推进：
notifications.advanceTimers(deltaSeconds);
const steps = scheduler.poll(performance.now() / 1000);
if (steps > 0) notifications.update(steps);
```

poll使用绝对秒时钟，不接受delta。决定需要正Sleep时保存deadline并返回0；等待中的后续帧不重复增加统计或选择步数。达到deadline后写实际本帧now为完成时刻，并返回已经选择的1步，不按晚唤醒重新选择3步；下一次poll才计算新的工作delta。delta>interval或Sleep0时立即完成并返回对应步数。`reset()`清初始化／统计／pending，相当于重构0x4060bc实例；共享completion clock保留，下次首次调用按原规则直接返回1。可注入同一`SkillEffectFrameClock`对象模拟global0x630a60跨实例共享；默认各Web调度实例拥有其completion状态。

`begin(now,resetClockNow)`与`complete(completionNow)`暴露原分阶段合同，first内部reset读值可独立提供；用于明确安排异步delay的调用者先begin、等待返回sleepMs后complete，再派发已选steps。begin／complete逐值比较92次原生决策和全部时钟／统计状态，包括first两次不同读取值，`tests/skill-effect-frame-scheduler.cts`通过；poll同时验证deadline前零步、晚完成仍单步、随后3步追赶、reset取消pending及共享全局completion。

非阻塞poll与原阻塞Sleep的差异明确如下：Web等待期间继续渲染与独立queue实际秒计时，直到后续渲染帧达到deadline才完成等待，实际唤醒精度由浏览器frame cadence决定；Sleep0没有对应操作系统yield。poll把本次开始／首次内部reset／完成的同步读取折叠为传入now，分阶段API则可以提供分别的时间。原阻塞主循环与操作系统调度未在Web复刻，poll的整数决策与状态算法保持原规则。queue的实际秒timer继续独立每帧推进，不应只在poll返回步数时调用。
