# 战斗剩余接线集中审计

本页集中登记当前静态核对中仍存在、且与正常战斗入口、原操作差异或目录可达范围有关的缺项。已接的五模式 Breach 掉落、当前12项 `breachDropOrder` 池、地面掉落回收、装备结算与账户扣分、战斗提示音、道具立即使用与武器循环、模型碰撞、项目垂直物理、10 秒复活，以及已补作发布的模型与纹理均不在此重复。

| 项 | 类别 | 当前差异 | 源码路径 | 现有边界 |
| --- | --- | --- | --- | --- |
| H | production已接，实测待做 | 战斗附属聊天：Family 按钮、归属与路由仍未接；GM 原提交与 gamestring 810 自动回复保持，本机 operator list/reply 共享 SQLite 单条人工回复，玩家仅按认证账户只读分页查询并接收每秒定向推送，Web 回复入口显示问题、回复、时间与会话未读。 | `apps/server/src/support/gm-support.ts`；`gm-operator.ts`；`gm-support-api.ts`；`apps/web/src/network/gm-support.ts`；[gm-support-replies-runtime.md](gm-support-replies-runtime.md) | Family 消费者仍缺；实际 operator、玩家联机、推送、离线重登录、重启与 HD 未实测，完整父项不勾。GM 原服务端人工处理程序和原客服推送未取得，本闭环为 Web 采用。 |
| I | 低优先级不可达能力 | Type10 屏幕后处理 index5 后端仍 throw；原库 type10 有 4 节点。既有原审查的当前技能可达树不经过 Type10。 | `apps/web/src/render/effects/runtime/effect-runtime.ts` `createTree` | 当前技能可达树不经过 Type10，属目录能力缺口。 |
