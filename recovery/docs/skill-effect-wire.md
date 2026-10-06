# 技能效果消息包体与源目录

独立取证recovery/evidence/skills/skill-effect-wire.ts恢复原Play4170（132位）及Stop4171（48位）编解码，契约依据skill-effect-message.md。Play字段是skillId16、effectIndex4、duration16、roleId32、xBits32、zBits32；Stop只传skillId16/roleId32。位置字段保留float原位值。消息类型在外层路由，不混入包体。

`npm run test:combat:effect-messages`先执行独立原Play/Stop listener/typegetter、packet writer/reader与位流，再对照独立取证codec。16个原样本覆盖全部8位偏移，字节与解码值一致；原fixture同时执行普通/世界/持续分支、去重、缺角色/actor返回、Stop全匹配和整数倒计数到期。字段宽度截断沿原位流，不把4位effectIndex扩成字节。

`npm run assets:combat`从原skill.dat/item.dat导出web-assets/combat-catalog.json，纳入完整assets命令。共享catalog.ts定义技能及道具元数据，兼容已有RoleSkillRecord。342技能包含三槽effectId/sound/tag/method及三组Func参数；204道具包含原ItemType、BattleUseMax与三技能绑定。EffectTag和EffectMethod保持独立，通知handler使用tag，不把method当挂点。

Skill12「扫光光（扫把）」为Effect19/SoundGA35/tag0/method3；默认物件2001的技能绑定是2001/4020/0，BattleUseMax255。源目录道具3006「精品饲料罐头」引用技能4027，但当前342条skill.dat没有4027，目录保留原引用，不能填造定义。

目录是原表元数据，不授予账户库存、默认装备或施放权限。原消息codec不单独证明已上线施放。通知运行状态（持久白名单、三元组去重、特殊队列、Stop全槽匹配及原整数计时）已有生产match/skills实现；真实治疗Effect11/GA15已经连接EffectRuntime、服务端消费和CPU普通输入。其他完整原技能施放仍按tasklist逐项恢复。

## E-04 协议与取证职责

PlaySkillEffectMessage/StopSkillEffectMessage是生产两端共同消息，归shared/protocols/MsgRoomEvent.ts；该文件不依赖原包codec。服务端battle/healing构造权威playSkillEffect，客户端match/skills的battle-skill-effects与skill-effect-notifications仅importtype协议类型。原消息常量和四codec函数只供原程序对照，归evidence/skills；旧shared入口删除，没有副本。

两个原native（消息与队列）及wireCTS已迁到同一evidence/skills目录，native ROOT按新目录解析，oracle输出路径保持；其他CTS验证实际生产通知/队列/运行时和Battle消费，仍在tests。test:combat:effect-messages命令改用新入口，生产不执行native或原包codec。

生成协议版本24→25，仅Play/Stop类型定义key及引用重命名为MsgRoomEvent内的类型；服务/字段/union编号、字段类型和可选性一致。17组RoomEvent涵盖缺省、角色0/1/uint32最大值、effectIndex0/1/2/15、原float位型、Play/Stop及与item request同包，旧新字节一致且双向decode保持相同值。证据：engineering-skill-contract-proto-before.json、engineering-skill-contract-wire-check.mjs、engineering-skill-contract-wire.json/log。

原16个Play/Stop位对齐包、9通知序列/44状态、原队列与清理、18原actor及生产根/mesh/handle、TSRPC Play/Stop/复活/角色移除/局号清理CTS通过（engineering-skill-contract-evidence.log）。全仓类型与219正式可达模块边界通过（engineering-skill-contract-types.log、engineering-skill-contract-boundaries.log）。

实际治疗双连接联机/消费/重启隔离、独立两端构建、306发行JS/map排除codec及保留生产schema引用、编译账户保存/五模式各两局通过（engineering-skill-contract-{healing-network,server-build,web-build,artifacts,compiled}.log）。双网页AI自然两局86458/81086ms、原Effect11/GA15/拥有迷彩、双方退出instances/voices归零、重启库存快捷槽与控制恢复通过；独立证据为engineering-skill-contract-two-rounds.log、engineering-skill-contract-browser.log及engineering-skill-contract-browser.json。全部本片检查退出0，临时服务/Vite/Chromium已关闭。此片保持既有真实技能消息链；不代表342技能全部原施放权限/效果已经恢复，也不代表原服务器协议已重建。
