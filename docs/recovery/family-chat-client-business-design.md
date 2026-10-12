# 家族聊天固定业务合同

M6-08-FAMILY / M5-12 / UI-03 / UI-11 / battle-remaining H。本文固定大厅、WAITING、PLAYING、FINISHED 的家族频道收件、发送、归属和界面接线。家族聊天是当前重建业务；原始家族按钮和布局有来源，原家族网络数值、服务器路由、成员权限和发送/接收回调没有恢复。

## 原事实与采用

| 项目 | 原程序/原资源事实 | 当前 Web 采用 |
| --- | --- | --- |
| 房间家族入口 | `chat.xml:116` 存在 `btnFamilyChannel`，`Button`，矩形 `l:-10 t:138 r:49 b:170`，三态图 `data\ui\gy\liantian_jiazu{1,2,3}.tga`。 | 复用该原按钮图作为大厅家族频道 toggle。 |
| 战斗家族入口 | `game_main_chat_shrinked.xml:159` 存在 `btnFamily`，`Button`，矩形 `l:2 t:7 r:49 b:32`，三态图 `data\ui\zhandou\liantian_jiazu{1,2,3}.tga`。 | 复用该原按钮图作为战斗/WAITING/FINISHED 家族频道 toggle。 |
| 原频道列表 | `chat_channellist.xml` 与 `game_main_channellist.xml` 各有 `rdoPublic/rdoPrivate/rdoFriend/rdoTeam/rdoGM`；`chat_channellist_lobby.xml` 有 `rdoPublic/rdoPrivate/rdoFriend/rdoGM`。三份列表都没有 `rdoFamily`。 | 不伪称恢复 `rdoFamily`。菜单保留原 radio，另加最小明确“家族”菜单项。 |
| 原数字 | 已有静态/执行来源只证明公共 `1`、队伍 `5`、好友 `3`。原家族频道数字、消息类型、发送分支和收件范围未证明。 | 家族不复用公共、队伍或好友数字，也不声明“原数字”。当前合同使用独立 `Family` 与 `FamilyChat` 协议。 |
| 原通信 | 原家族按钮存在，但没有已证明的家族发送/接收回调、服务器成员关系或线格式。公开、队伍、好友、GM、密语的既有业务继续各走原链路。 | 家族收件只由本机 operator 持久归属决定；好友、队伍、房间和 GM 都不等于家族。 |
| 文本资格 | 原房间与战斗普通输入证明 `setMaxTextLength(72)`；原 CEGUI Unicode 与 JavaScript UTF-16 码元等价性未证明。 | 沿用当前重建业务统一的 `1..72` UTF-16 码元、trim 非空、无控制码规则。 |

原始 `btnFamilyChannel` 与 `btnFamily` 仅证明按钮资源和布局，不证明家族成员资格、owner、批准、频道数字或服务器收件。

## 固定运行规则

### 归属与 operator

- 当前没有原家族归属服务。采用本机 operator 配置的独立持久归属，存储在服务器同一 SQLite。
- 每个 `accountId` 最多有一条 membership；同一 `familyId` 可包含多个账户。
- 玩家通过独立只读 `Family` API 查询当前 authenticated 账号的 membership。客户端不得提交 owner、familyId、成员列表或权限字段。
- 没有游戏内创建家族、加入/退出、审批、owner 转移、成员管理、grant、库存或账户 raw profile 写入。
- operator 命令固定为 `apps/server/src/social/family-operator.ts`，使用 `node --import tsx`，并通过 `ACCOUNT_DB_PATH` 指向与服务器相同的持久数据库：

```sh
node --import tsx apps/server/src/social/family-operator.ts assign <accountId> <familyId> <familyName>
node --import tsx apps/server/src/social/family-operator.ts remove <accountId>
node --import tsx apps/server/src/social/family-operator.ts list [familyId]
```

`assign` 要求目标 `accountId` 已存在；同一账户再次 assign 原子替换其 family。对相同 `familyId` 赋值时，在同一事务中先用本次 `familyName` 更新该 familyId 的全部现有行，再 upsert 目标账户。没有原“家族名字改名语义”事实，不另建名字表、审批或游戏内成员管理。`familyId` 与 `familyName` 必须 trim 后非空且无 `U+0000..U+001F`、`U+007F`；按现 CLI 允许值明确采用，不增加 hash、校验框架或额外权限层。

`remove` 幂等删除 membership，不改账户、角色、库存或资料。`list` 只读。operator 写路径不得覆盖 `accounts`、`role_profiles`、`inventory`、`role_records` 或其它 raw profile 数据。

### 发送资格

- 连接必须已认证；否则 `ACCOUNT_REQUIRED`。
- 发送账户必须有当前 operator membership；否则 `FAMILY_CHAT_NO_FAMILY`，不伪造空家族。
- `text` 必须为字符串，raw length `1..72` UTF-16 码元，trim 后非空，且不含 `U+0000..U+001F`、`U+007F`；否则 `FAMILY_CHAT_REJECTED`。
- `roomId` 与 `round` 必须成对出现或同时缺席；否则 `FAMILY_CHAT_REJECTED`。
- 无 origin 时只能从当前无 session 的大厅连接发送。若连接有 room session，返回 `FAMILY_CHAT_IN_ROOM`。
- 有 origin 时，连接必须有当前 session，当前玩家仍在该 room snapshot；否则 `NOT_JOINED`。`roomId` 必须等于当前 session room，`round` 必须等于当前 `snapshot.match?.round`；否则 `ROUND_CONFLICT`。
- 允许 WAITING、PLAYING、FINISHED 连接发送和接收；origin 只验证发送连接当前房局资格，不限制收件人位置。

### 服务端路由与确认

- 服务端在每次发送时重新读取发送账户当前 membership，并按当前数据库中的 `familyId` 选择收件连接；不信任客户端旧 membership 或旧 family 显示。
- 收件条件是 `accountByConnection` 中已认证且其当前 membership 的 `familyId` 相同。sender 包含在内。
- 同一账户的每个认证连接各收一次。`recipientCount` 计“除发送账号外的其他家族账号数”，不计连接数和发送账号。
- 家族只有发送者在线时发送成功，sender 回显一次，`recipientCount: 0`。
- API 必须检查 `broadcastMsg` 返回的 `isSucc`。投递失败返回 `FAMILY_CHAT_DELIVERY_FAILED`，客户端保留草稿；不声明全收件 exactly-once，不写永久 receipt，不自动补偿重放。
- 好友列表、黑名单、房间、队伍、player list、称号、role/inventory 不参与家族收件判定。
- 不持久化离线收件箱，不回放历史，不把消息写入 account profile、库存或房间历史。跨大厅、WAITING、PLAYING、FINISHED 指当前在线连接实时收件。
- public、team、friend、GM、whisper 的现有路由、错误码、草稿和广播不变。

## 协议合同

当前 `apps/shared/protocols/serviceProto.ts` 的真实尾部为 `version: 115`，服务最大 ID 为 `60`，其中 msg `GmReply` 为 `60`、api `GmSupport` 为 `59`。新增：

| 项目 | 固定值 |
| --- | --- |
| `serviceProto.version` | `116` |
| `Family` api | `id: 61` |
| `FamilyChat` api | `id: 62` |
| `FamilyChat` msg | `id: 63` |
| API 类型 | `"Family": {req: ReqFamily, res: ResFamily}`、`"FamilyChat": {req: ReqFamilyChat, res: ResFamilyChat}` |
| Msg 类型 | `"FamilyChat": MsgFamilyChat` |

新增 `apps/shared/protocols/PtlFamily.ts`：

```ts
export interface ReqFamily {}

export interface ResFamily {
  accountId: string;
  family?: {
    id: string;
    name: string;
  };
}
```

`Family` 是无参数只读查询。服务端从连接取得当前 authenticated `accountId`，仅查询该账号当前 membership；没有归属时只返回 `accountId`。客户端不能提交 owner、familyId 或查询他人 membership。`PtlAccount.ts`/`ResAccount`、`accounts.ts`、`game-connection.ts` 不承载也不修改家族字段。

新增 `apps/shared/protocols/PtlFamilyChat.ts`：

```ts
import type {MsgFamilyChat} from './MsgFamilyChat';

export interface ReqFamilyChat {
  text: string;
  roomId?: string;
  round?: number;
}

export interface ResFamilyChat {
  message: MsgFamilyChat;
  recipientCount: number;
}
```

新增 `apps/shared/protocols/MsgFamilyChat.ts`：

```ts
export interface MsgFamilyChat {
  id: number;
  accountId: string;
  senderName: string;
  familyId: string;
  familyName: string;
  text: string;
  message: string;
  roomId?: string;
  round?: number;
}
```

`accountId` 固定为发送消息的真实 authenticated 账号，`message` 固定为 `[家族] ${senderName}: ${trimmedText}`。`roomId/round` 仅在发送请求携带 origin 时写入，用于来源标识，不限制收件位置。

### 错误码

| code | 触发 |
| --- | --- |
| `ACCOUNT_REQUIRED` | 连接未认证 |
| `FAMILY_CHAT_NO_FAMILY` | 发送账户没有当前 membership |
| `FAMILY_CHAT_REJECTED` | 文本为空/超 72/含控制码，或 origin 未成对 |
| `FAMILY_CHAT_IN_ROOM` | 在房连接未携带 roomId/round |
| `NOT_JOINED` | 携带 origin，但连接无 session、room 已失效或玩家已不在快照 |
| `ROUND_CONFLICT` | roomId 或当前局号不匹配 |
| `FAMILY_CHAT_DELIVERY_FAILED` | `broadcastMsg` 返回失败 |

## AccountStore 与 API 入口

`apps/server/src/account-store.ts` 增加独立表：

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

`AccountStore` 固定入口：

```ts
family(accountId: string): {id: string; name: string} | undefined
familyAccounts(familyId: string): string[]
assignFamily(accountId: string, familyId: string, familyName: string): void
removeFamily(accountId: string): boolean
listFamilies(familyId?: string): Array<{accountId: string; familyId: string; familyName: string; assignedAt: number}>
```

上述方法只读写 `family_memberships`；`assignFamily` 在事务中要求 `accounts.id` 已存在，并在相同 `familyId` 的所有现有行统一本次 `familyName` 后 upsert 目标账户。`removeFamily` 只删 membership。

固定 owned 核心路径：

```text
apps/server/src/account-store.ts
apps/server/src/index.ts
apps/server/src/social/family.ts
apps/server/src/social/family-chat.ts
apps/server/src/social/family-operator.ts
apps/shared/protocols/PtlFamily.ts
apps/shared/protocols/PtlFamilyChat.ts
apps/shared/protocols/MsgFamilyChat.ts
apps/shared/protocols/serviceProto.ts
```

`social/family.ts` 实现只读 `Family` API。`social/family-chat.ts` 实现 `FamilyChat` API、origin 资格和当前 DB membership 路由。`index.ts` 在现有社交注册链中注册两者。`social/family-operator.ts` 只调用 AccountStore 方法。

生产接线、operator 运行方式与客户端生命周期见 `family-chat-runtime.md`。

## UI 与 Battle 通道 adapter

UI 消费者包含 `apps/web/src/network/family.ts`、既有 `lobby-chat.ts`、Battle 与三页 chat 接线；网络账号合同保持不变，不要求修改 `accounts.ts` 或 `game-connection.ts`。

| 范围 | 固定接线 |
| --- | --- |
| `apps/web/src/network/family.ts` | 只读调用 `Family` 刷新当前 membership，不写 owner/family。 |
| `apps/web/src/network/lobby-chat.ts` | channel union 增加 `family`；监听 `FamilyChat`；发送 `FamilyChat{text}`；成功仅清未变化草稿，失败含 `FAMILY_CHAT_DELIVERY_FAILED` 保稿。 |
| 大厅 chat 页面 | 无房间时用原 `chat.xml/btnFamilyChannel` 作 toggle。菜单新增最小 `role="menuitemradio"`“家族”项；不造 `rdoFamily`，不复用 `rdoGM`。 |
| WAITING 页面 | 使用原 `chat.xml/btnFamilyChannel`；`chat_channellist.xml` 保留原 radio，另加最小“家族”项。 |
| PLAYING/FINISHED 页面 | 使用原 `game_main_chat_shrinked.xml/btnFamily` 作 toggle；菜单新增最小“家族”项。 |
| `battle-chat.ts` | Family 固定新值 `5`，GM 保持 `4`；成功清未变化草稿，失败保稿。 |
| `battle-chat-view.tsx` | 增加家族 option、aria/placeholder/分支，`5` 与 GM 的 `4` 完全分离。 |

当前战斗状态已有 `0=room,1=team,2=whisper,3=friend,4=gm`。Family 固定使用 `5`，不得把 `4` 重解释为家族。大厅 union 使用 `'family'`，不与 `'gm'`、`'friend'` 混用。

UI 可在选择 family 前或发送前刷新只读 `Family`，但刷新必须带当前身份 generation；跨 generation 的迟到响应不得清空草稿、解锁 pending 或覆盖新身份状态。发送时服务端始终按 current DB membership 路由。

原布局事实照录：房间 `btnFamilyChannel` 为 `-10,138..49,170`，战斗 `btnFamily` 为 `2,7..49,32`；两张按钮均沿用 `liantian_jiazu{1,2,3}.tga` 三态。菜单无原 `rdoFamily`，因此家族菜单项只承担明确选择，不冒充原 radio 资源。

### 确认与生命周期

- 普通输入和快捷输入共用 pending 门禁；发送期间输入、频道菜单和切换均锁定。
- 响应成功只确认草稿；消息日志由 `FamilyChat` 广播拥有，成功回包不自行生成第二条消息。
- 失败保存原文、目标家族显示和 pending 恢复；`FAMILY_CHAT_DELIVERY_FAILED` 不宣称全收件 exactly-once，不写永久 receipt，不自动重试、不跨 generation 重放。
- 新消息按 `familyId + id` 去重。同一 account 的多连接分别收件、分别去重；不做跨页面全局去重。
- 账号 context 变化时清除旧 Family 消息、草稿、pending 和确认代际；旧确认或旧广播不得写入新账号状态。
- 进入房间时大厅家族 consumer 停止；房间/战斗 consumer 显示家族消息。离开房间时清理该房间聊天状态、draft、日志和 pending。
- 断线停止当前 consumer，清除 session 日志、草稿、pending 和计时器，并递增 generation。重连后通过只读 `Family` 重新读取当前归属。
- 家族归属变更不推送成员 UI；发送仍由服务端实时 membership 决定。被移除后客户端旧显示不能继续发送，返回 `FAMILY_CHAT_NO_FAMILY`。

## 局限

原 `btnFamilyChannel`/`btnFamily` 只证明按钮和布局。原家族频道数字、原发送/接收回调、线格式、服务器路由、成员关系、owner、权限、审批、拒绝回包和历史规则仍未恢复。原频道列表没有 `rdoFamily`，最小家族菜单项是当前 Web 采用。

本设计不实现或改变家族创建、加入、退出、审批、成员管理、游戏内 owner、grant、库存、账户 raw profile、公开/队伍/好友/GM/密语、房间广播或离线 mailbox。72 UTF-16 码元为当前重建规则；原 CEGUI Unicode 等价性和原始家族收件范围未证明。
