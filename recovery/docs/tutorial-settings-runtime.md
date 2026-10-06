# 大厅顶栏教学/设置/退出（UI-64 / M5-14）

正式大厅无房间时，在现 800×600 源 stage 顶端复用原 `tut_settings.xml` 顶栏。顶栏为根 `SheetWindow`（800×57，无图）加三个原按钮：`btnTutorial` 601,0,679,57、`btnSettings` 672,0,754,55、`btnClose` 750,0,800,51。三者按原 paintorder（tutorial → settings → close）依次绘制，矩形/相对缩放沿用现有 `useSourceUi`、`HomeSourceLayout`、`sourceProps`、`SourceImageScale`，未改坐标、未加通用间距。图像取自 `gy0` 图像集已导出的 `ui/regions/27/{20..25,44..46}.png`，未新增或重新生成任何资源。

## 三个真实回调

`btnTutorial` 采用规则：点击/键盘受信交互直接打开外部操作说明链接 `http://cdtank.joypark.com.cn/Guide/Key.htm`（linkstring.csv LinkID 4，`window.open(..., '_blank', 'noopener')`）。链接为原表来源 URL；btn 与原 LinkID 的绑定是采用规则，不是已恢复的 originalcallback。外部页面不改变当前账户/房间/输入，不做 fetch、无浏览器内容验收。

`btnSettings` 复用现 `SettingsSourceView` 与既有初始音量/八快捷聊天/键位状态保存规则，由 App 原 `quickChatOpen` open/close 控制，不建第二份设置数据。打开时记录来源按钮；正常 close/cancel/Escape 后焦点返回该 header 按钮，旧 Home 与登录设置入口的焦点行为不变（回退到 `#open-quick-chat-settings`）。

`btnClose` 复用 App 现有 `useLoginNavigation.exit`：`battle.disconnectAccount()` 停 `lobbyPresence` 并断连后进入 `closed`，随后 `reopen` 回登录。`disconnectAccount` 在 `inRoom` 时拒绝（“请先离开房间”），因此入口只在 `!inRoom && phase==='lobby'` 显示；不退对局、不删账户/localStorage、不改 profile、不新增 server 协议。无仓库规则要求退出确认，故不新建确认框。

## 生命周期与来源边界

入口只在正式大厅 `LobbyView`（实现位于 `interface/lobby/room-controls.tsx`）目录态挂载：`LobbySourcePage` 的 `headerContent` 仅当 `!inBattle && !waiting` 传入并渲染，Login/Channel/等待房间/Loading/Playing/Finished 均不渲染，隐藏或离场即卸载并释放 `useSourceUi` pending 资源。房间可见性取自 `LobbyView` 自身 `inBattle`/`waiting` 状态，未新增全局监听副本。`tut_settings.xml` 已存在于现 `ui.json`，无需新增 catalog 或生成器。

## 限制

- 外部说明页未做浏览器/内容验收，仅按原表 URL 打开。
- 设置页完整 107 控件与未知图形/循环原业务仍属 UI-50/M5-14 未完成范围，本片不扩大。
- 本次未运行测试/构建/类型检查/浏览器验收；按任务约定只做静态实现。
