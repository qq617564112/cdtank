# 宠物学习确认与重试

M5-08、UI-35 与 M6-04 的本批有限交付覆盖学习请求的权威确认、关闭重开恢复及显式重试。当前学习预算来自 `account_growth.skill_points`，与“关于我”的 `growth.tech` 同源；原角色资料 `0x80` 只保留原始字节，不作为当前扣点余额，也不改写。

## API

`PetSkillLearning` 的 `QUERY`、`LEARN` 保持原字段。`CONFIRM` 接收 `instanceId`、`slot` 与现有格式的 `requestId`；响应新增可选 `confirmation: 'APPLIED' | 'ABSENT'`。

- `APPLIED`：认证 `account_id + request_id` 已保存 receipt，且 `instanceId/slot` 匹配。响应带原历史 `learned`、`replayed: true`，同时返回当前 `points`、`quotes`、`owned` 与 `profile`。
- `ABSENT`：当前没有该请求的保存记录，不带 `learned`；同一 attempt 保留，等待用户明确选择重试或放弃。
- 冲突：同一 `requestId` 已绑定不同实例或槽时拒绝，不把 receipt 改绑到新目标。

历史 `learned` 记录完成时的技能、等级与费用，当前 `points` 是 CONFIRM 时的权威余额；两者不是同一时刻，不把当前余额回填成历史余额。CONFIRM 不开启写事务，不扣点、不增级、不改角色资料、Ready、绑定或广播，可在任意房间阶段读取。LEARN 的归属、报价、上限、余额、原子扣点、增级、receipt 去重与失败回滚保持不变；只有 LEARN 新确认继续触发现有 mutation hook。

## 客户端

学习 attempt 由聚焦 owner 持有，生命周期长于 `RolesSession` 的关闭与重开。同一 `Battle` 与同一认证连接 generation 内，一次学习尝试只有一个 in-flight 请求；owner 保存最初 `instanceId/slot/requestId`，失败不重造 ID。身份或连接 generation 变化时，旧 attempt 被清除或隔离，旧回复不会写入新账户。

LEARN 成功后消费确认的 `OwnedRoles`、`Profile` 与 `points`，结束本次 attempt，下一次用户新动作才可创建新 ID。处理中不乐观修改等级或余额。技能弹窗、整个 Home 或页签关闭后，未确定结果的 attempt 保留；重新打开可继续确认，单纯 QUERY 不视为确认。

“确认学习结果”入口保持可见和键盘可用，与当前报价是否 eligible、是否封顶及当前选中宠物无关；成功学习后报价可能已经封顶，仍需能确认原 attempt。APPLIED 后显示已确认，用权威投影更新页面并结束 attempt；CONFIRM 失败保留 attempt，可再次确认。ABSENT 后仅用户明确选择“重试本次学习”时，才用原 `instanceId/slot/requestId` 发 LEARN；重试前读取当前报价并遵守服务端资格，不自动重新 LEARN。

owner 串行 `QUERY/LEARN/CONFIRM`，或用 revision 隔离，防止旧 QUERY 覆盖新学习回复。组件在关闭后的 inflight 更新 owner，重新挂载时消费最新快照，旧回包不污染重开或新账户。初次报价 QUERY 失败提供可见重试；可恢复错误不永久留空，未知值保持空白。原 Source 布局、鼠标键盘、焦点、缩放和 portal 行为不变。

## 证据边界

本批新增范围仅静态实现，尚未实测。既有 raw+80 余额链的联机、页面与重启证据仍只覆盖当时限定范围，不证明当前 `account_growth` 扣点、CONFIRM、关闭重开或显式重试的实际网页、双端、持久重启与高清行为。原服务端点数生产、学习事务、全宠物成长和主动施放仍未恢复；M5-08、UI-35、M6-04 父项保持未完成。
