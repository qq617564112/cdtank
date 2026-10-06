# 2011真实购买后的托管有限消费

M2-02与既有M2-02-AMMO-AI-B的取得资格支路首次由tests/tank-ammo11-purchased-ai-network.cts验收。旧ammo-ai-network/browser使用world-role-attributes-native拥有与两发库存fixture；它们的自主选择、两局及重启合同复用。本片沿原真实BUY3/pet2检查点，通过正常Shop新requestId购买2011两发、Kitbag槽1，mode4/map7双正常账户Ready后只启用Autopilot，不发送PlayerInput。

实际AI沿既有finiteAmmoHotkey→finishItems普通useItem入口选2011，自主fire恰好两次，两个ammoConsumed值1、0，持久Inventory API回执ownedQuantity0。耗尽后自主普通2001继续一次，当前弹匣6/7、HP700。随后正常disable，无新AI优先级、控制器或槽政策改动。

实际tank3技能来源2011/4009与拥有装备+58/+5c/+60完整明确，recomputeRoleAmmo输出容量7/普通1.5秒/末发4.5秒；实际2011首发快照remaining1/7、duration1.5。宠物拥有记录不作boundGear，不新增拥有或活跃状态。AI寻找可射目标可合法等待，本片不把两个发射之间的目标选择时间当作装填期限或原AI数值恢复。

207次共同完整players观察全部双同，指定五个fire/ammoConsumed事件双同。两正常round1 Leave成功，3324无监听、服务与临时库已清。原raw tank-ammo11-purchased-ai-network-2026-10-05T04-27-49-730Z.json，完整服务日志同前缀-server.log；封装tank-ammo11-purchased-ai-player-evidence.json。

只补真实购买和正式装备来源到托管有限弹消费者的支路。两局、重启、绘声、移动及原AI来源不由本片重新验收；完整M2父保持开放。
