# React 库存快捷槽浏览器验收

E-R02-I 真实浏览器专项通过。`node tests/browser-react-inventory.mjs` 启动专属 Chromium、3131 服务端和 5190 Web，隔离数据库、账号和浏览器 profile，31 秒完成正常库存操作、短 CPU 对局及真实重启。

最终证据：

- `recovery/output/react-inventory-2026-10-03T15-02-39-940Z-summary.json`
- `recovery/output/react-inventory-2026-10-03T15-02-39-940Z.json`
- 同前缀 `.log`、`-server.log`、`-chrome.log`
- 同前缀 `-1920.png`、`-3840.png`

## 已验收行为

单个 React root 与 `interface/home/home-inventory.tsx` 的真实 JSX dialog 边界通过源码检查；视图没有 `document.createElement` 或 `innerHTML` 构造。Babylon 从现有 `render/scene-runtime.ts` 模块发现，界面使用普通 CDP 鼠标、键盘、原生 select 与 Chrome 原生拖放。

原物品图、数量、武器／道具页及原 XML 控件标识保持。1920×1080 与 3840×2160 的弹窗完整位于屏幕内，快捷槽尺寸遵循 800×600 的缩放，所引用原图全部成功获取。初始显式所有权夹具为弹药实例301、数量5，以及首件道具实例302、数量3；ASSIGN 先选择物品、等待 React commit，再点击快捷槽并核对真实数据库。

Delete、Backspace、右键 CANCEL 和从库存行拖入快捷槽均通过真实 DOM 交互与权威 hotkeys 断言。Escape 关闭后焦点返回普通“我的家”入口；重开保留页签，选择重置。保存完成后的快捷槽焦点支持继续键盘操作。

真实服务进程 SIGSTOP 暂停请求处理期间，保存状态可见，槽位保持原确认值、控件禁用。重复点击只发送一条 WebSocket 请求；关闭并重开后 SIGCONT 恢复处理，新窗口通过新 Inventory 请求读取保存结果，旧 mutation 不覆盖新窗口状态或选择。第二个重复点击目标槽保持空槽。

真实停服后普通 ASSIGN 返回 WebSocket 连接失败。选中物品、界面槽值和数据库 hotkeys 均保持。重启后正常刷新、重新登录和打开窗口恢复原账号及已保存槽位。第二个隔离账号显示空库存。

战斗消费使用单独明确的所有权夹具：在界面数量3验收结束后，操作员导入将实例302数量设为1，保留原实例和快捷槽，再真实重启。普通页面重新 ASSIGN 槽4，正常建房、添加三个 CPU、Ready 进入 PLAYING。普通 Digit2 成功选择弹药槽2。自然 CPU 伤害使本人 HP 为257/300、tick166，普通 Digit5 成功使账户道具数量1→0。返回大厅并再次真实重启，原账号、槽4→实例302和零库存显示均恢复。

最终专属3131、5190、9362端口无监听；临时数据库与 Chrome profile 已清理，证据日志保留。

## 复用证据

E-R01 的 `recovery/docs/react-match-browser.md` 覆盖两个自然局、双页面原 Effect11／GA15 表现及资源清理。本专项只执行配置后的一段短 CPU 对局，不重复自然两局或五模式。主线程的账户库存规则及原289边界专项覆盖服务端资格规则；本次页面失败路径使用真实停服，战斗期间遵循正常隐藏的账户入口。

## 限制

战斗内部渲染降采样为3，1080p／4K验证针对原库存界面布局与资源。原服务端成功消费及 CPU 策略仍为重建规则，本专项不扩张原版服务端保真结论。
