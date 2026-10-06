# 五模式业务规则与客户端计数合同

本文定义 M2-06 至 M2-10 的规则合同、快照字段和界面计数传播。它直接指导下一批实现，不替代原服务端 writer 取证。来源事实与项目采用政策分开记录；采用政策不冒称原 Windows 服务端逐行为复刻。

合同覆盖 `m001.dat` 至 `m005.dat` 的全部 26 行、25 张场景图。所有 `MapID`、`MapName`、`MapInfo`、`PlayerMin`、`PlayerMax`、`Time` 保持不变；支持房间继续按源行校验人数范围。

## 原来源事实

### 模式表和地图

| Web 模式 | 原客户端编号 | 名称 | 表 | 行/地图 | 人数范围 | 时限 |
| --- | ---: | --- | --- | --- | --- | --- |
| 1 | 0 | 团队 | `m001.dat` | 7 行：0002/0004/0005/0006/0007/0010/0011 | 4–10、4–12；0007 为 2–6 | 300 秒 |
| 2 | 1 | 占领 | `m002.dat` | 5 行：0002/0005/0006/0010/0011 | 4–8、4–10、4–12 | 300 秒 |
| 3 | 2 | 擒王 | `m003.dat` | 7 行：0002/0004/0005/0006/0007/0010/0011 | 4–6、4–8、4–10、4–12 | 300 秒 |
| 4 | 3 | 混战 | `m004.dat` | 4 行：0007/0014/0017/0018 | 0007 为 1–6，其余 4–12 | 300 秒 |
| 5 | 4 | 破坏 | `m005.dat` | 3 行：0020/0021/0022 | 4–12 | 180 秒 |

已验证表字段与源值：

| 字段 | 单位 | 已观察值 | 用途边界 |
| --- | --- | --- | --- |
| `Time` | 秒 | 模式 1–4 为 300；模式 5 为 180 | 自然时限 |
| `PlayerMin` / `PlayerMax` | 人数 | 上表范围 | 开局与容量资格 |
| `CatVsDog` | 源整数 | 全部 26 行为 0 | 猫狗阵营开关字段，当前建房没有独立可写来源 |
| `FriendFire` | 源整数 | 全部 26 行为 0 | 房间友伤默认字段，当前由支持房间设置采用 |
| `TankNum` | 整数 | 模式 1 全为 30；模式 5 全为 15；模式 2–4 为 -1 | 模式 1 的每方出击次数候选 |
| `BunkerHP` | HP | 模式 1 为 200；模式 2 为 5000；模式 3 为 2000；模式 4/5 为 0 | 城堡/碉堡规则生命候选 |
| `DefaultButt` | 整数 | 模式 5：123/77/34 | 破坏目标初始生命候选 |
| `ButtReborn` | 整数 | 模式 5：90/60/30 | 破坏目标重生生命候选 |
| `ButtRebornTime` | 秒 | 模式 5：15 | 目标重生间隔候选 |
| `VanishTime` | 秒 | 模式 5：10 | 源表字段；本文不把未证含义接到玩家复活 |
| `VIPHPMax` | HP | 模式 3：200 | 擒王生命上限 |
| `HitScore` / `DestroyScore` | 分 | 模式 5：10/0；其余按源行 | 命中与摧毁战斗分 |
| `BrokenScore` | 分 | 全部为 -10 | 友伤惩罚候选 |
| `WinScore` / `LoseScore` / `DrawScore` | 分 | 模式 1–3：50/-20/-20；模式 4/5：100/0/0 | 结算胜负分，本文不改变既有奖励合同 |

### 场景对象

25 张原图中：

| 模式地图 | Castle 放置 | Breach 放置 | 说明 |
| --- | ---: | ---: | --- |
| 0002 | 2 | 60 | Castle 304/305，尾字段归属为 1/2 |
| 0005 | 2 | 22 | Castle 128/129 |
| 0006 | 2 | 50 | Castle 81/82 |
| 0010 | 2 | 44 | Castle 93/94 |
| 0011 | 2 | 32 | Castle 176/177 |
| 0020 | 0 | 117 | 破坏模式 |
| 0021 | 0 | 73 | 破坏模式 |
| 0022 | 0 | 46 | 破坏模式 |

`SYcCastle` 的源记录身份、矩阵、模型和归属来自 `.cas` 放置；CAS 尾段当前导出初始生命为 2000。`SYcScnObjBreach` 的每条源放置有 ID、模型、矩阵和包围尺寸，但没有已恢复的 HP 字段。客户端 `45e7b0` 只把 Breach 切到破损模型并进入 0.5/秒淡出，不把参数解释为 HP；隐藏时清理模型包围并触发动态导航覆盖回调。

### 客户端通信与显示消费者

- `MsgRoomSnapshot.match` 已携带 `round`、`targetScore`、`teamLives`、`objectives`、`sceneObjects`、`result`；`teamScores`、`winnerTeam`、`winnerPlayerId` 在房间快照顶层。
- `PlayerSnapshot` 已携带 `team`、`hp`、`maxHp`、`alive`、`kills`、`deaths`、`isVIP`、`objectivesDestroyed`、`respawnAt`。
- 原 `OdlBattlefieldBulletin` 字段为 `m_iCatsInfo +0x0c`、`m_iDogsInfo +0x10`、`m_iDogTankNumb +0x14`、`m_iCatTankNumb +0x18`。前三类信息与坦克数量字段必须分离。
- 原团队 HUD 把 `CatsInfo`/`DogsInfo` 按本机猫/狗方位写入 `txtSelfInfo`/`txtEnemyInfo`，格式为 `%d`。当前 Web 的 `teamLives` 到这两个控件是已明确的重建映射。
- 原混战模式从角色属性 0x0a/`+0x28` 取本机击毁数并覆盖 `CatsInfo`；HUD 将 `CatsInfo + DogsInfo` 写入 `txtInfo`。`DogsInfo` 上游含义未取得。
- 原破坏模式从角色属性 0x15/`+0x314` 覆盖 `CatsInfo`；该计数递增触发未恢复，不能当作目标剩余数。
- 原 `m_bVIP` 是角色布尔属性，Web 模式 3 且 `isVIP` 为真时显示王徽章；原 `m_iHP`/`m_iMaxHP` 是角色生命字段。
- 当前 `hud-mode-info.ts` 已把模式 1 绑定 `teamLives`，模式 2 绑定 `teamScores`，模式 3 绑定双方 `isVIP` 角色 HP，模式 4 绑定本机击毁，模式 5 绑定存活 `DESTROY` 目标数。

### 房间设置

当前支持的模式、地图、房间名、密码、`minPlayers`、`maxPlayers`、队伍选择（模式 1–3）和 `friendlyFire`（模式 1–3）继续有效。`CatVsDog` 在原建房布局中只读，当前不新增可写设置。模式、地图和人数继续限于各源行；不得把非源表组合或 25 张地图都自动加入模式 1–5。

## 采用政策

本节是可实施合同。`source fact` 未证明的原服务端字段不进入 gameplay producer；需要选择的业务规则均给出确定值或确定比较顺序。

### 共通生命周期

1. 开局使用源表当前模式/地图行。`Time` 为自然时限，单位秒；测试运行参数只能覆盖模拟节拍，不能改写源行或客户端规则。
2. 普通玩家死亡后仍按现有重建值 3 秒复活；原表没有已恢复的玩家复活秒数字段，`ButtRebornTime` 不接到玩家。复活位置使用原图出生点的既有选点与碰撞门禁。
3. `PLAYING` 内普通玩家可复活，直到模式终局；模式 3 的王死亡即终局，不复活。
4. 友伤继续使用支持房间设置。关闭时队友命中不扣 HP，按 `BrokenScore` 惩罚；开启时普通受伤、死亡和复活链执行，但不奖励攻击者正值 `HitScore`、`DestroyScore`、击杀或胜利分。模式 1 的友方死亡仍消耗受击方出击次数；模式 3 的友方王死亡仍判对方胜。
5. 自然终局只有 `TIME_LIMIT`、模式目标 `OBJECTIVE` 和离场 `FORFEIT`。平局时 `winnerTeam=-1` 且 `winnerPlayerId=''`；结算名单仍按模式排序，并列第一名共享 rank，不把并列第一名升级为胜者。
6. 再战清空本局计数、目标 HP/重生计时、王、队伍生命、命中/摧毁和结果；不清理账户、成长、历史或已结算奖励合同。

### ModeGroupGame 计数与 UI 传播

服务端只通过现有 typed snapshot 发布以下权威计数，不新增原包偏移或未命名字段：

| 模式 | 服务端状态 | 快照字段 | Web 控件 |
| --- | --- | --- | --- |
| 1 团队 | 双方剩余出击次数 | `match.teamLives` | `txtSelfInfo`/`txtEnemyInfo` |
| 2 占领 | 双方对敌方 Castle 的累计伤害 | `teamScores`，上限 `match.targetScore` | `txtSelfInfo`/`txtEnemyInfo`，整数截断 |
| 3 擒王 | 双方王当前/最大 HP | `players[].isVIP`、`hp`、`maxHp` | `txtSelfInfo`/`txtEnemyInfo` |
| 4 混战 | 本机权威击毁数 | `players[].kills`，终局优先 `match.result.players[].kills` | `txtInfo` |
| 5 破坏 | 仍为完整状态的 Breach 目标数 | `match.objectives` 中 `DESTROY && hp > 0` | `txtInfo` |

传播规则：

- `WAITING`/`LOADING` 不显示计数；`PLAYING` 每 tick 发布变化；`FINISHED` 保留冻结终值；换局或离房清空。
- 缺失、非法或非有限计数保持空值，不补 0，不从本地击杀、旧公告或客户端状态反推服务器胜局。
- 模式 4 的 `CatsInfo + DogsInfo` 第二加数没有已确认业务含义，Web 继续显示本机击毁数；模式 5 的角色 `+0x314` 未证明等于剩余目标数，Web 继续显示权威 DESTROY 目标数。
- 模式 1/2/3 的双方映射按本机 `team`；模式 4/5 按 `playerId`。模式 3 只使用 `isVIP` 角色，不显示普通成员 HP 代替王 HP。

### M2-06 团队

**采用规则**

- 每方初始出击次数 `teamLives[team] = TankNum`。`m001` 全部地图为 30；`TankNum <= 0` 不构造耗尽胜利条件。
- 非友方死亡消耗受击方 1 次出击。次数降到 0 时立即 `OBJECTIVE`，对方队伍获胜，不再复活该队。
- 普通玩家死亡后在 3 秒后复活；复活不返还已消耗的出击次数。
- `friendlyFire=false` 时队友命中不消耗次数；`friendlyFire=true` 时友方死亡消耗受击方次数，攻击者不得正值奖励。该规则沿用已验证的友伤房间合同。
- 敌人命中使用 `HitScore`，击毁使用 `DestroyScore`；友方命中只使用 `BrokenScore`。
- 时限结束比较 `teamLives`，多者胜；相等平局。队伍内结算排序继续按击毁数、战斗分依次比较。

- 目标终局：对方 `teamLives` 为 0。
- 超时比较：`teamLives[0]` 对 `teamLives[1]`。
- 王/leader：团队模式没有王；本局 leader 仅为结算排序第一名，不产生额外胜负含义。

**实现边界**

`joinTeam` 继续使用现有平衡插入和 team0 平局规则；`initializeModeRound` 只从支持模式行取 `TankNum`，不把原公告 `TankNumb` 当出击次数。模式 1 的 Castle 仍沿既有环境/修复生命周期，不接入团队胜负。

### M2-07 占领

**采用规则**

- 移除临时 `radius=90` 中立圈和 30 秒驻留阈值，不再按圈内人数产生 `contested` 或每秒加分。
- 每张 `m002` 地图使用原 `SYcCastle` 放置作为占领目标。Castle 身份是 `sourcePlacementId` + `sourceModel` + 源矩阵位置；CAS 尾段归属 1/2 映射为 team0/1。
- 规则生命上限取 `BunkerHP`，即 5000 HP；不使用 CAS 导出的 2000 视觉初始生命作为 M2-07 目标身份或规则 HP。
- 玩家弹丸命中敌方 Castle 时，按实际投射物伤害扣减该 Castle 的规则 HP，并把同一伤害加到攻击方 `teamScores[team]`。同一 tick 多次命中按弹丸处理顺序结算；归属不因进入范围切换。
- `targetScore = BunkerHP`。`teamScores[team]` 是累计对敌方 Castle 造成的伤害，整数用于原 HUD 显示（截断小数）。
- 敌方 Castle HP 降到 0 时立即 `OBJECTIVE`，攻击方胜。比赛在任一 Castle 存活期间视为争夺中；没有中立半径、驻留暂停或额外占领计时。
- 时限结束时比较双方 `teamScores`，高者胜；相等平局。Castle 在单局内不重生、不掉落；再战按源 HP 恢复。

- 超时比较：`teamScores` 高者为 leader 并获胜；相等时不产生 leader，结果为平局。

**单位**

`BunkerHP`、投射物伤害、`teamScores` 均为 HP/伤害点；HUD 只显示整数截断值，`serverTime` 仍为毫秒。模式 2 不读取 `TankNum=-1` 造出击次数。

**实现边界**

`modes/objectives.ts` 的模式 2 生成器改为从 `getSceneCastles(mapId)` 取实际放置和目标归属；`advanceObjectives` 不再接收 `dt` 以累加占领时间。命中 Castle 走已有 `castleDamage`/目标扣血分支，但目标 HP 由模式 2 源字段提供，不复用模式 1 的视觉 HP cap。

### M2-08 擒王

**采用规则**

- 每队在开局时选一名 leader：按房间稳定参与者顺序选择该队第一名有效玩家，写入 `vip=true`；另一名队伍成员不设 VIP。再战重新选择，不沿用上局指针。
- 王的 `maxHp` 与初始 `hp` 取 `VIPHPMax`，模式 3 为 200 HP。普通成员继续使用现有生命来源。
- `m_bVIP` 只决定 Web 模式 3 的 `isVIP` 快照和显示；不把 `isVIP` 当作称号、勋章或其他模式属性。
- 王死亡立即 `OBJECTIVE`，对方队伍获胜；本局不复活王、不指定替补王。若王在 `PLAYING` 离场/断线结算，同样按 `FORFEIT` 判对方胜。
- 普通成员死亡按共通 3 秒复活；普通成员离场后若本队仍有其他成员则继续。
- 时限结束时先比较双方王当前 HP，较高者胜；HP 相等时比较双方队伍总击毁数，再比较队伍战斗分；仍完全相等则平局。

- 目标终局：任一方王 HP 为 0。
- 超时比较：王 HP，然后队伍击毁数，然后队伍战斗分。
- leader：本队王；结算中王不因死亡复活，平局不授予额外胜者。

**实现边界**

`initializeModeRound` 保持“每队首位玩家”策略但必须从稳定房间顺序决定，并在开局/再战重置。`applyModeKill`、`forfeitOutcome` 继续以 `vip` 为唯一王身份。VIP 生命只使用 `VIPHPMax`；未恢复的 role `+0x98` 倍率不得写入。

### M2-09 混战

**采用规则**

- 删除固定 10 次击毁阈值；模式 4 不设置击毁目标 `OBJECTIVE`。
- 玩家各自为战，队伍字段统一为 0，但结算胜负使用 `winnerPlayerId`，不使用共同 team 判胜。
- 普通敌人命中/击毁继续使用源 `HitScore`/`DestroyScore`；玩家死亡后 3 秒复活，直到时限、离场或结算。
- 时限结束按单人比较：击毁数降序，战斗分降序。唯一第一名胜；击毁数和战斗分都相等时平局，并列第一名共享 rank。
- 提前离场继续沿用现有 `forfeitOutcome`：剩余不足两人或个人模式合法弃权时，使用剩余首位玩家/明确规则判定；没有唯一 leader 时平局。

- 目标终局：无固定击毁阈值；只由时间或离场结束。
- 超时比较：击毁数，然后战斗分。
- leader：比较后唯一第一名；完全并列不产生 leader。

**实现边界**

`createWaitingRoom` 的模式 4 `targetScore` 改为 0 或不参与判断；`applyModeKill` 删除 `attacker.kills >= room.targetScore` 终局。`computeMatchResult` 继续按击毁数、战斗分排序，保留现有个人 `winnerPlayerId` 语义。

### M2-10 破坏

**采用规则**

- 每张 `m005` 地图使用全部实际 `SYcScnObjBreach` 放置作为规则目标池：0020 117 个、0021 73 个、0022 46 个。目标身份、模型和位置来自源放置，不使用当前临时三球体或未命名目标。
- 目标初始 HP 使用 `DefaultButt`：0020/0021/0022 为 123/77/34 HP。目标重生 HP 使用 `ButtReborn`：90/60/30 HP；重生间隔使用 `ButtRebornTime=15` 秒。`m005.BunkerHP=0` 不用于 Breach。
- 玩家弹丸命中目标时按实际伤害扣 HP；`HitScore=10`，`DestroyScore=0`。HP 降到 0 时目标进入销毁，停止继续受伤和计分，并增加摧毁者 `objectivesDestroyed`。
- `dropitem.dat` 只提供场景掉落类别到模型/声音/特效的映射，没有已恢复的 Breach 销毁到掉落类别 producer；本局目标不掉落。摧毁后目标在 `ButtRebornTime` 秒后按原放置重生，生命重置为 `ButtReborn` 值。再战重新按 `DefaultButt` 初始化。
- “全清”定义为本局当前目标全部同时处于 HP 0 状态；一旦成立立即 `OBJECTIVE`。若重生已发生，则继续到下一次全清或时限。
- 时限结束按本局累计 `objectivesDestroyed` 排序，再按战斗分排序；唯一第一名胜，完全相等平局。
- 目标销毁的现有 2 秒客户端淡出继续负责视觉状态；服务器在目标 HP 0 时停止伤害，客户端隐藏时移除该实例的动态 NAV/碰撞盒，重生时按同一源放置恢复动态碰撞。没有源证据支持的其他物体碰撞不新增。

- 目标终局：全部当前目标 HP 为 0。
- 超时比较：累计摧毁数，然后战斗分。
- leader：比较后唯一第一名；完全并列不产生 leader。

**实现边界**

`getSceneBreakables` 提供原实例身份/矩阵；模式 5 的 `createObjectives` 使用全部源 Breach，不再用 `room.map.bunkerHp || 200`。`damageObjective` 只按源 `DefaultButt`/`ButtReborn` 生命周期扣 HP。`syncBreachCollision` 在 HP 0、客户端隐藏和重生时增加/移除动态盒体，保持既有 `resetBreachCollision` 的换局清理。

## 建议文件归属

| 文件 | 职责 |
| --- | --- |
| `apps/server/src/config.ts` | 将 `DefaultButt`、`ButtReborn`、`ButtRebornTime`、`VanishTime` 保留为明确 typed source field；不改变现有成长/奖励字段 |
| `apps/server/src/modes/start.ts` | 模式 1 每方出击次数；模式 3 每队王选择和再战重置 |
| `apps/server/src/modes/outcomes.ts` | 模式 1 出击耗尽；模式 3 王死亡/离场；删除模式 4 固定 10 杀 |
| `apps/server/src/modes/objectives.ts` | 模式 2 Castle 伤害目标；模式 5 源 Breach 目标与重生 |
| `apps/server/src/battle/environment.ts` | Castle/Breach 规则 HP、销毁和掉落边界；不复用视觉 HP cap |
| `apps/server/src/battle/breach-collision.ts` | 模式 5 动态 NAV/碰撞盒销毁与重生 |
| `apps/server/src/battle/life.ts` | 普通玩家 3 秒复活、友伤、击毁分与模式回调顺序 |
| `apps/server/src/rooms/create.ts` | 模式 2/4/5 的 `targetScore` 初始化移除固定 30/10 |
| `apps/server/src/rooms/snapshot.ts` | 只按现有 `match.teamLives`、`teamScores`、`objectives`、`players` 投影计数 |
| `apps/server/src/settlement/match-result.ts` | 各模式超时比较、平局和唯一 leader |
| `apps/shared/protocols/MsgRoomSnapshot.ts` | 仅在现有字段不足时补 typed optional 字段；不得新增 writer 未证的原偏移 |
| `apps/web/src/interface/battle/team-info.ts` | 模式 1 本队/对队 `teamLives` |
| `apps/web/src/interface/battle/hud-mode-info.ts` | 模式 2–5 快照计数和终局冻结显示 |
| `apps/web/src/interface/battle/battle-hud-view.tsx` | `txtSelfInfo`/`txtEnemyInfo`/`txtInfo` 绑定和阶段清理 |

实施顺序：先闭合 `config`/`start`/`outcomes` 的出击、王、时限和 leader 规则；再替换 `objectives`/`environment` 的 Castle 与 Breach 生命周期；最后只调整既有 snapshot/HUD 投影。不得新增 feature flag、migration framework、兼容层或未知字段。

## 未确认来源

- `BunkerHP` 被采用为模式 2/3 Castle 规则 HP；原服务端逐字段 writer 尚未取得。CAS 导出 2000 HP 只作为源放置的视觉/记录值，不能作为 M2-07 目标身份。
- `DefaultButt`/`ButtReborn` 被采用为模式 5 Breach 初始/重生 HP，`ButtRebornTime` 为重生秒数；`VanishTime` 的服务端对象语义未恢复，本文不把它接到玩家复活或 NAV 生命周期。
- 原普通玩家复活秒数和 `TankNum` 在模式 5 的玩法含义未恢复；本文保留现有 3 秒玩家复活，不使用源对象重生秒数替代。
- 模式 4 的原击毁阈值没有源表字段；本文采用时限排行，不保留固定 10 杀。
- 原 `m_iDogsInfo` 在混战中的第二加数生产者、破坏模式角色 `+0x314` 的递增对象类型和原 server `ModeGroupGame` writer 未取得。Web 只消费本文列出的 typed 权威快照，不从这些未证字段生成业务结果。
- 原服务器完整目标选择、刷新、掉落、奖励和重连规则仍按各自任务项保持开放；本文件是下一批实现合同，不是原 Windows 服务端复刻声明。
