# 特殊弹选中时的统一弹匣复活

`tests/tank-ammo-special-respawn-network.cts` 核对当前正式服务的特殊弹选中→自然死亡→复活默认弹药重算链。使用3587编译发布服务与两条普通WebSocket连接；不涉及网页或GPU。

## 输入与依据

同库角色上下文来自 `tank-purchased-trap-restraint-network-2026-10-05T01-37-14-377Z-checkpoint.sqlite`，保留两账户实际BUY3/pet2和选择记录。隔离副本上正常BUY2011×1、Kitbag槽1配置，没有新增拥有夹具或活跃状态注入。私有身份文件仅用于本地Account恢复，不进入证据输出。

弹药oracle读取当前实际owned tank的部件字段与原表2001/2011技能，复用 `recomputeRoleAmmo` 的选择、限幅和单位转换。没有以所选宠物替代未知boundGear。普通伤害和复活默认配给沿现有明示重建权威；本片不证明原伤害、购入初值或原服务器配给规则。

## 验收合同

普通2001自然射击预伤后，目标先射一发普通弹形成部分弹匣和非零装填记录，再选中未发射的2011。普通对手自然击毁目标；自然复活应确认2001/槽1、按统一公式重算并填普通容量、清零旧装填记录、恢复实际pet生命上限。新普通输入射击应扣一发并使用普通原间隔；2011库存仍为1且没有2011发射或消费事件。

仪器保存完整双端快照、接收墙钟、服务器时间、模拟tick、递增输入、购入/配置/API库存和双round1 Leave回执。共同快照按room/round/phase/tick比对完整players，关键fire/ammoConsumed/destroy/respawn比对指定目标事件。

旧 `ammo-ai-network-2026-10-04T10-16-33-842Z.json` 的2011死亡回槽证据早于统一弹匣，reload为重建800ms且没有ammoMagazine；它只提供旧回槽范围。本片需当前服务实证才能登记统一重算完成。

## 当前实际结果

`tank-ammo-special-respawn-network-2026-10-05T15-37-33-224Z.json` 为有限PASS：普通自然预伤700→25，tick628普通弹7→6/原1.5秒，tick629选2011余1，tick657自然死亡仍2011。tick717自然复活回2001/7发/HP700，startedAt与duration均0；tick718新普通发射后6/7，duration1.5。Inventory回执2011 owned/battle均1，没有特殊发射或消费。

自然复活间隔分别为3.0模拟秒、3.017服务器秒、3.030接收墙钟秒。718共同快照键均唯一且完整players一致，20指定核心事件双同；两条round1 Leave成功，3587服务正常停止且监听为空。严格类型检查通过。封装索引为 `tank-ammo-special-respawn-player-evidence.json`，独立主审见 `tank-ammo-special-respawn-root-review.json`，有限接受状态为 `PASS_FINITE_SPECIAL_AMMO_DEATH_RESPAWN_COMPUTED_MAGAZINE_DUAL_NETWORK_SCOPE`。

## 未覆盖范围

快照没有array4技能槽投影，因此本片证明容量、间隔及普通射击的正式消费者，不能直接证明全部安装技能。旧普通装填期限在复活前已过，本片确认记录重置，不证明仍活跃期限的提前取消。原伤害/服务端配给、全部车型/装备与持久重启范围保持原索引。
