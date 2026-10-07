# GM 人工回复本地闭环运行说明

M6-08-GM-回复 / M6-08-GM-LOBBY / M5-12 / UI-03。本文登记本批 Web 采用的人工回复本地闭环：原大厅与房间 GM 问题提交入口不变，继续使用频道 6、`gm_requests` 和 gamestring 810 自动回复；新增本机 operator 在同一 SQLite 写入单条人工回复，玩家从认证账户只读查询并按 50 条分页完整回填，服务端每秒定向推送新回复，正式页面显示问题、回复、时间与本页面会话未读。原服务端人工客服后台、远程 GM 权限和原回复推送均未取得，本文不宣称完整原 GM 服务恢复。

## 数据与共享协议

`apps/server/src/support/gm-support.ts` 在同账户 SQLite 初始化 `gm_replies`：

- `id INTEGER PRIMARY KEY`
- `request_id INTEGER NOT NULL UNIQUE`
- `text TEXT NOT NULL`
- `created_at INTEGER NOT NULL`

每道 `gm_requests` 问题至多一条最终人工回复。写入事务先验证原问题存在，再校验文本为 string、原始长度 1..72、trim 非空且无控制字符；数据库失败回滚，不返回成功确认。相同 trim 文本重复提交返回既有回复，不新增记录；不同文本提交已存在问题明确拒绝，也不覆盖。现有账户、角色、库存、`gm_requests` 字段和其它表不做迁移或改写。

共享协议位于 `apps/shared/protocols/PtlGmSupport.ts` 与 `apps/shared/protocols/MsgGmReply.ts`：

```ts
export interface GmSupportReply {
  id: number;
  requestId: number;
  question: string;
  requestedAt: number;
  text: string;
  repliedAt: number;
}

export interface ReqGmSupport {
  afterId?: number;
}

export interface ResGmSupport {
  accountId: string;
  replies: GmSupportReply[];
  nextAfterId: number;
  hasMore: boolean;
}

export interface MsgGmReply {
  accountId: string;
  reply: GmSupportReply;
}
```

`serviceProto` 只追加 `GmSupport` API id 59 与 `GmReply` msg id 60，既有 service ID 和字段不变。查询错误码为 `ACCOUNT_REQUIRED`/`GM_SUPPORT_REJECTED`，未认证请求走账户门禁，查询失败走支持查询拒绝。

## 服务端只读查询与定向推送

`AccountStore` 初始化 GM support 模块，并公开 `gmSupportReplies(accountId, afterId = 0): ResGmSupport`。查询把 `gm_replies` 连接原 `gm_requests`，只取 `gm_requests.account_id = 认证账户` 的行，不接收玩家提交的目标账号：

- `afterId` 是安全整数且不小于 0。
- 按回复 id 升序最多返回 50 条；`nextAfterId` 是最后返回 id，空页保持传入 afterId。
- 服务端读取第 51 条判断 `hasMore`，为 true 时本轮不注册 live 游标；末页成功回复的 `postApiReturnFlow` 校验 `GmSupport`、`isSucc`、`!hasMore` 与当前账号后，才以 `conn.id + accountId + afterId` 开始该连接的推送游标。
- 认证账户即使尚无角色资料也可以查询，查询不创建 profile。

`registerGmSupportApi(server, accounts, accountByConnection)` 使用当前连接认证 ID 查询，公开 API 仅要求登录；大厅 `WAITING`、`PLAYING`、`FINISHED` 均可只读查询，不接受账户参数，也不授予 GM 身份或远程处理权限。

服务端每秒执行一次单飞轮询，不使用每连接 timer 或无限并发；timer 随 server 生命周期并在 unref 后运行，房间阶段不影响。轮询按各连接保存的账号游标读取新回复，只向当前认证账户的连接逐条发送 `MsgGmReply`，不向房间广播，也不发送给其它账号。发送返回 `!isSucc` 时本连接本轮停止且不推进游标；成功才前移，失败保留重发；断连或认证身份变化移除旧游标。多页 backfill 期间不会让 push 游标越过尚未读取的页；每次 QUERY 开始都会清旧订阅，读当前分页后再订阅。多个只读连接可用同账号各自独立游标，UI 负责串行分页。

服务端发送成功只表示该次 WebSocket 写成功，不记为持久已读，也不删除回复。玩家离线后重新登录，QUERY `afterId: 0` 可从同库完整读取既有回复；服务重启后仍从同一 SQLite 回复表恢复。

## 本机 operator

`apps/server/src/support/gm-operator.ts` 是本机人工处理入口，使用与 runtime 相同的 `ACCOUNT_DB_PATH`，默认是仓库根目录下的 `recovery/output/accounts.sqlite`；命令显式要求该库文件已存在。`list` 读取未回复问题并按 id 升序最多 50 条，打印合法 id、account、原 room、player、问题文本与时间；`reply <questionId> <text>` 在同一个 SQLite 事务写人工回复并输出持久 id。该入口只在本机写共享库，不接入远程 GM 权限，不创建 fake player/账户，不授币或商品；玩家网络 API 保持只读。

以下命令只作为 review 示例，本批未执行：

```bash
cd /workspace/cdtank-worktrees/tasklist-gm-replies-docs-ax1007
ACCOUNT_DB_PATH="$PWD/recovery/output/accounts.sqlite" node --import tsx apps/server/src/support/gm-operator.ts list
ACCOUNT_DB_PATH="$PWD/recovery/output/accounts.sqlite" node --import tsx apps/server/src/support/gm-operator.ts list --after 123
ACCOUNT_DB_PATH="$PWD/recovery/output/accounts.sqlite" node --import tsx apps/server/src/support/gm-operator.ts reply 123 '中文回复'
```

## Web 回复入口

`apps/web/src/network/gm-support.ts` 的 `GmSupportInbox` 使用唯一认证 transport。`Battle` 暴露只读 `gmSupport` 实例，沿用当前连接；inbox 订阅 `MsgGmReply` 和账户上下文，初始 authenticated/context generation 每次变化都会重置记录、错误、未读与游标。身份缺失不查询；`ensureConnected` 前后都检查 context；过期回复和推送按 `accountId` 与 generation 拒绝。

QUERY 单飞，按 `nextAfterId` 逐页读取直到 `hasMore` 为 false。backfill 游标与 push 游标独立；push 与 query 按回复 ID 去重并按 id 排序，不会因 push 的较大 id 跳过尚未读取的页。连接或查询失败保留当前已确认 rows 并显示错误，页面提供显式“重试读取”，从 0 重新补全并去重；不伪造成功，也不自动反复重试。

`apps/web/src/interface/support/gm-support-view.tsx`/`.css` 在正式 authenticated game 页面挂载，未登录或未连接时不显示；独立“GM回复”按钮附未读数，轻量 modal 显示问题、回复与时间，覆盖载入、空、失败、重试状态，并处理 `aria-live`、label、Enter/Escape、IME、焦点回到来源和 resize。大厅、准备和战斗页面都可打开，不依赖 battle chat visible/sourceActive。回复按纯文本显示，不解析 markup。

已读 ID 只保存在当前页面 session；关闭重开且账户 context 不变时保留，同账号断线产生新 context 后清空本 session 已读，回到历史消息按本 session 未读处理。持久回复本身不删除。收到的 push 只进入该认证账户 inbox 并更新未读，不进入房间公开消息，也不写入其它账户 history。切换账户会关闭旧 modal 并清显示，避免新账户看到旧稿内容。

## 范围与实测限制

本批只实现 Web 采用的人工回复闭环，原大厅 GM 单独回调、原服务端人工处理程序、原客服回复推送和完整页面 1:1 仍开放。整批唯一 gpt-5.6 集中静态走查已完成；发送返回 `!isSucc` 时本连接本轮停止且不推进游标，末页成功回复的 `postApiReturnFlow` 校验 `GmSupport`、`isSucc`、`!hasMore` 与当前账号后才建立订阅。实际 operator 执行、玩家联机、每秒推送、离线重新登录、多连接、真实服务重启、HD 页面和 source 实测仍未执行；`M6-08-GM-回复`、`M6-08`、`M5-12`、`UI-03` 及其父项保持未勾。
