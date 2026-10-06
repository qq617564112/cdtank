# Func19 取得入口运行时

本文记录 item12501、12502、12503 的购买入口与 Func19 现有运行时链。Func19 计算实现已按
`9f6620f`、`9d632fc` 接入；本文只补取得入口，不把后续装配、来源选择或实际验收写成已完成。

## 来源事实

`item.csv` 中三项分别为：

| ItemTableID | ItemMoney | ItemCoin | GGet | Durable | BattleUseMax | ItemSkill1 | ItemType | D2/D3 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 12501 | 0 | 3000 | 0 | 3 | 0 | 12501 | 13 | 12035 |
| 12502 | 0 | 3000 | 0 | 3 | 0 | 12502 | 13 | 12035 |
| 12503 | 0 | 3000 | 0 | 3 | 0 | 12503 | 13 | 12035 |

三项的原 ID 分类 `classifyItemId` 为 7（MARKER），库存分类为 4。现有 Home MARKER 三槽、
ownership/绑定检查及装备事务可处理这些实例；Func19 的 domain、history/account、真实
`selectRoleSkills` 来源与 World 冻结路径已存在。`ItemSkill1` 是装备来源展开数据，不是全局
技能授权。

## 采用 policy

PART 目录在既有普通部件之外只开放精确的 12501/12502/12503 三项，不从整个分类 7 或全部技能
目录赋予物品。目录继续透传源 `ItemMoney`、`ItemCoin`、`GGet`、`Durable` 和类型字段；三项
按源 `ItemCoin` 3000/件销售。`ItemMoney=0` 表示 MONEY 通道不可用，不是免费购买。

`AccountShop` 继续使用现有普通 BUY 的数量、认证、准备阶段和 WAITING 限制，以及原子扣币、
创建 typed inventory 实例、spending receipt 与请求重放事务。购买时按实际所选币种读取单价，
`unitPrice <= 0` 一律拒绝；既有正价格件行为不变。成功购买只增加真实 owned 实例，
`ownedQuantity` 使用现有库存构造，`battleQuantity` 仍为 0，不自动装配，不直接给 World
倍率，不默认授予账户技能，也不新增 coin 奖励基数或目录 schema、role/table ID。

装配仍由既有 Home MARKER/EQUIP producer 完成。真正生效路径保持：

```text
Shop BUY -> 持久 owned marker instance -> Home MARKER EQUIP
  -> selected role sources -> selectRoleSkills -> World freeze
  -> history/account pending transaction -> ResultAward
```

同账户重复回执复用原 purchased/receipt，不加倍；任一事务步骤失败由现有事务回滚。客户端需
由专职 UI worker 根据 QUERY 中的币种价格显示可付币别，不作为本服务端改动的一部分。

## 待实测

本轮未运行测试、浏览器验收、构建或类型检查。待实测：MONEY 以 0 单价购买被拒、TOKENS 购买
12501/12502/12503 各扣 3000 并生成真实 owned 实例、重复 `requestId` 不重复扣款或发放、
失败全事务回滚、Home MARKER 装配、真实 `selectedSkillIds` 展开及 World 冻结到账户回执。
