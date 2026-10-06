# 贵重品客户端配置入口

本文记录 20001 鱼骨、20002 骨头两件贵重品的客户端配置终态。原 item 表两行均为
类别 6、`ItemType=13`、`ItemMoney=0`、`ItemCoin=0`、`GGet=0`、`Durable=0`、
`BattleUseMax=0`；`ItemSkill1` 分别为 20001/20002，`ItemSkill2=30005`。

| ItemTableID | Name | Inventory category | ItemType | BattleUseMax | ItemSkill1 | ItemSkill2 |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| 20001 | 鱼骨 | 6 | 13 | 0 | 20001 | 30005 |
| 20002 | 骨头 | 6 | 13 | 0 | 20002 | 30005 |

## 配置入口

`HomeInventoryView` 保持原 Weapon / Item / Valuable 页及原布局。Item 页继续显示
正常类别 1 记录，并额外显示账号查询确认为 owned 且 `itemTableId` 精确为
`20001` 或 `20002` 的两条记录；Valuable 页继续使用原 category6 列表、行内容、
计数与出售入口，保持原布局。

用户可在 Item 页选择或拖入这两条记录，经既有 `ASSIGN` 请求保存确认；当前
槽 4..7 对应战斗键 5..8。取消与清空沿用既有 `CANCEL` 路径。客户端不创建 owned
记录，零数量不显示；权威来源仍是账号查询返回的 `Inventory`。

两件贵重品源 `BattleUseMax=0`；采用规则按确认 owned 初始化可用量，不放宽到
category6 全类，不开放免费 shop/gift，不做客户端预测。普通 use 经既有请求进入
`ItemSkill2=30005` 链路：存活、自用、缺失生命、真实 skill 定义通过后，先持久 CAS
成功，再按 HP30 治疗并 clamp 到当前上限，owned/本局量各减一；满血、拒绝或保存失败
不改 HP、不扣量。成功 `itemUsed` 带 `definition.name` 沿现 HUD；最后一份在同一
AccountStore CAS 事务删空实例与所有引用快捷槽，当前角色零量记录与七快捷槽/数组 0 清。
CPU 配置走 [treasure-cpu-client-configuration.md](treasure-cpu-client-configuration.md)
的精确 20001/20002 消耗槽 5..8 合同，运行时治疗与清理链见
[treasure-item-use-runtime.md](treasure-item-use-runtime.md)。

## Known Issues

本片未运行浏览器验收、类型检查、构建或实际战斗验证。原服务端 writer、真实双端、
持久重启与高清表现仍待验收。
