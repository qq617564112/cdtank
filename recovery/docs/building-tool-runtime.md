# M4-10-I502 建筑工具运行时

正式模块 `apps/server/src/battle/items/building-tool.ts` 提供
`applyBuildingTool(room, player, request, consumeItem, events)`。已有账户显式拥有的物件 502
经普通 `useItem` 实例请求使用，持久数量 CAS 成功后消费一份账户库存和本局数量，恢复一座我方
碉堡的生命值。

## 来源

目录物件 502“建筑工具”说明“回复碉堡生命值1000点。”、`battleUseMax2`、技能列表
`[502,0,0]`、ItemMoney/ItemCoin 均为 0、GGet 为 0。技能 502 说明“回复碉堡生命值5000点。”、
Target1、TriggerType1、Range0、首函数 FuncType18（t0/x2/y5000/z0）、首效果 Effect12/SE13/
Tag0/Method3。ItemInfo1000 与 skillInfo/FuncY5000 冲突；模块以 FuncY5000 为准并夹到城堡上限，
差异在此记录。零价与 GGet0 不授权商城购买或免费发放，本模块只消费已有归属。

## 目标身份与资格

目标来自当前 `room.sceneObjects` 中 id 为 `CASTLE:` 前缀、`sourcePlacementId`/`sourceModel` 与
实际 `getSceneCastles(mapId)` 的 `SYcCastle` 记录一致的条目。`getSceneCastles` 通过 CAS 尾偏移 4
公开源 HP，通过尾偏移 8 公开源归属。`+e4` 与取值 1/2 是事实；1→team0、2→team1 是采用的
重建策略。team 只能为 0 或 1。

仅在 mode1、角色存活且 status2、源归属等于 `player.team+1` 时选择。目标必须 `hp>0` 且 `hp<maxHp`。
源 Target1/Range0 与无目标负载说明这是自用逻辑基站，不引入目标负载或距离判定。按源顺序选择
第一座合格的我方 Castle。当前已装配 mode1 Castle 的地图为 2/5/6/10/11；不新增地图授权。

错误 mode、无合格我方 Castle、满血或 `hp<=0` 均以 `itemRejected` 拒绝且不消费。不复活、
不攻击目标、不触达 Breach 或模式目标。

## 恢复与消费

`restored = min(skill.functions[0].y, maxHp - hp)`，并要求正的有限恢复量。成功先经既有
`consumeItem` 回调完成持久 CAS，再改变本局数量与目标 HP；回调返回 false 或抛异常时保留全部状态
并发送 `itemRejected`。成功一次性扣减 `ownedQuantity`/`battleQuantity` 各 1，增加目标 `hp`，
保留无关状态。

成功事件：`itemUsed`，skill502、actual restore、目标 castle id、施法者位置及
`playSkillEffect {skillId:502,effectIndex:0,duration:0,roleId:Number(player.id.slice(1)),xBits:0,zBits:0}`。
Target1 将原 Effect12/SE13 映射到施法者，无额外声音/效果。随后发送 `sceneObjectHealed`，
携带 `castleDamage {castleId:sourcePlacementId,currentHP,maxHP,delta:-restored}` 与目标实际位置；
根集成把 healed 事件路由给 Castle 消费者。复用现有 wire 字段。

## CPU 策略

`apps/server/src/battle/cpu/building-tool.ts` 的 `buildingToolHotkey(catalog, inventory, actor, room)`
仅在配置了有限 item502 快捷槽 5..8、角色存活且 status2、库存 owned/battle 均 >0，且存在损坏的
存活实际我方 Castle 时返回该槽，否则返回 0。策略只产生普通输入，不直接写状态；根把该函数加入
controller/CPU 白名单与配置（item502 槽 5..8、上限 2）。

## 未执行验收

实际场景身份/CAS/效果与 CPU 自主使用的运行、网络、双网页及重启验收尚未执行。
