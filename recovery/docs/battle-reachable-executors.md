# 正常战斗入口与执行器

正常取得、装备、使用、选弹、命中、死亡和宠物事件已有正式执行器。此次静态追踪没有发现待接的可达战斗数值或效果入口。

## 定义与取得范围

当前共享定义中，167件物件具有商城、Breach掉落、结算奖励或宝藏取得资格，直接引用149个非零技能ID。10只宠物的可学习等级引用159个技能ID，两集合不重叠，共308个直接来源技能。锁定学习槽的baseId不计入此集合。

Web经`content.ts`读取`/content/index.json`与定义，Server读取共享content定义；两端的CombatCatalog由GameContent组合。实际执行器继续解析函数引用的目标技能，以及普通生命／复活产生的运行时技能。

| 正常入口 | 正式消费者与范围 |
| --- | --- |
| 物件取得 | shop-catalog按available和group取商城；ground-items按breachDropOrder取12项池；equipment-reward按battleRewardOrder取27项池；20001/20002沿宝藏拾取和库存事务 |
| 普通使用 | accept-input的14种handler覆盖heal、treasure、defense、attack、invincibility、camouflage、disguise、speed、turn、teamLife、building、cure、trapSweep、airstrike |
| 命中 | burn、explosive、medical、radarJam、slow分别进入燃烧、范围爆炸、医疗、雷达干扰与减速消费者；普通弹药保持权威查询／伤害链 |
| 陷阱 | ground-traps的8种reader覆盖3001–3009九件陷阱；真实目标技能从各rule解析，4001/4002/4003及群体4024/4025/4026进入对应限制与恢复通知 |
| 被动部件 | 17051死亡自爆、17061周期补给、13111/13112雷达、12501–12503奖励标记和13501–13506外观队列均有正式消费者 |
| 宠物五开放槽 | pet-lifecycle按定义事件执行attributes／heal／copy；backCritical与lastStand由命中／生命专用消费者执行；学习、rankCap与复制资格沿真实拥有记录 |
| 生死与派生目标 | World／life消费实际命中与死亡结果；空袭、爆炸及宠物修饰沿其函数目标技能；普通30001复活保护和30005宝藏治疗有独立真实入口 |

直接来源技能共覆盖FuncType1–23。物件侧的20类功能沿属性、使用、命中、陷阱、被动、奖励、雷达和射击修饰模块执行；宠物侧1/2/9/11/17沿生命周期、背击、最后一搏与复制模块执行。事件由实际定义与状态产生，属性被动和命中专用功能各用其正式调用链。

## 效果消费

直接来源技能的46个非零效果根均已发布；物件自带非零效果根也已发布。效果通知沿SkillEffectNotifications和EffectRuntime解析，特殊弹受害者沿shot-player-result消费TriggerType8首槽。派生目标、复活和ELK树的资源与通知范围见[battle-production-closure.md](battle-production-closure.md)。

四饮料第二槽、4005燃烧完成第二槽、4001/4002/4003与4024/4025/4026限制恢复第二槽、30001复活保护第二槽、10541指挥两槽均已有通知与消费者。死亡／显式清理／换局／离房按各自生命周期清理，具体采用条件见[remaining-effect-slot-integration.md](remaining-effect-slot-integration.md)和[respawn-protection-second-slot-gap.md](respawn-protection-second-slot-gap.md)。

## 来源与验收边界

第六学习槽10161–11061及11041的rankCap为0、levels为空，普通学习或复制不产生这些技能。04／c动作、Type10旧树及没有普通场景目标分派的医疗／雷达干扰弹仍按各专题来源范围登记。

原服务端授予、概率和完整触发公式未取得的部分沿已授权采用规则执行。此次仅静态阅读源码、定义与发布目录，没有新增对局、浏览器、构建、类型检查或高清验收，完整原版父项保持开放。
