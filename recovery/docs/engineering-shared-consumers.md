# Shared实际生产消费者

按apps/server/src/index.ts与apps/web/src/main.ts追踪生产依赖，并检查TypeScript编译后值依赖。测试消费者不计作双端执行；类型依赖仍需保留为协议或共同规则契约。

| 边界 | 当前模块 | 消费者与整理方向 |
|---|---|---|
| 双端执行规则 | inventory-query、item-hotkeys、role-owned-textures | server账户/背包/房间快照与web我的家均执行，保留shared唯一实现 |
| 共同纯契约 | catalog | 两端目录/账户/对局/通知共同类型，保留shared |
| 客户端专有已迁移 | apps/web/src/assets/tanks/role-ammo-visual | TankView与EffectRuntime执行，shared旧入口删除；原视觉/物品规则与生产战车/效果/自然两局、服务端发行移除验收见engineering-tank-actions.md |
| 服务端道具输入已迁移 | apps/server/src/battle/items/{item-request-dispatch,item-use,role-ammo-request,inventory} | accept-input实际消费；ItemUseRequest归shared/protocols/MsgRoomEvent，KitbagInventory只有server与证据消费者，归server唯一实现 |
| 服务端背包配置已迁移 | server/accounts/kitbag-configuration、battle/items/kitbag-confirmation | AccountStore请求与持久化、World/preparation角色确认；内部类型归server，真正双端PtlKitbag协议不变 |
| 服务端角色生命周期已迁移 | server/battle/roles combat-state、record-defaults、reload、free-aim；evidence/roles仅取证numeric/observer/codec | create-player→actors定时/普通开火→deadline/瞄准真实链；property-dirty实际mark归server，剩余原helper已归evidence，逐片验收engineering-role-lifecycle.md |
| 完整属性计算与发布已迁移 | server/battle/roles attribute-state/recompute及base/skill/limits/mastery/readiness、skills/data-scale/movement-setter | 准备/开局/目录限值和对局投影真实链，shared/contracts基表及技能目录唯一纯type；逐片验收engineering-attribute-chain.md |
| 正式角色表加载已分离 | server/config/role-base；shared/contracts/role-base纯类型；evidence/roles native/CTS | config实际载入TANKS/PET_BASES，owned定义到完整属性消费；原/正式加载同验，见engineering-role-base-loading.md |
| 技能消息契约已分离 | shared/protocols/MsgRoomEvent的Play/Stop；evidence/skills原codec/native | server/healing与web/match/skills只消费消息契约，原codec不进入发行；逐片验收见skill-effect-wire.md |
| 库存共同契约已分离 | PtlInventory.InventoryWireRecord；evidence/inventory原codec/native/CTS | server账户/对局及共同规则、web账户协议使用唯一类型；原record/query/deletion仅验证，逐片验收见inventory-wire.md |
| 来源组装已迁移 | accounts/owned/source-selection；battle/roles part-definitions、skill-sources | AccountStore选择→preparation装备部件→attributes重算与projection实际执行；原selector native/CTS归evidence，集成验收见engineering-role-source-assembly.md |
| 拥有定义解析已迁移 | server/accounts/owned/definition；evidence/roles native/CTS | account battle-binding与BattleRoleSources真实执行；只消费shared唯一记录type，逐片验收见engineering-owned-definition.md |
| 拥有基础记录已分离 | shared/contracts/owned-base纯类型；evidence/roles五原函数/native/CTS | 正式账户/服务端计算只消费type，record/batch/MaxHP getter均无runtime值consumer；逐片验收见engineering-owned-base-boundary.md |
| 拥有装备记录已分离 | shared/contracts/owned-equipment纯类型；evidence/roles record/packet/batch | 真实账户/共同纹理规则及服务端计算只消费type，原decoder只验证，逐片验收见engineering-owned-equipment-boundary.md |
| 拥有来源接收已分离 | server/accounts/owned/receive-pair；evidence/roles原pair/batch消息解码 | 实际BattleRoleSources执行receiver；所有CTS/网络/browser seed消费evidence decoder，逐片验收见engineering-owned-receive-boundary.md |
| 已选角色读取已分离 | server/accounts/profile/selection；evidence/roles setter及tank/pet请求 | actual AccountStore只执行reader，真实跨端协议不变；逐片证据见engineering-role-selection-boundary.md |
| 装备请求所有权已迁移 | server/accounts/equipment request/unload/slot-count；evidence/roles error/native/CTS | 实际AccountStore执行内部契约与规则；PtlEquipment不变，逐片验收见engineering-equipment-boundary.md |
| Profile内部与取证已分离 | server/accounts/profile/{payload,equipment,cosmetics}；evidence/roles确认/更新/wire | 内部Uint8Array仅server实际消费，跨端number[]协议不变；逐片集成证据见engineering-profile-boundary.md |
| 原背包配置取证已迁移 | recovery/evidence/inventory/kitbag-configuration-{wire,native,cts} | 原codec仅CTS执行；native/CTS/实际账户与World规则通过，集成证据见kitbag-configuration.md |
| 库存删除取证已迁移 | recovery/evidence/inventory/inventory-notifications | applyKitbagDeletion仅2个CTS使用；依赖server拥有的KitbagInventory type，不进入正式服务与网页发行 |
| 迷彩更换确认边界已分离 | shared/contracts/tank-textures；server/accounts/tank-texture-change；evidence/tank-textures原codec | 共同确认协议、实际事务资格费用/确认与原reader/writer分三owner，Shared OwnedTankTextures双端规则保持；集成证据见engineering-texture-change-boundary.md |

原消息/注册/路由/创建/回收/数组/生命/道具包体/死亡/射击/履带helper已按真实消费者迁recovery/evidence/combat；property-dirty实际mark归server，扫描与字节比较归evidence。正式shared/combat只保留上述四共同模块，专题验收见engineering-e04-evidence.md。

## 当前真实业务切片

服务端item request已经拆分实际所有权：ItemUseRequest在shared/protocols/MsgRoomEvent，服务端通知直接消费；三执行规则归server/battle/items，accept-input真实导入；KitbagInventory唯一类型归server，原applyKitbagDeletion只供CTS验证，归evidence/inventory。原函数体不变且旧文件删除。验收与结果见engineering-item-input.md；协议兼容检查、普通输入/消费/保存及自然两局均按tasklist登记条件执行。

MsgRoomEvent的类型边引用ItemUseRequest，会令原始TS依赖图把item-request-dispatch→item-use→role-state标成双端。浏览器不执行该链，迁移应按真实执行所有权，同时保持必要契约类型。

本页按真实消费者记录唯一所有者，各迁移均有相应业务验收。E-04已完成工程边界审查与逐片回归。库存记录、profile内部及装备请求切片已完成集成验收，专题分别为inventory-wire.md、engineering-profile-boundary.md及engineering-equipment-boundary.md；已选角色读取切片原对照/账户/网页/独立发行/编译服务与自然两局释放重启验收均通过（engineering-role-selection-boundary.md）。拥有来源接收片已经完成集成验收（engineering-owned-receive-boundary.md）；按真实值消费者分离：receiveRoleOwnedPair与RoleOwnedSources仅正式server的BattleRoleSources执行；pair/batch原解码只供CTS、网络和浏览器显式seed取证，迁evidence需同步全部消费者。内部Map记录由shared/contracts唯一提供，服务端计算/定义与共同纹理规则消费纯type，无shared反向server依赖；真正PtlOwnedRoles数组协议不变。底层owned装备记录已按真实消费者拆纯类型与仅取证解码，原/业务/网页/独立发行/编译保存和双网页自然两局清理重启全部通过；专题见engineering-owned-equipment-boundary.md。基础记录片已完成相同边界：唯一纯类型归shared/contracts，五原取证函数及native/CTS归evidence，真实skill-source/recompute不变；原依赖、来源重算、两端发行、联机保存与双网页自然两局102024/68440ms及清理重启通过，见engineering-owned-base-boundary.md。owned定义切片已完成accounts/owned/definition实际所有权，贯穿账户选车→入场绑定→BattleRoleSources；保留唯一记录契约。1984原解析/112迷彩来源与账户profile/210入场绑定/完整重算、两端发行/编译联机保存、正常选择页面及双网页自然两局40111/95482ms/清理重启通过（engineering-owned-definition.md）。来源组装切片也已完成：账户阶段来源选择归accounts/owned，准备部件与属性/投影技能来源归battle/roles，原/业务/两端发行/编译保存和双网页自然两局77107/89291ms/清理重启通过（engineering-role-source-assembly.md）。正式角色表加载也已完成：config执行唯一server加载函数，共同定义契约与原native/CTS分离，21车/10宠物原表及实载、完整属性/发行/联机保存与双网页自然两局35684/70891ms清理重启通过（engineering-role-base-loading.md）。迷彩确认也已完成三方边界及原门槛/协议兼容/真实事务/正常付费页面/联机保存/自然两局90354/116118ms清理重启（engineering-texture-change-boundary.md）。准备/开局完整属性计算与发布已完成十模块真实职责及唯一共同type边界，七组原native/CTS和真实World/账户来源、两端发行/联机保存/双网页自然两局99478/77026ms清理重启通过（engineering-attribute-chain.md）。角色生命周期与普通射击截止时间也已按四正式owner和numeric/通知/wire取证分离，11原专题/真实World/发行/联机保存及双网页自然两局38026/102171ms清理重启通过（engineering-role-lifecycle.md）。property-dirty及剩余原helper已完成唯一server mark/evidence边界，完整原消息链、正式属性/发行/保存及双网页自然两局49317/81064ms清理重启通过（engineering-e04-evidence.md）。最终shared只含共同四模块、contracts和protocols；E-04工程边界已完成，M2–M8完整恢复仍逐项验收。
