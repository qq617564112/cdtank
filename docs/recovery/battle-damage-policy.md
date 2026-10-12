# 战斗攻防采用规则

当前攻防按用户确定的项目规则执行。原表、拥有装备和技能的属性合成继续使用已恢复来源；最终伤害、侧背修正和暴击使用项目现有消费者，不再以取得原服务端完整伤害公式作为实现阻塞。

拥有完整攻防资格时，`calculateQualifiedShotAttack`计算：

`round(max(0, attackBase × attackPercent + attackBonus))`

`calculateQualifiedShotDamage`将防御换成点数后缓伤：

`defensePoints = max(0, defensePercent × 100 + defenseBonus)`

`damage = rawDamage × 100 / (100 + defensePoints × defenseCorrection)`

攻击饮料已参与属性重算，合格攻击分支不重复叠加。资格不足时继续现有明确的项目回退；独立伤害类型、真实技能条件、侧背修正、暴击和命中资格沿各自现消费者执行。本项不改数值，也不新增未知技能来源。

原最终伤害算法没有完整来源，这是来源记录。实际对局、装备技能组合和持久业务的未验收范围继续按tasklist登记。
