# 大厅普通 GM 问题提交客户端业务设计

M6-08-GM-LOBBY / M5-12 / UI-03。本文覆盖无房间大厅普通已认证玩家从原大厅频道菜单进入 GM 问题提交的采用链。不新增 GM 身份、人工客服后台、收费、Family、grant、API、schema 或轮询。

## 来源事实

原大厅频道菜单 `chat_channellist_lobby.xml` 含 `rdoGM`，原 `chat.xml` 含 `btnGMChannel`。原客户端普通频道 6 构造 `UMsgChatGM` 后发送，gamestring 810 是系统自动回复。原服务端大厅 GM 单独处理程序、人工处理界面、客服回复推送及大厅 `rdoGM` 单独回调未取得。

现有战斗/等待 GM 提交已复用频道 6、`gm_requests` 与自动回复。本文不把它宣称为完整原 GM 系统恢复。

## 采用规则

大厅已认证、尚未入房的普通玩家打开原频道菜单时，`rdoGM` 可选；选择后显示原 `chat.xml/btnGMChannel` toggle，输入框保持普通聊天布局，发送复用现有 `RoomChat { text, channel: 6 }`，不新增客户端广播消息或新的协议字段。

服务端 `apps/server/src/rooms/chat.ts` 将频道 6 分支放到无 session 拒绝之前，但仍在认证账户门禁之后：

- 认证账户必需，未认证返回 `ACCOUNT_REQUIRED`。
- 有 session 时保持原当前房间玩家真实存在校验。
- 无 session 的大厅提交写空字符串 `room_id/player_id`，不授予房间、角色或 GM 权限。
- text 继续按原房间 GM 校验：`typeof string`、raw length `1..72`、trim 非空、无控制码。
- 仅在成功校验后调用 `AccountStore.submitGmQuestion`，复用 `gm_requests` 持久表。
- 插入失败返回原有失败码，不返回成功、不广播、不改房间或账户状态。
- 其它频道仍要求 session；房间内/等待中 GM 行为保持。

不新增 replay receipt、取消、自动重试、收费、GM 身份、人工处理页、客服推送、Family 路由或公共/好友/密语广播改动。

## Web 消费

前端归属：

- `apps/web/src/network/lobby-chat.ts`
- `apps/web/src/interface/lobby/lobby-chat-channel.tsx`
- `apps/web/src/interface/lobby/lobby-chat-view.tsx`

频道 union 增加 `gm`；原四菜单可选，`rdoGM` 与 `btnGMChannel` 使用原图像和 toggle 状态，输入仍为普通 input，保留中文 IME、caret、pending、selection、focus 和 generation 生命周期。发送成功后仅为本人大厅会话日志追加两条本地记录：

```text
[GM] <trim 后问题>
[系统] <服务端自动回复>
```

两条记录使用稳定、不冲突的本地 ID，并带当前连接可用的 `accountId`（不可用时为空字符串）及 `channel: 'gm'`，满足现有 history 消费 shape。成功日志只存在本页面会话，不进入公共广播或聊天持久表。100 条会话历史上限、公共/好友/密语/房间消息 dedupe 与其它频道路由不变。

失败保留草稿、状态和 pending 规则；成功只在草稿未变化时清空。离房、session reset、断线或迟到响应使 generation 失效，不把旧请求复活到新会话；pending 防止重复提交。不自动重试、不跨 generation 重放。

## 范围与剩余验收

本批已接正式实现接线，未执行测试、浏览器、构建、类型检查、重启或原生/证据脚本。原大厅 GM 单独回调、原服务端处理程序、原客服回复推送和完整页面 1:1 仍开放；人工回复采用闭环已独立接入并见 [gm-support-replies-runtime.md](gm-support-replies-runtime.md)，不替代这些原服务边界。`M6-08-GM-LOBBY`、`M5-12`、`UI-03` 及完整 `M6-08` 父项保持未勾。

人工回复采用链另见 [gm-support-replies-runtime.md](gm-support-replies-runtime.md)：原频道 6 提交与 gamestring 810 自动回复保持不变，本机 operator 在同库写入单条最终回复，玩家从认证账户只读分页查询并接收每秒定向推送；原人工处理程序和原客服推送属于未取得的原始服务边界，不影响本采用闭环。实际联机、离线重登录、重启与 HD 未实测。

