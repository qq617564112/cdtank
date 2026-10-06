# 普通空弹匣重算与补弹期限合同

状态：prepared，尚未执行联机。固定 Map02 整图验收优先，当前不占服务窗口。本合同不新增生产规则，不作为已接受业务范围。

## 目标消费者

`applySpeedDrink` 成功消费后调用 `recomputeBattleAttributes`，其普通弹药路径调用 `initializeDefaultAmmoMagazine`。当前实现保留已初始化的普通剩余量，只有首次初始化或容量收窄才写弹量；末发保存的 `refillAt` 由 `advanceDefaultAmmoMagazine` 到期恢复计算容量。

已接受饮料作用与 deferred-refill 证据分别覆盖属性重算和补弹。此准备合同针对两者相交的活跃生命周期：普通剩余量为零且末发期限未到时，真实道具成功重算不得提前补弹或重置期限。当前代码未确认存在实现缺陷。

## 正常输入验收

专属 runner：`tests/tank-ammo-recompute-refill-network.cts`。复用真实 BUY3/pet2 的原生 checkpoint，通过普通 BUY6×1、合法 Kitbag 槽4配置进入双玩家对局；不修改拥有记录或活跃状态。

正常 held fire 将计算容量7消耗至0；普通 use5 成功安装速度技能并触发重算。检查重算后的快照已带 speedBoost6，剩余量仍0、容量仍7、末发 startedAt/duration 保持。逐帧检查期限前空弹匣，到期自然补7；fresh fire 扣至6，继续五tick确认不二次补弹。记录真实库存0、完整双端同key players、fire/itemUsed 等核心事件及双 round1 Leave。

模拟时间、服务器时间、接收墙钟分别保存。普通容量与间隔沿原公式，普通弹匣配给、饮料自用和成功持久消费沿已有明确重建政策。不验饮料运动距离、特殊弹药、伤害、特效、重启或其他车型。

## 执行依赖

需要协调独立服务窗口与 `AMMO_RECOMPUTE_PORT`；当前 compiled release 身份为 plant-contact-tank-owned-engineering62586。runner 未启动服务器。专属严格类型检查通过，类型检查不替代上述玩家证据。完整 M2-02 和最终数值恢复目标仍未完成。
