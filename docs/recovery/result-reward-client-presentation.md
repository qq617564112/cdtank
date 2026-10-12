# 结算奖励与账户成长客户端呈现（UI-19 / UI-20）

覆盖原 `game_summary.xml` 整页与 `game_summary_award.xml` 子页对本次结算奖励和账户成长的呈现。奖励数值的唯一权威来源是快照内本机 `ResultPlayer.award`（服务端 receipt），缺 `award` 时保持空白，不发起任何本地推算、本地领奖或重放授予。

## 权威合同

- 快照 `MsgRoomSnapshot.MatchResult.players[].award?: ResultAward` 携带本次 `money/coin/originality/tech/rankPoints/levelBefore/levelAfter/expPercent`。
- 本机玩家由 `playerId` 精确匹配定位，不使用数组首项，也不对 CPU/旁观做猜测。
- 无 `award` 表示无权威 receipt（CPU、暂未 commit、失败待重试等），此时整页不显示成长带，子页不挂载。
- 数值按有符号十进制显示，零值即真实 receipt 的 `0`，正常显示。
- 升级/降级方向只由 `levelAfter` 与 `levelBefore` 比较得出，`expPercent` 只取自 `award.expPercent`。
- 客户端不请求账户余额、不自行计算奖励、不重放授予；`totalScore`/`combatScore` 继续表示既有战斗分与胜负分语义，不冒充原奖励。

## UI-19 整页成长带

在原 `game_summary.xml` 底部区域（`BottomPart`）接入，全部使用已发布 `ui.json` 中该布局的原控件几何与图片，不新增资源：

- `prgExp`：原 `ProgressBar` 位置（`54,10` 尺寸 `718×17`）。底层用其 `BackgroundImage`，上层用 `ProgressImage` 按 `award.expPercent` 百分比裁切，`0..100` 区间外夹紧。
- `txtExpPercent`：原控件位置，文本取 `award.expPercent`（`%` 后缀），`HorzCentred` 对齐沿用原属性。
- `picLv`：原控件位置（`jiejitubiaoditu` 内 `15,9` 尺寸 `24×24`）。等级图块从实际 catalog `jiejitubiao0` 目录 `lvNN.tga` 引用，`NN` 取 `award.levelAfter` 两位补零；目录中不存在对应等级区域时该图块留空，不造图。等级 `1..20`、`21..27`、`98/99` 只要目录内存在区域即可显示，不存在则不显示。
- `picLevelUp` / `picLevelDown`：原控件位置与图片，`levelAfter > levelBefore` 只显示升级图，`levelAfter < levelBefore` 只显示降级图，方向相等都不显示。

再战/状态文字为 Web 呈现，置于成长带下方的整页既有空带，不覆盖原 `prgExp`/`txtExpPercent`/`picLv`/`picLevelUp`/`picLevelDown` 控件几何，也不改动原成长控件几何与字体。原有 Score/Extra/rank/team/name、胜负结果、分页、再战与源 `btnClose` 语义保持不变；damage/Critical 相关动态图字不受本项影响。

## UI-20 奖励子页

新增 `battle-summary-award-page.tsx` / `.css`，使用原 `game_summary_award.xml` 已读 13 控件几何与图片：`wndDialog` 根 + `pic/daibitubiao/chuangyidian/jinengdian` 四图标 + `lblMoney/lblCoin/lblOriginality/lblTech` 四标签 + `txtMoney/txtCoin/txtOriginality/txtTech` 四数值。

- 四数值直接取本机 `award.{money,coin,originality,tech}`；符号、零值按原 `%d` 有符号十进制直显语义呈现。
- 四标签为固定原文（金钱/星币/创意点/技能点），不随数值变化。
- 不点亮 `pic*Award*`/`picShowPrize`/奖章等无权威 producer 的图块。

触发采用政策（原触发/关闭事件未取得）：当 FINISHED 且本机 `award` 首次到达时附着显示一次。该判定按本机 `round` 记忆，因此：

- 迟到的持久化重试、重连新页面首次拿到同一 `award` 时仍会挂载一次。
- 同一 `round` 收到新 snapshot 或对象重复发布时不重复弹出。
- 关闭后同一 `round` 状态继续 tick 不再弹；`round++` 独立领奖可再次弹出；`leave` 卸载重置。
- `false→true` 的延迟 `award` 在同一 `round` 内允许弹出一次。

交互与焦点（原 `game_summary_award.xml` 无按钮控件，关闭按钮放在对话框底框之外）：

- 采用原生 `<dialog>` modal 焦点捕获；弹层打开时锁定底层整页键盘，中文 IME 合成态（`isComposing`/`keyCode 229`）不触发战斗键。
- `Tab` 在弹层内循环；点击关闭按钮、`Enter` 或 `Escape` 走同一关闭所有权：先解除 modal 再聚焦整页 summary 的源 `btnClose`，卸载清理不覆盖焦点。
- 关闭仅收起弹层，不影响服务端 receipt；原整页 Ready/Rematch/pending/votedCancel 语义保留。

## 未实测

- 未执行真实服务器对局，未验证冻结结果与快照 `award` 的端到端一致。
- 未做双网页/重连/重启持久化验收。
- 未做浏览器/三分辨率视觉验收、build/type/lint 自动验证。
- 原奖励 producer（基础金额、资格、舍入、账户写链）与原 `game_summary_award.xml` 触发/关闭事件仍未取得，本呈现不等价于原事件还原。
- 原 185 控件 1:1、EXP 条像素级精度与原字体间距未验收。
