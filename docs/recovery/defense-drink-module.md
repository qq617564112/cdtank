# 防御饮料模块

M4-10-I05-B的独立业务模块为battle/items/defense-drink。物件5/技能5、Def30/DefBonus20、FuncType1的t10、Target1/Trigger1和首表现槽Effect108/SE40来自combat-catalog。施放通知只使用effectIndex0；第二槽Effect10/SE02的触发条件未恢复。

applyDefenseDrink沿用攻击饮料的接口与重建资格：本人存活、战斗状态2、实际物件5的拥有量/本局量为正、完整16技能槽有空位；已有技能5或defenseBoost拒绝叠加。先执行持久数量CAS，失败或异常不修改库存、技能槽、属性或期限。成功各减一份、添加技能5并调用原属性重算，不逐出其他技能。clearDefenseDrink只撤本模块拥有的技能5并重算；advanceDefenseDrink在now>=expiresAt或死亡时清理，通知skillStopped/技能5。期限以实际权威now加10秒记录。

## 防御读数与伤害解释

attributesReady且重算前后roleFloats+0x7c与roleIntegers+0x88均为有限值时，捕获实际原属性值。两字段相加并下限归零，得到baseDefense/boostedDefense；boostedDefense下限为baseDefense。原重算确有Def浮点累加/百分比转换和DefBonus整数累加，但将两字段合成一个护甲数量是本片重建解释。

任一时点属性不完整时，使用施放前tank.defense下限归零，boostedDefense=Math.fround(baseDefense*(1+Def/100)+DefBonus)，记录source=rebuilt-tank；完整原属性记录source=original-attributes。共享坦克配置不修改。

defenseAdjustedDamage在状态缺失或到期时原样返回输入；生效时使用damage*(100+baseDefense)/(100+boostedDefense)，比例限制在0到1。100是明确的重建缓和尺度，比例只作用于饮料带来的增量，保持无饮料的已有伤害基线。非法有限读数不调整伤害。Def30不等于直接减伤30%，这些公式不宣称恢复原命中防御公式。

## 验证

tests/defense-drink.cts通过源表参数/两表现槽、首槽唯一通知、资格/空量、非叠加/16槽容量、持久保存顺序、真实AccountStore数量CAS与SQLite更新失败回滚、账户隔离/原库存字段保存、回调前后实际属性读数、不完整属性回退、比例与下限、10秒精确边界、死亡清理与保留其他技能。

## 限制

本模块尚不包含World伤害接线、快照、网络、网页、CPU决策或原特效表现验收；这些由各自集成任务负责。Target1自用、持久消费和技能生命周期是重建业务规则。原完整防御命中公式及第二表现槽触发含义仍未恢复。
