# 五模式目标与模式显示客户端呈现（M2-07 / M2-09 / M2-10）

覆盖正式战斗页面五模式目标说明、`game_main_info_*.xml` 数字控件和正式小地图对目标的呈现。业务规则与快照字段以 `mode-client-business-design.md` 为准，服务端 core 字段以 `mode-core-runtime.md` 为准；本项只消费既有 typed 快照，不新增协议字段、目标 payload 或本地胜局推算。

## 模式 2 占领（真实城堡）

目标生成改为源 `SYcCastle` 放置，`match.objectives` 中 `kind='CAPTURE'` 携带 `sourcePlacementId`/`sourceModel`/源矩阵位置，`ownerTeam` 为城堡归属（源 1/2 映射为 team0/1），`hp`/`maxHp` 取 `BunkerHP=5000`。玩家弹丸命中敌方城堡按实际伤害扣减城堡生命并累计到攻击方 `teamScores`，敌方城堡生命降到 0 立即终局；没有中立半径圈、驻留计时或按圈内人数加分的规则。

正式 `BattlePlayPage` 目标说明按本机队伍显示敌方城堡当前/最大生命、本队累计伤害与对方累计伤害，并沿用既有 `targetDirection` 提示朝向敌方城堡；不再出现“驶入占领圈、独占累计 X 秒”的旧重建文案。`hud-mode-info` 的 `binding` 保持 `teamScores`，`label` 反映为城堡伤害；原数字控件 `txtSelfInfo`/`txtEnemyInfo` 仍按本机队伍映射双方累计伤害并按原整数截断显示。

## 模式 4 混战

删除固定 10 次击毁阈值后不再有击毁目标终局。正式目标说明改为时限内击毁数最多者获胜、击毁数相同比较战斗得分、完全相等为平局，并显示本机权威 `kills`。`hud-mode-info` 的 `txtInfo` 继续绑定本机 `kills`，终局优先 `result.players[].kills`。

## 模式 5 破坏

目标改为全部源 `SYcScnObjBreach` 放置，初始生命取 `DefaultButt`，被毁后按 `ButtRebornTime` 秒在原位置重生、生命重置为 `ButtReborn`。全部当前目标同一时刻生命为 0 时立即终局；时间结束时按本局累计 `objectivesDestroyed` 再比较战斗分，完全相等为平局。正式目标说明显示完好目标数与已重生的含义，不把“仅剩目标数”表述成一次摧毁即不再回来；`hud-mode-info` 的 `txtInfo` 继续绑定 `match.objectives` 中仍处于完整状态的 `DESTROY` 目标数，即当前权威 `hp > 0` 计数。

## 目标标记

模式 2 城堡与模式 5 Breach 由原场景实例负责渲染：`ScenePreview` 按 `sourcePlacementId` 载入源模型、破损动作与重生生命周期，规则生命由权威快照驱动。`BattleTargets` 不再为任何带 `sourcePlacementId` 的目标生成中立圆盘/占领球或破坏占位球，避免在这些实体之上重复绘制；模式 3 的王标记保持原样。目标在终局冻结、再战或离房时与既有 `clear`/换局清理一起释放，不遗留网格与材质。

## 小地图

正式小地图在 `battle-minimap-renderer.ts` 中按 `match.objectives` 投影 `diaobao.tga` 标记。模式 2 的标记为源城堡位置，标题写明城堡并带有该城堡的源身份，不再表示为占领圈；标记只按权威 `ownerTeam`/`hp` 着色，不依据本机客户端状态推算胜局。

## 未完成范围

本项未运行单元、浏览器、构建、类型检查、lint 或 native/evidence，未新增或修改 tests，也未实测城堡扣血终局、双方累计伤害比较、破坏目标重生节奏或小地图实际投影。原有伤害/治疗/暴击动态图字与用户字体不受本项影响。
