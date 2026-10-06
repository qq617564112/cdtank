# 普通2001即时显示、玩家结果与飞行来源边界

地图0007、默认普通炮弹2001按已确认的即时目标查询、显示和结果分派交付。正式默认2001在接受开火时立即查询目标并处理命中，不创建延迟bullet；双连接证据见ordinary2001-immediate-accepted.json。独立可见飞行实体的原创建与更新来源仍缺，不能由其他弹药的重建弹丸快照选择2001外观，也不作为即时基础链交付前置。

## 已确认合同

| 环节 | 原来源与正式消费者 | 状态 |
| --- | --- | --- |
| 开火动作和炮口 | BeforeShot422f25→42282e→464e53→03；ELK004/tag_efattack；BattlePlayers.fire→TankView→EffectRuntime | 原来源、正式消费者和普通双端实战已通过 |
| 开火声音 | Shot423092→owner+8c→49f571→4cefc9，普通2001选择GA07，位置来自role+310 actor virtual+1c | 原绑定末端及实际双端声音已通过 |
| 即时射击端点显示 | Shot4245c9→423956→489ba8；2001第二技能4020的007/SE30，按PLAYER/SCENE/FREE原分派 | 正式消费者已通过；显示发生在射击处理时，不能转作飞行或命中 |
| 飞行创建与更新 | 尚未取得独立飞行实体的创建、资源选择、挂点和更新入口 | 缺关键原生产来源，没有可据来源实现的FlightView |
| 自然命中与受击 | 现权威hit.hurtSelector→原方向分类/05–08；BattlePlayers.hurt→TankView | 普通双端原动作已通过，原ELK缺受击绑定保持静默 |
| 玩家命中结果 | ShotPlayer3aa3→424614→4886aa；攻击者当前弹药2001的TriggerType8/4020；受害者tag0挂点007、role+25c空间SE30 | 原入口及12组原执行通过，正式hit消费者已接线 |

现有source入口：`projectile-sol-shot-native.json`、`projectile-actor-binding-sol-native.json`、`projectile-flight-boundary-source.json`。本次不重复这些已通过执行。

## 当前固定地图0002的基础链

来源与消费者复用上述2001合同；地图0007已接受的独立炮口、角色结果和场景结果实战不改写为地图0002同局证据。

| 玩家流程 | 来源与模块 | 普通实战与双端范围 |
| --- | --- | --- |
| 正常开火、炮口004与GA07 | 已恢复，见`combat-muzzle-2001.md` | 地图0007双端原节点/声音到期与Leave已验；地图0002不开新的炮口专项 |
| 即时007/SE30与本机／远端资格 | 已恢复，见`combat-shot-item-result.md`、`combat-shot-player-result.md` | 原独立结果实战直接复用；地图0002 source126的远端结果实例未观测，不能将可能的视野裁剪推定为生产缺失 |
| 场景受损／破坏与具名原声 | Castle、60个Breach状态消费者已接 | 地图0002五类Breach普通代表及Castle304组合范围已接受；Castle305首验17-20-36记录双端c2/n2/c3实际绘制、主端可辨破坏及非零声音、双Leave0，客端可辨与可听范围未证明 |
| 角色受击、Damage及Benefit | 已接正式hit／HPsnapshot消费者 | 原独立普通实战和浮字实际证据复用，不用Castle事务代替角色事件 |
| Plant327接触隐藏及再战恢复 | 接触来源、正式hidden快照与reconcilePlants消费者已恢复 | 普通接触已有双端隐藏／主端停止绘制证据；18-09-00新实战接受双端新round状态恢复与客端4次实绘，主端恢复实绘0保持缺口 |
| 结束、再战、离房与重入 | 正式owner生命周期已接 | `map02-full-session-root-review.json`接受两自然300秒局、1670共同tick一致、正常R6→R7重入及两次双端Leave资源0；Plant327本次未隐藏，不证明hidden→visible恢复 |
| 活跃对局短暂断线后恢复原房 | 同账户30秒角色保留、输入释放、重新认证与resume为明确Web重建接口，原服务端规则未恢复 | 网络18-50-37记录同R6/P1/round1恢复、17共同玩家状态与真实30031ms超时移除；网页18-55-30记录自动恢复、26共同完整状态、双端原scene／资源／四BG音源续用及正常Leave清零，不与新房重入合并 |

Castle305新的普通受损／破坏实际覆盖见`scene-castle02-presentation.md`；该首验不重复304或原来源。`map02-mode2-full-session-root-review.json`另接受模式2有限普通两局／重入：17-29-59记录两自然OBJECTIVE结算、270共同tick全部一致、背景音同场景续播与两次Leave旧四音源暂停、重入revision3新加载及双端owner清零。原17-26-08驱动失败保留；66914实际exit0与端口清理由主线确认。截图阶段标签不保证截图时仍PLAYING，不把3840客端结果页算战斗画面。模式2没有扩大仅模式1的ENV破坏权限。

`map02-mode3-normal-lifecycle-root-review.json`接受模式3的1920×1080普通入场、输入、离房与新房重入尾段：17-55-21记录42共同tick全部一致，R6→R7，两次双端正常Leave后owner资源0、world null及输入停止；四个旧BG音源均暂停，重入revision3重新加载。71174实际exit0与3595/5625/9825端口清理由主线确认。该尾段没有两自然局、植物hidden→visible恢复或新截图范围。原模式3失败与`map02-mode3-directed-root-review.json`保留；38秒4K停顿、双端1006断联和软件性能仍为独立缺口，正常尾段没有连接关闭记录。

地图0002整图、模式3完整渲染流程、软件渲染流畅性及原GPU像素等价仍未完成；模式2与模式3正常生命周期仅接受上述有限范围。详见`map02-restoration-status.md`。独立飞行来源不阻塞已确认的即时链。

`map02-plant-round-reset-root-review.json`接受Plant327普通NAV接触隐藏后的正常再战恢复有限范围：18-09-00记录自然mode2 OBJECTIVE终局44555ms、191共同tick全部一致，正常Rematch后双端在同scene revision1／29owners下由round1 hidden=true／root=false恢复为round2 hidden=false／root=true。客端原327网格在frame320–323实际绘制4次，主端恢复后绘制0；原raw INCOMPLETE及主端缺口保留，没有独立恢复像素范围。双端正常Leave后角色、植物、效果、声音资源清零、world null、输入停止，旧四BG音源均暂停。66822实际exit0与3595/5625/9825端口清理由主线确认；进程清理记录serverExit1、Chrome0及临时目录移除。来源与消费者复用既有合同，此次不新增声音或高清性能验收。

`browser-map02-active-reconnect-2026-10-05T18-55-30-389Z.json`记录固定地图02／模式1双React正常Create／Join／Ready后的短暂断线自动恢复，预房tank1／pet1拥有夹具明确。主端断线时输入timer停止；恢复同房、同玩家、同round，普通W输入可继续移动，26共同完整玩家及match状态一致。双端Battle、scene、Preview、Plant、water与sound对象身份不变，revision保持1；29植物owner、2水容器及四BG音源各自续用原引用，每页仅一次soundLoad。正常Leave后双端角色、场景物件、植物root／ledger、效果与声音计数0，water／Plant资源释放，world null且输入停止，旧318／319／338／339音源全部paused。该范围没有新截图、音峰、高清性能或隐藏植物恢复验收；两份断线前驱动FAIL保留，raw清理记录serverExit1、Chrome0与临时目录移除。网络30秒超时范围见`room-reconnect-network-root-review.json`；本网页范围不证明原服务端重连政策。

主线有限接受范围见`room-reconnect-root-review.json`，工程见`room-reconnect-engineering.json`；browser runner70569实际exit0，主线确认3604／5634／9834为空。断线期间遗漏的瞬时事件不回放，服务重启不保留临时房间；这两项不由同场景owner续用实证关闭。

## 唯一飞行来源缺口

原actor完成入口4647df读取actor+2a0。有观察者时，把actor+298保存的角色ID送入观察者virtual+8，然后清零ID。构造4686e6清零观察者，析构4683d3–4683e6通过virtual+4释放。该字段是可选完成观察者，其安装来源及末端业务尚未确认；它不是已经证明的玩家结果入口，也不是即时结果交付的前置条件。独立飞行实体创建与更新入口仍未确认。角色ID、角色位置WAV和绘制记录时间均没有建立飞行实体语义。

本次限定检查原EXE的Bullet/Missile/Projectile/Shell/Shoot/Shot业务字符串与两个具体xref：`SYcSkillSystem::ShowShotEffect`在489cd5是既有489ba8内部诊断；`PlayerShotEvent`在5bdc16是identifier注册。两者未提供独立实体创建或更新入口。没有根据字符串缺失宣称原版没有飞行表现。

玩家结果消费者合同见`combat-shot-player-result.md`。客户端原即时目标选择/显示来源与服务端目标几何、伤害权威重建规则分别记录。当前默认2001权威按普通输入即时fire→hit处理，网络实际证明双端有序通知、共享生命、bullets始终0与自然死亡/复活/Leave；证据见ordinary2001-immediate-network.md。独立飞行消费者仍需实际资源、创建坐标、更新与终止来源。

## 原Shot末端定位

本地4288fe/428a55与远端4245c9都转入423956；wrapper在42397b调用489ba8。489ba8的两处世界显示调用489d15/489ded均进入45afc2，参数是目标XYZ和裁剪flag1。声音调用489e15进入4858f2，参数为名称和enabled1，没有声音位置。Shot随后由423092的owner+8c回调进入49f571/4cefc9，再经485b1b播放actor位置GA07。这些定位可供数值取证线区分客户端即时显示与权威弹丸。

普通004根2429有两精灵和三粒子；007根2432有三精灵、一粒子及条带2448，没有type2光束节点或模型节点。004精灵的trailEnabled与007条带已有正式源消费者；它们分别属于炮口挂点树和目标点树，已知显示接口没有起点/终点对、速度或飞行时长参数，不能据“轨迹”或“条带”名称重新解释为两点间飞行。

## 原程序实机入口

当前环境没有Wine执行器；所提供目录为原Windows客户端及资产，尚无已知可以进入原服务器房间并正常开火的可运行入口。因此本轮没有原程序普通2001开火画面，不能用实机画面确定其是否存在可见飞行。独立飞行表现缺口保持开放，不据此要求新FlightView或阻塞已确认的2001即时链。全部原射击规则与表现父项仍未完成；已接受的炮口、即时显示、玩家/场景结果和清理证据按ordinary2001-immediate-accepted.json各自范围复用。
