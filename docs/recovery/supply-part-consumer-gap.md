# 补给装置17061周期恢复入口缺口

M2-01/FUNC-02/M6-06正式equipment-supply Web周期消费者已接入；原Func2 producer仍有来源缺口。原item17061正价1500金币/150代币、类别12、技能13171；物件说明每3秒恢复50，技能13171说明每3秒恢复20、HP字段20、Trigger0/Target1/Func2 T999 X3。原表及已发布combat-catalog.json保留这些相互不同的数值，不能用物件文案覆盖技能字段。

原432b29及现roles/skills.ts的isPassiveRoleSkill要求Trigger0且至少一个Func1/Tffff。13171没有该条件，selectRoleItemSkills不将它加入原属性被动合成；432951也不消费HP字段。真实装备17061到库存state2/部件tableID的入口已具备，passive-part-effects.ts分派13501–13506装饰效果；周期恢复由独立battle/items/equipment-supply.ts正式消费者接入。

所缺原入口为Func2的装备技能调度、T999语义、X3到周期与时间基准的解释及HP增量目标调用。3秒来自两份原文案与X3的对应，尚无执行证据；20来自技能字段，50仅为物件说明。正式周期消费者采用已明确的Web政策：技能HP20与X3对应3000ms优先，物件文案50保留来源差异。合格装备、当前生命资格和服务端周期由独立消费者处理，不往currentSkills或原被动选择器补塞13171。原Func2调度/T999与时间写入者仍未恢复；原来源证据不算实际恢复或完整Func2验收，此来源入口停止重复调查。

来源门禁回归由 `tests/supply-part-consumer-gap.cts` 执行，输出 `recovery/output/supply-part-consumer-gap.json`：正式目录字段保持一致，`isPassiveRoleSkill(13171)` 与物件技能展开均为空；该证据只锁定不误接入被动属性，不声明周期治疗或联机消费者已恢复。

复用来源：skill-function-coverage.json、combat-field-inventory.md、既有partShopItems正价目录与account-battle-part-definitions.json。没有重执行原native、扫描其它未知字段或制造拥有库存。

正式政策、纯恢复量和普通3649网络准备见 `supply-healing-consumer.md` 与 `recovery/output/supply-healing-preparation.json`；纯恢复量与3649首次普通联机已完成；原Func2执行器仍为来源缺口，有限实际结果见同消费者文档。

有限合审 `recovery/output/supply-healing-root-review.json` / `PASS_FINITE_ORDINARY_BUY_EQUIP17061_PERIODIC20_UNEQUIP_STOP_BENEFIT_DUAL_STATE_NATIVE_RESTART_SUMMARY_CLOSE_SCOPE` 已收普通网络与页面周期/Benefit终点；原Func2 producer/T999缺口保留，网络及页面证据独立范围见 `supply-healing-consumer.md`。
