# 玩家目标家族资料运行时

玩家资料页原`txtPlayerFamily`位置按已确认目标`PlayerProfile.family?.name`显示目标当前家族。原公开家族producer（原`txtPlayerFamily`服务端/客户端来源）未恢复；本项采用现有`family_memberships`只读归属映射，不新增家族管理页、查询他人的参数或route。

## 协议与服务端

`ResPlayerProfile`在既有property id0..8后手工追加property id9 `family?:{id:string;name:string}`；内联对象id0 `id`、id1 `name`均可选。`serviceProto`手工增量：`PlayerProfile` api57保留、现新增`PlayerSearch` api64保留，version递增至120；不运行protocolgenerator。

`registerPlayerProfileApi`要求连接已认证，先经`AccountStore.playerProfile(targetAccountId)`做目标存在校验（不存在映射`PLAYER_PROFILE_TARGET_NOT_FOUND`），再读取经现`FamilyStore.family(targetAccountId)`的目标当前归属，仅在存在时附`family`。读取不使用认证owner归属、不默认猜值，也不返回成员列表、`assignedAt`、私聊或钱包字段；家族写入仍仅在operator。

## 客户端

`LobbySocialView`只创建一次稳定`queryPlayerProfile`并传给`PlayerInfoView`。资料页打开或target变化时按generation发起一次`PlayerProfile`查询；`txtPlayerFamily`只在同一目标已确认response里取`family?.name`，其余情况保持空。未查询、未传query、确认无family、查询失败且没有已确认family时均为空，不猜填。

等待房间目前不传`targetAccountId`/`query`，保持其空family，不虚构房间账户关联，也不扩大WaitingRoom query关联。家族只读确认目标id/name，不改好友/屏蔽关系、QQ、个人介绍、level icon或公开role icon消费者。

## 生命周期

每次打开或target变化开始新generation；关闭、切页、进房、交易接管、断线或卸载使旧generation失效，迟到成功与迟到失败均不写入新资料。查询失败保当前目标与已有response，在资料页局部重试；重试只重发该目标`PlayerProfile`。重开资料页重新query，能反映目标家族最新名称或撤回。

## 来源边界与未实测

目标当前family Web映射已知并落地；原公开family producer仍未恢复。当前交付仅为源码接线，本批已完成一次集中静态走查，未运行测试、浏览器、构建、类型检查、原生取证或音频播放。目标字段显示、generation、局部retry、真实页面、真实联机、持久重启与HD仍未实测，M5-13/M6-09/UI-41/UI-42/UI-43完整父项保持未勾。
