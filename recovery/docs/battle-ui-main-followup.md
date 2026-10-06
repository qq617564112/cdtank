# 战斗主 HUD 补充接入

M5-04 / M5-05。本轮只补齐 `game_main.xml` 主树中尚有原依据的真实显示状态，
沿用既有 800×600 源矩形、原图块解码产物与 CDTank-Xiangjiao 动态文字。
本文记录本轮来源、已实施状态与限制，不构成完整高清/原版视觉验收。

## 来源

- 原控件与属性：`/workspace/cdtank/recovery/output/verified/assets/data/Data/ui/layouts/game_main.xml`
  及其 `game_main_info_team/conquer/vip/melee/destroy.xml`。
- 称号字段与表链：`battle-hud-title-source.md`、`battle-hud-confirmed-rules.md`。
  账户称号持有/选用与持久投影，以及 `PlayerSnapshot.title` / `HudPlayer.title`
  接线见 UI-39 与 `battle-hud.ts`（`player.title?.name`）。
- 装填与弹量消费者：`reload-hud-source-sol.md`。
- 八槽布局与业务合同：`hud-item-source-page.md`。
- 团队/破坏数值消费者：`team-info-source.md`、`destroy-info-source.md`。
- 权威状态与订阅边界：`battle-hud-authority-state.md`、`hud-m505-integration.md`。

## 已实施状态

### 十二槽姓名/称号/头像/VIP/生命

- `txtPlayerTitleN` 对占用槽位在缺少已确认称号时显示原表 ID1“嗷嗷待哺”，有权威
  `PlayerSnapshot.title.name` 时优先显示；绑定标记相应为 `default-title-1` 与
  `confirmed-title`。空玩家槽不放文字、不放标记，父控件随 `picPlayerN` 隐藏。
  `HudPlayer.title` 承载已接通并持久化的已选用称号（`battle-hud.ts` 明确从
  `player.title.name` 读取），默认文字只是缺值时的界面呈现策略，不写入账户持有/选用。
- `picPlayerPanel6..11` 与 `picPlayerIcon6..11` 复原原 `Orientation=FlipHorizontal`：
  右侧六槽的框体与宠物头像水平镜像，槽内姓名/称号文字保持正向。
- 姓名、称号、头像、VIP、生命的源矩形、`Alpha` 与进度条三段色沿既有
  `HudLayout`/`SourceProgress` 消费者；VIP 仅在 Web 模式 3 且 `isVIP` 时显示。

### 弹匣、选中槽与倒计时

- 默认炮弹槽显示原无限图 `ui/regions/2/0.png`；`prgBullet` 以
  `width = f32(capacity×15)`、`fraction = f32(remaining/capacity)` 显示有限弹匣。
- 选中弹槽只认权威 `selectedAmmoSlot`（协议默认 0 映射第一槽），第一至第四槽的
  冷却遮罩只在有效选中槽且存在未结束 `reload` 时按 `serverTime` 显示。
- 第五至第八槽的遮罩与剩余秒数只表示当前 `activeEffects` 期限有效，不作为施法冷却，
  也不授权新一次使用；消耗与选中只取服务端确认结果。

### 五模式数字

- 团队显示 `match.teamLives`，占领显示 `teamScores`（按原整数截断），擒王显示双方
  `isVIP` 玩家当前 `hp`，乱斗显示本人 `kills`，破坏显示存活 `DESTROY` 目标数。
- 零值照常显示，权威字段缺失时保持空白而不是补 0；`PLAYING` 显示、`FINISHED`
  保留本局终值，等待/载入隐藏，换局/离房清空。乱斗第二个原加数 `DogsInfo` 未取得
  业务含义，不参与显示。

## 限制

- 本批未运行测试、构建、类型检查或浏览器验收；新增镜像与文字状态未做原版视觉对照，
  M5-04、M5-05 父项保持未勾选。
- 十二槽的 `ClippedByParent` 默认裁剪未单独实现：占用槽的原控件矩形均落在其父
  矩形内，或不裁剪的槽位本就不需要裁剪，未建立会产生可见差异的溢出场景。
- 原始旧服务端 producer 未恢复属于来源边界：角色 `m_iNowTitle` getter / 称号 table
  事实与“typed Web snapshot 已按 `title.name` 采用”是两条独立事实，不能据此写当前
  功能缺失。世界标签勋章、原动态小地图纹理 producer 与原阶段 producer 仍按各自来源
  文档保留边界。跨所有权接线若需调整，记于对应模块来源文档。
