# 战斗 HUD 源面板与五模式信息呈现

M5-04 / UI-09 与 M5-05。`battle-hud-view.tsx` 现在按 `ui/layouts/game_main.xml` 的
完整 165 控件父树恢复源 HUD，不再用 `selectedSet` 只挑局部：顶部道具栏
`daojulan`（由 `hud-item-source-view.tsx` 独占）、左右两组各六名玩家
`picPlayer0..11`、姓名/称号 `txtPlayerName*`/`txtPlayerTitle*`、VIP 标志 `picVIP*`、
头像与 `prgPlayerLife`、右下 `picMiniMap`/`picMiniMapBound`、底部生命与弹量
`prgLife`/`prgBullet`、准星 `prgCrossbar`、战斗信息面板 `picBattleInfoPanel`/
`edtBattleInfo` 以及开场遮罩 `picFight`/`picModeSplash`/各模式 splash 均在同一棵树内。
`btnExit` 仍由 `BattlePlayPage` 的真按钮拥有，HUD 不复制；`daojulan` 也不在 HUD 树内重复。

## 弹量与快捷栏

`prgBullet` 使用原 `4cb52f` 语义：宽度为 `capacity × 15`，进度为
`remaining / capacity`，数据完全来自 `HudCombatSnapshot.magazine`。`Default2001`
为无限供给，`Cheap` 字体的 `#` 映射原 `wenxian.tga`（`ui/regions/2/0.png`，15×14），
因此数量槽以原无限图呈现而不留空。

快捷栏 `slot2..4` 的数量优先取 `HudCombatSnapshot.ammoSlots` 中对应的真实
`quantity`，回退到 `Inventory.battleQuantity`；`slot5..8` 取确认的本局
`battleQuantity`。选中槽只认 `selectedAmmoSlot` 的确认 `1..4`，协议默认值0映射第一槽；金色选中框采用当前 Web 呈现策略。`lengque1..4`
仅在确认的有效选中槽和活着玩家存在未结束 `reload` 期限时按 `serverTime` 显示剩余遮罩与秒数；`lengque5..8`
只在 `activeEffects` 期限有效时显示效果遮罩与剩余秒数，这些剩余时间显示已由用户确认；点击弹药槽选弹、点击道具槽立即使用，沿同一服务端输入，不本地改库存或消费资格。

## 小地图

`hud-minimap-view.tsx` 独立订阅小地图快照，在原 `picMiniMap`(608,408,192,192,Alpha0.5) 内显示本图原场景的俯视捕获。25图分别读取NAV和全部RPT出生点，采用包含这些原位置的固定正方形范围；底图与标记共用 `hud-minimap-bounds.ts`。原世界+X向右、+Z向上，本机朝上箭头按 `yaw` 旋转。详见 `hud-minimap-coordinate-source.md` 的逐图范围与600出生点像素表。

本机使用原 `wotanke.tga`，敌我使用 `danke.tga`，目标使用 `diaobao.tga`，擒王使用 `viptanke.tga`。只显示存活且观察者可见的玩家；模式1–3按队伍区分敌我，模式4/5本人以外都是对手。原八边框独立于内容Alpha0.5。地图边界可用时即使俯视底图尚未就绪也照常投影玩家与占领/破坏目标；未知地图且无固定边界时才不显示标记。

## 五模式信息

团队存量、占领分、王血量与剩余目标已由用户确认采用，见 `battle-hud-confirmed-rules.md`。

`game_main_info_team/conquer/vip/melee/destroy.xml` 各模式主要区域按原树绘制，
含原图标与布局乘号 `txtMultiply.Text=*`。数字来自 `HudSnapshot.modeInfo`：
mode1 现 `teamLives`（本队/对队交换），mode2 占领分，mode3 双方 VIP 当前 HP，
mode4 本机 kills，mode5 存活 `DESTROY` 目标剩余数；缺失合法字段保持 undefined
而不补 0。占领分按原整数格式截断显示。`match.result` 存在时保持本局最终状态，WAITING/LOADING/离房/新局清旧值。
有玩家的槽在 `title` 为空时默认显示称号表ID1“嗷嗷待哺”，真实称号优先，空玩家槽保持空白；源 `picVIP*` 在模式3按 `player.isVIP` 显示。原HUD没有独立勋章控件，世界标签勋章来源仍未取得。

## 阶段与开场

当前阶段、介绍时长和开始门禁已由用户确认采用。模式提示2秒、Fight1秒期间所有坦克不动，提示播放完才进入实际计时与移动。

开场采用本局 `PLAYING` 的 Web 呈现政策：模式背景与当前模式图显示2秒，随后仅显示Fight图1秒，再隐藏。客户端HUD不再独立`setTimeout`，而沿`snapshot.serverTime`加收到后真实frame elapsed显示剩余提示；重连只显示剩余而不重播。`roomId/round`与战斗显隐变化清理旧状态。开始deadline来自`MatchSnapshot.battleStartsAt?:number`，服务端毫秒时间；模式提示/Fight期间服务器不推进运动/CPU/托管/射击/道具/占领/伤害，拒绝普通input和pose，`remaining`恒定`timeLimit`，deadline后首active dt只含deadline之后时间。没有新phase/flag，LOADING保留旧资源门禁，再战重新deadline。原 native 阶段 producer 仍未恢复。

## 数据订阅

`BattleHudView` 分别以 `subscribeCombat`、`subscribeMinimap` 和道具库存 store
拆出三个 leaf，主 `getSnapshot/subscribe` 仍只在可见投影变化时通知；频繁 movement 只通过 minimap 快照进入小地图；serverTime、弹量、库存和效果变化分别更新 HudItemPanel/BulletControl，不因 combat 订阅重绘整棵 HUD。所有快照字段、clear及换房/换round清理由BattleHud负责，UI只消费公开方法。

## 限制

未执行完整原UI帧循环、原场景小地图虚方法或原Windows GPU像素对照。原阶段和动态纹理的完整producer、原世界标签勋章及部分公告上游仍有取证边界。当前称号文字接 `PlayerSnapshot.title.name`，缺值默认原ID1“嗷嗷待哺”。既有宠物头像证据按原范围复用；新增点击、俯视地图和标签样式没有浏览器/高清验收。
