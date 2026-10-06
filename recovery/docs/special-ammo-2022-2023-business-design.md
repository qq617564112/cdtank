# 粒子炮弹/火箭炮弹正式业务设计

FUNC-22/FUNC-23。`skill2022` 与 `skill2023` 是原技能表中的射击修饰技能，不是弹药商品。原 `item.dat`
的 204 行没有 `ItemTableID 2022/2023`，ItemSkill1/2/3 也没有引用这两个技能；因此本实现不新建
item、价格、库存、局内上限、商城入口或 CPU 配置。技能仍只能从角色既有 16 槽、装备被动项和真实
item 展开得到，正式来源链未恢复的授权保持开放。

## 直接源事实

| 范围 | 原来源事实 |
| --- | --- |
| `skill2022` | 名称“粒子炮弹”，TriggerType0、Target1、Range0；说明“贯穿一切障碍直接命中目标。”；三效果槽 Effect0/Sound0；FuncType22，T/X/Y/Z 均0；MaxBullet4、Delay32、LoadTime100，其余属性0。 |
| `skill2023` | 名称“火箭炮弹”，TriggerType0、Target1、Range0；说明“炮弹射程增加一倍。”；三效果槽 Effect0/Sound0；FuncType23、T0、X200、Y/Z0；MaxBullet4、Delay32、LoadTime100，其余属性0。 |
| item 引用 | 204 个原 item 行均不引用 skill2022/2023，也不存在 item2022/2023。 |
| 资源 | 两技能没有图标、模型、贴片、声音或受害者结果技能；原 FuncType22/FuncType23 服务端分派与授予入口仍未恢复。 |

原技能行和 `combat-catalog.json` 字段不改。`Delay`、`LoadTime`、`MaxBullet` 继续只由既有角色重算
读取；本功能不另建装填时钟，也不把两个技能当作真实弹药 ID。

## 取得与作用范围

`recomputeBattleAttributes` 在已有 `RoleSkillSources` 上调用 `resolveSelectedShotModifiers`。该函数
复用 `selectRoleSkills` 的16槽顺序、当前槽重复规则、装备/额外被动筛选和真实 item 展开，不读取
商城或 `currentAmmoTableId` 猜技能。修饰状态随每次权威重算覆盖；技能离开已选来源后下一次重算恢复
普通行为。

该状态只影响射击目标查询和弹丸可达范围，不写入移动、碰撞、库存或事件 item ID。开火命中仍使用
当前确认的真实弹药 ID；不会因取得修饰而生成 `shotPlayerResult.itemId=2022/2023`。效果槽和声音
均为0，本功能不新建绘声。

## FuncType22 贯穿

采用规则：取得 FuncType22 后，在现有真实查询边界忽略静态 battlefield、scene crush 和 scene 遮挡，
沿普通源的 XZ strip 选择距离内最近的非自己存活角色。half-width 保持原25，最多结算一个目标。
静态遮挡忽略只作用于这次目标查询，不改变房间地图、移动碰撞或后续无遮挡子弹。

命中后沿现有 `hitPlayer → qualified damage/facet/Critical/友军/免伤/死亡/模式` 链处理。查询不先
过滤友军：友军若最近仍会先被选中，再由既有友军伤害和免伤规则决定结果，不能穿友军绕开误伤链。
没有角色时沿用普通 free/scene 反馈；不会把 scene 替换成额外假目标。普通2001与 FuncType22 都只做
一次直接单目标结算，不增加延迟、多段或额外 pending 队列。

## FuncType23 射程

采用规则：FuncType23 的 X200 解释为总射程百分比200%，普通源 free-aim/query 的1000对应2000。
这是百分比转换政策，不是原表字段单位恢复，也不是固定增加200。查询范围与连续原型弹丸的实际可达
距离一致：free/scene 端点使用2000；仍走连续 bullet 的真实弹种使用与2000对应的寿命，因此不会在
查询内可选但到不了，或在射程外提前消失。当前2001等 direct 路线继续由查询端点结算。

重复选择同一 FuncType23 不叠加倍率；多项不同 FuncType23 仍采用第一项的实际 X 值。未选择任何
FuncType23 时为普通100%，未选择 FuncType22 时所有原遮挡和 strip 默认保持不变。两个修饰可以同时
作用于一次已选技能的射击。

## 当前交付边界

现普通玩家没有 item2022/2023，也没有证据表明账户授予这两个技能，因此普通对局不会凭空取得该作用。
正式执行器已能从真实 `selectRoleSkills` 结果计算修饰，但没有虚构 grant、商城、CPU、隐藏库存或
item provenance。原授予/授权来源保持未完成；原服务端 FuncType22/23 的权威分派、原始射程单位和
完整玩家取得链同样保持未完成。

本批未执行 unit test、浏览器、构建、类型检查、lint、exporter、native 或生成器实测。
