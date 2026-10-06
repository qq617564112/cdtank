# 我的家玩家页成长账本展示

正常 Home 玩家页的原三个动态文字控件使用 `RoleProfile` 返回的权威 `AccountGrowth`。`Battle.roleProfile()` 仍是唯一查询入口；页面打开沿用既有的账户身份 owner，不新增 API、轮询或本地成长计算。

## 来源映射

| 原来源 | 展示来源 | `data-profile-binding` |
| --- | --- | --- |
| `txtPlayerScore` | `growth.rankPoints` | `confirmed-account-growth` |
| `txtPlayerOriginality` | `growth.originality` | `confirmed-account-growth` |
| `txtPlayerTech` | `growth.tech` | `confirmed-account-growth` |

`growth` 存在时，包括各字段为零，三项都显示该账本值。页面不会从本地 `combatScore` 推算成长，不重发奖励，也不从其他 raw 字段猜测成长。

## 回退语义

`growth` 不存在时，三个控件继续显示既有的原签名 `playerSummary`：`score`、`originality`、`tech`，绑定为 `confirmed-role-profile`。两者都不存在时文本保持空白，绑定为 `unavailable`。

`RoleProfile` 每次打开的清理、迟到响应保护和当前会话身份判断保持现有逻辑；关闭页面后到达的响应不会写入 Home。库存、资金、页导航、布局、图块和动态附件字体不在本映射内改动。

## 验收范围

本次只实现上述三个已有文字控件的展示接线，未执行真实网页验收，也未执行真实服务重启验收。页面呈现、账号身份切换后的实际刷新以及重启后的增长账本恢复仍需由正常浏览器与真实服务流程验证。
