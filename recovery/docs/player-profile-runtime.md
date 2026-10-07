# 玩家公开资料运行期

本文登记M5-13/M6-09/UI-41、UI-42、UI-43的玩家公开资料运行期接口。来源事实为三份原布局共47控件、原统计页两张Home布局、原角色资料reader和现有好友/黑名单/交易/密语业务；`PlayerProfile`目标公开读取和统计伴随页附着为当前采用的Web业务边界。

## API与服务端

共享协议新增`PtlPlayerProfile`，service id 57，紧随`TankUpgrade`：

```ts
interface ReqPlayerProfile {
  targetAccountId: string;
}

interface ResPlayerProfile {
  accountId: string;
  name: string;
  level?: number;
  score?: number;
  originality?: number;
  tech?: number;
  title?: PlayerTitle;
  statistics?: AccountStatistics;
  awards?: AwardCounts;
  family?: {
    id: string;
    name: string;
  };
}
```

`registerPlayerProfileApi`在`apps/server/src/social/player-profile.ts`注册处理器，认证映射来自现有连接账户表。未认证返回`ACCOUNT_REQUIRED`；目标账户不存在返回`PLAYER_PROFILE_TARGET_NOT_FOUND`。处理器只调用`AccountStore.playerProfile(targetAccountId)`，不做账户、房间、好友、交易或钱包写。

`AccountStore.playerProfile`的执行顺序：

1. 先确认目标账户存在。
2. 读取已持久`account_growth`；存在时返回typed level/rankPoints/originality/skillPoints。
3. 无growth row时只读已存原`role_profiles` summary，返回已确认score/originality/tech；不调用`DEFAULT_GROWTH`，不把未知成长填0，level保持省略。
4. 读取`currentTitle`、`statistics`和`awardCounts`。title缺省省略；statistics走现有历史聚合；awards只在存在真实award行时返回。
5. family经现`FamilyStore.family(targetAccountId)`读取目标当前归属，仅在存在时返回`{id,name}`；不使用认证owner归属或默认猜值。
6. 响应只含公开窄字段，不含raw profile bytes、strings、token、好友/黑名单关系、聊天内容或QQ字段。

统计聚合保留真实零：history aggregate wins/losses/draws等可为0并显示0。旧history行缺可选`roundStats`时，shots/hits/damage/killCombo按unknown省略；缺awards时奖章计数保持unknown。`battleSeconds`沿既有`account_title_playtime`。

`ResPlayerProfile`在property id0..8后手工追加property id9 `family`（内联对象id0 `id`、id1 `name`）。手工serviceProto增量保留`PlayerProfile` api57与现新增`PlayerSearch` api64，version递增至120；不运行protocolgenerator。

## 客户端

`AccountConnection.playerProfile(targetAccountId)`是认证transport薄代理，调用`PlayerProfile`；`Battle.playerProfile(targetAccountId)`直接转给账户连接。`LobbySocialView`只创建一次稳定查询函数并传给`PlayerInfoView`。

`PlayerInfoSession`固定当前`{accountId,name}`。每次打开或target变化开始新generation；关闭、切页、进房、交易接管、断线或卸载使旧generation失效，迟到成功与迟到失败均不能写入新资料。pending期间禁用好友、黑名单和交易写按钮，关系/presence状态保持。查询失败时保留当前目标和已有response，在资料页局部显示并可重试；重试只重发该目标的`PlayerProfile`。

等待房间调用点不传`query`，保持原无账户资料查询行为。

## 资源与统计伴随页

原资料页三张布局控件几何保持不变。两统计radio由资料页session控制打开模式，并渲染`PlayerInfoSummary`：

- 战斗统计消费同一`ResPlayerProfile.statistics`，映射既有`myhome_playerpage_battlesummary.xml`原图片和文字控件。
- 获奖统计消费同一`ResPlayerProfile.awards`，映射既有`myhome_playerpage_awardsummary.xml`原图片和九计数控件。
- 两页不请求owner history RPC，不复用Home owner-history fallback；只读取所选目标已经返回的response。
- summary使用`prepareSourceUi([suffix])`收集该页实际图片并等待decode，成功后发布布局；图片请求或decode失败进入summary局部error/retry。
- summary retry只重准备当前统计页图片，保留当前目标和已确认`PlayerProfile`，不重发资料查询。

资料sheet自身资源失败仍走`PlayerInfoResourceFeedback`。Close/原生Escape返回实际player row；player row不存在时回退可用原列表根焦点。

## 未恢复与未实测

原`btnQQ`、QQ小页调用、外部URI、联系人动作和QQ号producer未取得；当前不显示QQ空popup，也不访问外链。原个人介绍、房号、公开宠物/坦克图标、level icon和原公开role icon producer保持unknown，不猜填。目标当前family Web映射已知并落地，原public family producer仍未恢复；等待房间不传query保持空family，不虚构房间账户关联。

原资料页统计子页附着/偏移未恢复；当前为Web父容器伴随页。目标字段显示、generation、error retry、resource失败、真实页面、真实联机、持久重启和HD仍未实测或验收。M5-13/M6-09/UI-41/UI-42/UI-43完整父项保持未勾。
