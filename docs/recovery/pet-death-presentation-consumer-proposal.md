# 普通宠物类别死亡精灵

M2-05/M4-09已接受的原423157死亡后续分支提供尚未接入的119/120反馈。玩家普通射击使角色死亡后，原PetTable+2c类别1/2分别将119/120以binding3、tag0、oneShot1送入actor virtual+a8。两类均没有外层声音调用；原树也没有Type4声音，保持该表现静默。

| 层次 | 范围 |
| --- | --- |
| 来源已恢复 | 既有respawn-followup-sol-native.json完整72原分支复用；pet-death-presentation-source.json组合具名actor槽、两树及原纹理 |
| 模块已准备 | 独立TankPetDeathPresentation，专属CTS验证类别、target/local引用、tag0/oneShot1及其他类别静默 |
| 正式接线 | 主线已接snapshot.petId查原PetTable.PetType及sameactor alive true→false一次调用；snapshot CTS32679实际exit0 |
| 普通实战/双端呈现 | 主线唯一session83614实际exit0；dog120双端真实绘制、自然到期及双正常Leave成立 |

## 来源合同

原角色三/四部件vtable5c8688、5c88c8的+a8均为467a08；binding3、tag0、oneShot1直接复用现EffectRuntime.spawnAttachedEffect(view,effectId,0,true,localView)。本机身份与原远端视锥资格由该已接受消费者处理，不复制actor或目标查询。

119原根3027包含container3028及唯一sprite3045；其原纹理data/effect/xy/catd.tga已发布Data/effect/xy/catd.png。120原根3029/container3030/唯一sprite3031使用dogd.tga与dogd.png。两sprite原controller start2/end5、scale22/24/22、起始offsetY10、速度Y45、alpha0.85及扣率0.45。原父挂点实时引用、controller时序、实际绘制和自然生命周期由既有runtime消费。这不是缺失m120模型引用，也不是105死亡006/GA12。

pet-death-presentation-source.json仅组合已有完整native与新的具名静态路径/资源，未重新运行72分支、09模型、HP setter或已有sprite oracle。PetTable中的PetType来自字段，不能按petId编号段猜猫狗。

## 文件与正式接口

FX拥有新apps/web/src/assets/tanks/tank-pet-death-presentation.ts、专属CTS/source/browser及本文；主线拥有BattlePlayers/Battle、静态CombatCatalog.petTypes十记录、原表发布hook和共享生命周期。

API为new TankPetDeathPresentation(runtime)，runtime只需spawnAttachedEffect；show(view,petType,localView?)返回实际handle。类别1/2映射119/120，其余返回0。模块不管理HP、死亡规则、复活期限、角色身份缓存或独立声音，也不持有另一个效果生命周期。正式owner在loaded actor的alive true→false时调用一次，首次dead或重复snapshot不重播；round/remove/Leave沿已有owner清理。

## 首次普通玩家范围

browser-tank-pet-death-presentation.mjs使用端口3578/5608/9808，主线持有唯一启动。预房明确原tank1/pet1记录与四正常认证玩家，合法map7/mode4 Ready；host正常Arrow/Space至guest自然死亡。已存在的09动画、HP和复活规则证据直接复用，只记录新PetType2/dog120资格、真实sprite3031及原dogd纹理、原树静默、自然到期、callback canvas及双正常Leave资源0。

只读observer关联reconcile调用前sameactor alive/current petId→新模块show→实际instance handle→node draw。原119/cat分支本轮只有source/module范围，不能借dog120普通实战关闭其可见像素或全父项。短帧/裁剪的图像缺口单列，正常Leave仍完成；不注入活跃状态、clock、damage或结果，不重验旧09/声音。主线已完成正式接线、统一Webbuild62386（含Webtype）actualexit0/1m45及releasecopy20779；FX仅封离线证据。

## 有限实战终态

原始证据browser-tank-pet-death-presentation-2026-10-05T14-27-39-729Z.json为PASS_FINITE_PET_DEATH_SPRITE_NORMAL_LEAVE；一次离线封装tank-pet-death-presentation-actual.json为PASS_FINITE_ORDINARY_PET_DEATH_DOG120_DUAL_LEAVE。root review tank-pet-death-presentation-root-review.json为PASS_FINITE_PET_TYPE2_DEATH_EVENT_DRAW_EXPIRY_DUAL_LEAVE_SCOPE。

双端同角色petId1查原表PetType2、alive true→false各调用120一次，handle20/tag0/oneShot及实时父挂点引用成立；原3031/dogd实际draw分别9/22次、无声音节点、自然到期。双正式Leave后worldnull、effects/petMeshes/voices0，进程清理PASS及3578/5608/9808三空。

亲看五张完整640 callback canvas，guest middle（2.5406s）淡白描边ghostdog可辨。host两帧及guest first/late不支持独立可辨精灵像素；host没有late callback。Cat119本轮只有source/module；首次dead、重复snapshot、未知类别和round/remove静默为专属gate/code范围。

工程pet-death-part-product-engineering.json：统一Webbuild62386含Webtype实际exit0/1m45，releasecopy20779实际0，index时间2026-10-05T14:27:08.493810948Z；snapshot gate32679实际0。子范围接受，不关闭父项。
