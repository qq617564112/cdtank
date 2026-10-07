# 玩家资料来源与公开接口合同

本文定义 M5-13/M6-09/UI-41、UI-42、UI-43 剩余消费者可直接执行的客户端、shared 和 server 归属。来源分为三类：原 XML/已发布 `ui.json` 的直接事实，当前生产实现的直接事实，以及为缺失目标账户读取明确采用的最小公开查询政策。未取得的原 producer、QQ 绑定和原统计附着不标成已恢复。

## 原布局事实

已发布 `recovery/output/web-assets/ui.json` 保留三份原布局：

| 布局 | 路径 | 控件数 | 事实 |
| --- | --- | ---: | --- |
| 在线/好友目录 | `ui/layouts/playerlist.xml` | 9 | 根 `haoyou` 为 `610,97..800,600`；`PlayerList` 为 `9,58..179,478`，`SelectionImage=data\ui\mycabin0\xuanzhong.tga`；`FriendTab`/`PlayerTab` 为源 RadioButton，`picFriendTabSelect`/`picPlayerTabSelect` 为源选中图。 |
| 玩家资料 | `ui/layouts/playerlist_playerinfo.xml` | 35 | 根 `SheetWindow` 为 405x391，`picLowerPanel` 底边 405 且不裁父；姓名/状态/资料字段、Add/Remove 好友、Add/Remove 屏蔽、邀请、交易、Close 和两个统计 RadioButton 都是独立源控件。 |
| QQ 小页 | `ui/layouts/playerlist_QQ_number.xml` | 3 | 根 `all` 为 151x59；`kuang` 为 28,26..142,54 九块原框；`txtQQnumber` 为 36,32..135,48 居中白字。只证明一个小页存在，没有原 `btnQQ`、调用者、目标 URI 或 QQ 号 producer。 |

三份布局合计 47 个控件。

## UI-41 逐项合同

| # | 源控件 | 当前消费者/处置 |
| ---: | --- | --- |
| 1 | `haoyou` | `LobbySourcePage` 以 `SourceStaticImage` 保持原根位置和源九块图。 |
| 2 | `datingmingchengditu` | 大厅使用原图；等待房间用同一源图片作为牌匾背景。 |
| 3 | `datingmingcheng` | 大厅静态显示“大厅”；等待房间按真实房名投影。 |
| 4 | `datingzhuangtai` | 未挂载。没有已确认的独立状态 producer，保持空置且不改几何。 |
| 5 | `PlayerList` | `LobbyPlayerListView` 使用原区域/透明底/原 SelectionImage；行选择是本地 UI 状态，真实账户身份来自公开 presence/friends 行。 |
| 6 | `FriendTab` | `LobbySocialView` 以 `SourceButton selected` 驱动好友页，使用源 radio 图态。 |
| 7 | `PlayerTab` | 同一视图以源 radio 图态驱动在线玩家页。 |
| 8 | `picFriendTabSelect` | 好友页时显示源选中图。 |
| 9 | `picPlayerTabSelect` | 在线玩家页时显示源选中图。 |

`PlayerList` 的滚动、选择、焦点、键盘和好友/黑名单普通查询已存在；本设计不替换它们，也不把行选择提升为服务器好友关系。

## UI-42 逐项合同

| # | 源控件 | 当前消费者/剩余要求 |
| ---: | --- | --- |
| 1 | `SheetWindow` | `PlayerInfoView` 原 405x391 根。 |
| 2 | `picBackgroundMask` | 原 `zhezhaotu` 遮罩，保留外延和 modal backdrop。 |
| 3 | `anniulanditu` | 原蓝条与左右图。 |
| 4 | `shangditu` | 原资料上框九块图。 |
| 5 | `anniuditu2` | 原透明附着框，保留。 |
| 6 | `btnEnlarge` | 原按钮，未恢复展开业务；保持禁用源图。 |
| 7 | `heseditu` | 原灰底。 |
| 8 | `picLowerPanel` | 原下框九块图，根可见区到 405。 |
| 9 | `xiaotiaoditu` | 原按钮底纹。 |
| 10 | `rdoBattleSummary` | 原战斗统计 radio。当前以 Web 父容器伴随页挂接 `myhome_playerpage_battlesummary.xml` 原页图片与文字控件，消费所选目标 `PlayerProfile.statistics`；原资料页内统计子页附着/偏移仍未取得。 |
| 11 | `rdoAwardSummary` | 原获奖统计 radio。当前以同一 Web 父伴随页挂接 `myhome_playerpage_awardsummary.xml` 原页图片与九计数文字控件，消费所选目标 `PlayerProfile.awards`；原统计附着仍未取得。 |
| 12 | `xiaochaditu` | 原 Close 父框。 |
| 13 | `btnClose` | 原三态 Close；当前关闭资料并返回原 player row，保留原生 Escape 与焦点规则。 |
| 14 | `shangmianditu` | 原资料背景。 |
| 15 | `txtPlayerStatus` | 当前由公开 `online/inRoom` 投影为在线/房间中/离线。 |
| 16 | `txtPlayerName` | 当前用账户权威 display name；目标读取继续使用同一公开身份字段。 |
| 17 | `txtLobbyName` | 源 `Visible=False`，保持隐藏。 |
| 18 | `txtPlayerTitle` | 当前优先使用公开 friend/lobby/blacklist 行的 worn title，也接受目标公开资料查询的确认 title；未知保持空。 |
| 19 | `txtPlayerFamily` | 同一目标已确认 `PlayerProfile.family?.name` 显示于原位置；未查询、不传 query、确认无 family 或失败无已确认 family 时空。不得由昵称/accountId/称号猜测。 |
| 20 | `txtPlayerOriginality` | 目标确认 profile 的 `playerSummary.originality`，或确认 `growth.originality`；无确认保持空，不补 0。 |
| 21 | `txtPlayerTech` | 目标确认 profile 的 `playerSummary.tech`，或确认 `growth.tech`；无确认保持空。 |
| 22 | `txtPlayerScore` | 目标确认 profile 的 `playerSummary.score`，或确认 `growth.rankPoints`；无确认保持空。 |
| 23 | `picPetIcon` | 无目标选择角色公开来源；保持空。房间内可使用既有房间 `petId` producer，不能把 accountId/name 当图标。 |
| 24 | `picTankIcon` | 无目标选择角色公开来源时保持空；房间内已有真实 `tankId` 且 `waitingTankReference` 可解析时显示源图。 |
| 25 | `txtRoomNumber` | 无公开房号字段时保持空。当前 `roomDetails.roomId` 可作为房间上下文显示，不等于原房间编号。 |
| 26 | `edtPlayerDescription` | 无公开个人介绍 producer 时保持空；房间内既有 `tankId/petId/team/ready` 详情继续可用，不作为个人介绍。 |
| 27 | `tiao` | 原分隔图，保留。 |
| 28 | `xiaodong` | 原空图标位，保留。 |
| 29 | `picLevelIcon` | 无确认等级图标源；保持空。数值 `growth.level` 存在不代表原图标 producer 已恢复。 |
| 30 | `btnAddFriend` | 原 Add 图，当前接权威未好友状态和 `friends.change('ADD')`。 |
| 31 | `btnAddBlacklist` | 原屏蔽图，当前接权威未屏蔽状态和 `blacklist.change('ADD')`。 |
| 32 | `btnInvite` | 原邀请按钮，无已确认资料页邀请业务时保持禁用源图；未证明确到外部对象不发消息。 |
| 33 | `btnExchange` | 原交易按钮；当前只在双方均在大厅、目标在线且已有正常交易请求边界时发送既有 `trade INVITE`。 |
| 34 | `btnRemoveFriend` | 与 Add 同坐标，权威 `isFriend` 时切换并发送既有 `REMOVE`。 |
| 35 | `btnRemoveBlacklist` | 与 Add 同坐标，权威 `isBlocked` 时切换并发送既有 `REMOVE`；无 DisabledImage 不另造灰化图。 |

## UI-43 QQ 小页

`playerlist_QQ_number.xml` 只有 `all`、`kuang`、`txtQQnumber` 三个源控件。正式实现应保持 151x59 小页、原九块框和 36,32..135,48 居中白字。

原来源未取得 `btnQQ`、打开小页的调用、外部 QQ URI/联系人动作或 QQ 号 producer。因此：

- 不把 `accountId`、登录名、昵称、房间字段或 token 当 QQ 号。
- 不从缺失数据生成默认 QQ、性别、家族或私有文本。
- 不自动打开外部地址、不执行联系人消息、不通过 QQ 小页联系第三方。
- 只有未来取得原绑定和明确公开 QQ 业务时，才挂接真实 popup。当前可实现的 QQ 契约是“目标公开资料查询不包含 QQ 字段”；UI 不显示空小页冒充业务。

## 公开资料查询

现有 `RoleProfile` 是认证 owner 的账户操作，读取 raw `profile`/`playerSummary/growth/titles/statistics/awards`，不能直接用于查看其他玩家。现有 `LobbyPlayers`、`Friends`、`Blacklist` 只安全公开 `{accountId,name,title?}` 和关系/在线/房间状态。

当前实现登记一个窄的客户端到 server 查询，名称为 `PlayerProfile`：

```ts
export interface ReqPlayerProfile {
  targetAccountId: string;
}

export interface ResPlayerProfile {
  accountId: string;
  name: string;
  level?: number;
  score?: number;
  originality?: number;
  tech?: number;
  title?: {id: number; name: string};
  statistics?: {
    wins: number; losses: number; draws: number;
    winStreak: number; loseStreak: number; battleSeconds: number;
    kills: number; deaths: number;
    shots?: number; hits?: number; damage?: number; killCombo?: number;
    spentMoney?: number; spentTokens?: number;
  };
  awards?: {
    perfect: number; mvp: number; savage: number; console: number; brave: number;
    kind: number; crafty: number; shy: number; greedy: number;
  };
}
```

请求只含目标账户 ID。返回字段都是已确认的公开业务字段；未知字段省略，UI 显示空，不补 0。`name` 沿 `AccountStore.displayName`，`title` 沿 `AccountStore.currentTitle`，`level/score/originality/tech` 沿目标真实持久 `account_growth`；没有 typed growth row 时只读已存原 `role_profiles` summary 的 score/originality/tech，不用 `DEFAULT_GROWTH` 补 0，level 保持空。`statistics/awards` 沿 `AccountStore.statistics/awardCounts` 的历史聚合，真实 aggregate 0 可显示 0，旧行缺可选 `roundStats` 或 awards 时对应字段保持空。查询不返回认证 token、密码、私有 raw profile bytes、`profile.strings`、好友/黑名单关系或聊天内容。当前共享 schema 版本为 112。

`PlayerProfile` 只读目标已经持久化的账户资料。它不得调用 `selectTitle`、授予称号、改钱包、改库存、改关系、建房或触发结算。目标账户必须已存在；不存在返回 `PLAYER_PROFILE_TARGET_NOT_FOUND`。未认证返回 `ACCOUNT_REQUIRED`。自己可读自己，沿用同一确认字段，不授予额外权限。

建议的归属：

| 文件 | 责任 |
| --- | --- |
| `apps/shared/protocols/PtlPlayerProfile.ts` | 声明 request/response 窄公开字段。 |
| `apps/shared/protocols/index.ts` | 导出 `PtlPlayerProfile`。 |
| `apps/shared/protocols/serviceProto.ts` | API 表与类型表登记 `PlayerProfile`，service id 57。 |
| `apps/server/src/accounts/player-profile.ts` | 读取 typed `account_growth`，缺 row 时只读已存原 summary 三字段。 |
| `apps/server/src/account-store.ts` | `playerProfile(targetAccountId)` 组合 display name/current title/growth/statistics/awards 窄 reader，不暴露 payload。 |
| `apps/server/src/social/player-profile.ts` | 注册查询；从认证连接取 owner，验证 target 存在，组装窄字段。 |
| `apps/server/src/index.ts` | 在现有 social API 注册区调用。 |
| `apps/web/src/network/accounts.ts` | 薄认证 transport：`playerProfile(targetAccountId)` 调用 API `PlayerProfile`。 |
| `apps/web/src/match/battle.ts` | 暴露薄公开方法，供资料页读取一个目标。 |
| `apps/web/src/interface/lobby/player-info.tsx` | 管理目标 generation、pending、迟到响应清理和资料查询重试，绑定现有 35 控件中的真实字段。 |
| `apps/web/src/interface/lobby/player-info-summary.tsx` | 消费同一目标 response，挂接两张 Home 原统计页图片与文字控件，并管理本页资源重试。 |

`PlayerProfile` 不替代 `Friends`、`Blacklist`、`FriendChat`、`LobbyWhisper` 或 `Trade`。好友/屏蔽 Add/Remove、密语和交易 server 业务保持现状。

## 资料页字段绑定

| UI 字段 | 来源 | 缺失处置 |
| --- | --- | --- |
| 姓名 | 公开身份行或 `PlayerProfile.name` | 空 |
| 在线/房间状态 | 现有 presence/friend/blacklist 公开行 | 离线状态文字 |
| 称号 | 公开行 worn title 或 `PlayerProfile.title` | 空 |
| family | 目标确认 `PlayerProfile.family.name` | 空 |
| level | 目标确认 growth | 空；当前只作 Web summary caption，不伪造 `picLevelIcon` |
| score | 目标确认 growth rankPoints，回退确认 playerSummary score | 空 |
| originality | 目标确认 growth，回退确认 playerSummary | 空 |
| tech | 目标确认 growth，回退确认 playerSummary | 空 |
| 战斗统计 | 目标确认 `statistics` | 空；不填 0 |
| 获奖统计 | 目标确认 `awards` | 空；真实 0 才显示 0 |

`rdoBattleSummary` 和 `rdoAwardSummary` 在当前实现中打开 Web 父容器伴随页，读取所选目标的 `PlayerProfile.statistics/awards` 响应；两页只复用既有 Home 统计页的原图片、文字控件和内部几何，不请求 owner history fallback，也不声称恢复原资料页内统计子页附着。已有 `AccountStatistics` 和 `AwardCounts` 结构可直接复用，但当前 server owner 为本账户；目标查询返回同样的已确认子集，不改变既有 Home 页面消费者。

## 生命周期与选择

打开资料页时，root 固定 `{accountId,name}`。UI 先显示公开身份和关系状态，再发起一次 `PlayerProfile`。`LobbySocialView` 传入稳定的 `battle.playerProfile` 查询函数；每次打开或 target 变化增加查询代次；关闭、切到好友页、进入房间、交易接管、断线或卸载使旧代次失效，迟到成功和迟到失败都不得写入新资料。pending 时禁用好友/屏蔽/交易写按钮，避免陈旧确认覆盖当前目标，既有关系状态保持不变。

`PlayerProfile` 失败不影响既有好友/屏蔽状态。资料页仍可关闭；失败保当前目标与已有响应，并由资料页局部重试重新查询。原资料 sheet 资源加载失败继续使用既有 `PlayerInfoResourceFeedback`；summary 资源失败在伴随页内局部显示并可重试，不因任一资源失败伪造原布局成功。

summary 只准备所选统计页实际需要的 `/ui.json` 图片：`prepareSourceUi([suffix])` 等待真实图片 decode 后再发布布局；图片请求或 decode 失败进入 summary 局部错误与重试。summary retry 只重准备该页资源，保留当前目标和已确认 `PlayerProfile`，不重发资料查询，也不请求 owner history。

关闭资料页沿用现有语义：Close/原生 Escape 返回打开它的实际 player row；若该行不存在则在可用的原列表根上恢复焦点。好友/屏蔽操作确认后仍在各自原位恢复焦点。

## 不改变的现有范围

以下已经存在且正确，本文不要求重做：

- `playerlist.xml` 9 控件的区域、选择图、页签切换和普通列表键盘/滚动。
- `playerlist_playerinfo.xml` 35 控件的原几何、图层、三态按钮和当前 Add/Remove 好友/屏蔽流程。
- 普通好友/黑名单 QUERY/ADD/REMOVE、在线/房间投影和持久规则。
- 资料页 Close/Escape、资源失败反馈和普通交易/私信边界。
- 我的家 `AccountGrowth`、`AccountStatistics`、`AwardCounts` 现有 producer/consumer。

## 来源与采用政策

来源事实：三份 XML/`ui.json` 控件与几何；现有 `PtlFriends`、`PtlBlacklist`、`PtlLobbyPlayers`、`PtlRoleProfile` 字段；`AccountStore` 的 display name/title/growth/statistics/awards reader；现有资料页、目录页、好友/屏蔽/交易消费者。

采用政策：`PlayerProfile` 作为目标账户只读公开资料查询，未知字段省略且不填 0；family 只读确认目标当前归属 id/name，无 owner 默认、noquery 仍空，不改关系/QQ/介绍；QQ 3 控件在缺原绑定/producer 时保持 source-only；`rdoBattleSummary`/`rdoAwardSummary` 通过 Web 父容器伴随页挂接既有 Home 原统计页并消费所选目标 response，不请求 owner history；迟到响应按代次隔离。以上政策不声称恢复原 server 资料查询、原 QQ 行为或原统计子页附着。

## 未完成与未实测

- 原 `btnQQ`、QQ 打开动作、外部 URI、联系人动作和目标 QQ 号 producer 未取得。
- 目标当前 family Web 映射已知并落地；原 family producer 未取得。描述、房号、宠物/坦克公开图标和 level icon producer 未取得。
- 原统计子页在资料页的附着/偏移未取得；当前只有既有统计与奖章页面消费者。
- `PlayerProfile`、目标字段显示、统计伴随页和局部 resource retry 已实现；真实页面、QQ popup、三分辨率、真实联机和持久重启仍未实测。
- UI-41、UI-42、UI-43、M5-13 父项不得因本文关闭。
