# 家族聊天运行与持久

本页描述家族聊天当前 Web 采用的持久、协议、服务端路由与客户端生命周期。直接原事实只证明 `chat.xml/btnFamilyChannel` 与 `game_main_chat_shrinked.xml/btnFamily` 的三态图和布局；原家族频道数字、成员关系、owner、发送/接收回调与服务器路由没有恢复，本闭环为 Web 采用。生产实现落在 `apps/server/src/account-store.ts`、`apps/server/src/social/family.ts`、`apps/server/src/social/family-chat.ts`、`apps/server/src/social/family-operator.ts`、`apps/shared/protocols/PtlFamily.ts`、`apps/shared/protocols/PtlFamilyChat.ts`、`apps/shared/protocols/MsgFamilyChat.ts`、`apps/shared/protocols/serviceProto.ts` 与 `apps/web/src/network/family.ts`、`apps/web/src/network/lobby-chat.ts`、Battle 与三页 chat 接线。

## 持久归属

家族归属只存于服务器同一 SQLite 的独立表：

```sql
CREATE TABLE IF NOT EXISTS family_memberships (
  account_id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL,
  family_name TEXT NOT NULL,
  assigned_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS family_memberships_family_id
  ON family_memberships(family_id);
```

`account_id` 为主键，因此每个账户最多一个家族。`AccountStore` 只增加以下入口，只读写 `family_memberships`：

```ts
family(accountId: string): {id: string; name: string} | undefined
familyAccounts(familyId: string): string[]
assignFamily(accountId: string, familyId: string, familyName: string): void
removeFamily(accountId: string): boolean
listFamilies(familyId?: string): Array<{accountId: string; familyId: string; familyName: string; assignedAt: number}>
```

`assignFamily` 用 `BEGIN IMMEDIATE` 与现 rollback 惯例：目标 `accountId` 必须已存在于 `accounts`，否则拒绝；同一 `familyId` 的已有行在新成员加入前统一更新为本次 `familyName`，再 upsert 目标账户，因此同一 `familyId` 的 id 与 name 在一次事务中原子一致。`removeFamily` 幂等删除归属，`listFamilies` 只读。写路径不覆盖 `accounts`、`role_profiles`、`inventory`、`role_records`、growth、好友、屏蔽或其它 raw profile 数据。实现可由 `apps/server/src/social/family.ts` 的独立函数转发。

## operator

operator 固定为 `apps/server/src/social/family-operator.ts`，只调用上述 AccountStore 方法，通过 `ACCOUNT_DB_PATH` 指向与服务器相同的持久数据库：

```sh
node --import tsx apps/server/src/social/family-operator.ts assign <accountId> <familyId> <familyName>
node --import tsx apps/server/src/social/family-operator.ts remove <accountId>
node --import tsx apps/server/src/social/family-operator.ts list [familyId]
```

`assign` 要求目标账户已存在，重复 assign 同一账户原子替换其家族；`familyId` 与 `familyName` trim 后必须非空且不含 `U+0000..U+001F`、`U+007F`。`remove` 幂等，`list` 只读。operator 不创建账户，也不提供游戏内创建家族、加入/退出、审批、owner 转移、成员管理、grant、库存或额外管理页面。以上命令仅文档登记，不在服务端进程内执行。

## 协议

手工修改 `apps/shared/protocols/serviceProto.ts`，不运行生成器：

| 项目 | 固定值 |
| --- | --- |
| `serviceProto.version` | `116` |
| `Family` api | `id: 61` |
| `FamilyChat` api | `id: 62` |
| `FamilyChat` msg | `id: 63` |

`PtlFamily`：`ReqFamily={}`，`ResFamily={accountId:string;family?:{id:string;name:string}}`。`Family` 无参数，服务端只按当前 authenticated `accountId` 查询该连接自己的归属，不接受 owner、familyId 或他人查询。

`PtlFamilyChat`：`ReqFamilyChat={text:string;roomId?:string;round?:number}`，`ResFamilyChat={message:MsgFamilyChat;recipientCount:number}`。

`MsgFamilyChat={id:number;accountId:string;senderName:string;familyId:string;familyName:string;text:string;message:string;roomId?:string;round?:number}`。`accountId` 为发送消息的真实 authenticated 账号，`senderName` 由 `accounts.displayName` 权威读取，`id` 进程内递增，`message` 固定为 `[家族] ${senderName}: ${trimmed}`，`roomId/round` 仅在请求携带 origin 时写入。`PtlAccount`/`ResAccount` 与账号合同不变。

## 发送资格与 origin

- 连接必须已认证，否则 `ACCOUNT_REQUIRED`。
- `text` 必须为字符串，raw length `1..72` UTF-16 码元，trim 后非空，且不含 `U+0000..U+001F`、`U+007F`；否则 `FAMILY_CHAT_REJECTED`。
- `roomId` 与 `round` 必须成对出现或同时缺席；否则 `FAMILY_CHAT_REJECTED`。
- 无 origin 时只能从当前无 session 的大厅连接发送；连接已持有 room session 返回 `FAMILY_CHAT_IN_ROOM`。
- 有 origin 时，连接必须有当前 session 且玩家仍在 room snapshot，否则 `NOT_JOINED`；`roomId` 必须等于当前 session room，`round` 必须等于 `snapshot.match?.round`，否则 `ROUND_CONFLICT`。
- 发送账户没有当前 membership 返回 `FAMILY_CHAT_NO_FAMILY`，不伪造空家族。

origin 资格允许 WAITING、PLAYING、FINISHED 连接发送和接收，只校验发送连接当前房局，不限制收件人位置。公开、队伍、好友、GM、密语既有路由与错误码保持。

## 路由与确认

服务端每次发送都重新读取发送账户当前 membership，并按当前数据库中的 `familyId` 选择收件连接，不信任客户端旧归属或旧显示。收件条件是已认证且当前 membership 的 `familyId` 相同的全部连接，跨大厅与 WAITING、PLAYING、FINISHED 实时生效，包含 sender 自身。同一账户的每个认证连接各收一次；`recipientCount` 计 `otheraccounts` 去重后的“除发送账号外其他家族账号数”，不计连接数与发送账号，家族只有发送者在线时发送成功、sender 回显一次、`recipientCount: 0`。

家族收件不加好友、黑名单、同房、同队过滤，不向 `RoomEvent` 广播，不写离线 mailbox、历史或永久 receipt。API 必须检查 `broadcastMsg` 返回的 `isSucc`，失败返回 `FAMILY_CHAT_DELIVERY_FAILED`；不宣称全收件原子 exactly-once。发送失败只返回错误码，不自动重试、不补偿重放。广播日志独占地写入家族消息，成功回包不另行生成第二条消息。

## 客户端接线

`apps/web/src/network/family.ts` 只读调用 `Family` 刷新当前 membership，不提交 owner 或 familyId。`lobby-chat.ts` 的 channel union 增加 `family`，监听 `FamilyChat` 并按 `familyId + id` 去重；发送 `FamilyChat{text}`，成功只清同 text 草稿，失败保稿并回收 pending。大厅无 room 时接家族日志，room consumer 只在当前 snapshot 有房时接日志，消息 origin 不限定收件人房局。

UI 三页用原 Family 按钮作当前频道 toggle：大厅/WAITING 沿用 `chat.xml/btnFamilyChannel`，PLAYING/FINISHED 沿用 `game_main_chat_shrinked.xml/btnFamily`。原频道列表没有 `rdoFamily`，菜单新增明确可键盘操作的最小 `role="menuitemradio"`“家族”项，不复用 `rdoGM`，不重叠旧 entry，fallback select 加入 Family。Battle 固定新增 `5=Family`，`4=GM` 保持独立。普通输入与快捷输入共用 pending 门禁，发送期间锁定输入与频道切换；选择 Family 时提交只读 `Family` 刷新，可显示确认名字或“未加入家族”，网络失败 status 可 retry，发送仍按服务器实时归属。

所有新 Family 状态、日志与确认随 `accountContext` generation、断线、入离房与 `resetSession` 按现 chat lifecycle 清理并拒绝迟到回包：账号切换清旧消息/草稿/pending，进入房间停止大厅 consumer，离开房间经 `clear()`/`resetSession` 重置房内 `family` 缓存与 revision 并清房间状态，断线清 session 状态并递增 generation，重连后重新读取归属。UI 读到 family 与消息 sender 的 account 含义不同，不用 senderId 作为 recipient 身份。关闭时解除新增 subscribe/listen，保持现 chat 其它生命周期、原字体与原数字图片不变。家族归属变更不推送也不轮询，选择或重开时刷新；被移除后旧显示不能继续发送，返回 `FAMILY_CHAT_NO_FAMILY`。

## 局限

原 `btnFamilyChannel`/`btnFamily` 只证明按钮和布局。原家族频道数字、发送/接收回调、线格式、服务器路由、成员关系、owner、权限、审批、拒绝回包与历史规则仍未恢复。原频道列表没有 `rdoFamily`，最小家族菜单项是当前 Web 采用。当前 Web 采用不新增游戏内家族管理页面或 grant 入口，`family_memberships` 只由 operator 维护。
