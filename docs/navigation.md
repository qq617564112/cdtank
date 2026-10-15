# 路由与会话恢复

浏览器 URL 记录当前页面、房间 ID 和主要弹窗标识。页签、角色实例、玩家资料、房间草稿及购买选择保存到当前标签页的 `sessionStorage` 和浏览器历史状态。登录使用现有账户 token；当前频道保存在 `localStorage`，房间的账户 ID、房间 ID 和玩家 ID 保存在当前标签页的 `sessionStorage`。

路由由原生 History API 与 React 外部状态订阅连接，同一次交互的状态变化合并为一条历史记录。URL 表示页面入口，历史状态保存该条记录的界面选择，会话缓存恢复刷新后的选择。服务端快照决定房间阶段。

| 路径 | 页面 |
| --- | --- |
| `/login` | 登录 |
| `/channels` | 频道选择 |
| `/lobby` | 大厅 |
| `/rooms/R1` | 等待房间 |
| `/rooms/R1/battle` | 战斗载入与战斗 |
| `/rooms/R1/results` | 对局结算 |
| `/closed` | 已退出游戏 |

例如 `/lobby?dialogs=shop` 打开商城，商城页签从当前标签页的缓存恢复。`/rooms/R1/battle?dialogs=settings` 表示房间 R1 的战斗页面打开设置窗口。内部恢复数据写入 `cdtank-navigation-state` 会话缓存及 `history.state.cdtankNavigation`；房间密码和登录密码保留在内存中。

快速开局入口 `/quick-start?map=2&tank=1` 的地图和战车参数用于指定新对局，进入正式页面后会清除这些参数。

刷新后先恢复账户和频道，再调用 `ResumeRoom` 获取原玩家的服务端快照及输入序号。恢复期间保留当前 URL 并显示加载界面，完成后显示对应页面；账户或频道自动恢复失败时进入登录页并显示错误。等待、载入、战斗和结算阶段均可恢复。战斗重新载入场景资源；退出战场确认框重新请求当前处罚报价，提交操作仍由玩家确认。页面路径跟随服务端阶段变化。

浏览器前进、后退全局拦截，从资源加载开始保持当前页面、弹窗和选择。页面启动时添加同 URL 的历史记录，浏览器触发同文档历史遍历时写回当前路由，清除前进分支，不恢复旧界面状态。浏览器导航键、鼠标侧键和 Command+左右方括号被拦截；输入框外的 Alt+左右方向键及 Backspace 不触发浏览器导航，输入框内继续删除文字，并保留 Alt+方向键的文字光标操作。根页面禁止水平滚动链引发的侧滑导航。窗口、页签和返回操作使用游戏内按钮，整页刷新继续恢复当前路由及缓存。

玩家仍在房间时，页面路径保持与实际房间一致；离开房间使用现有退出操作。主动退出房间清除房间缓存，返回登录或退出游戏清除自动登录缓存。

清理界面状态后，会话缓存及历史状态中的内部选择同步失效，换账号后使用当前账户的默认选择。

生产服务器将页面路径映射到 `index.html`，资源请求继续按原路径处理。

## 主屏幕 Web App

Vite 的 `web-app-plugin.ts` 为 HTML 入口链接源码中的 `apps/web/game.webmanifest`，开发和发行地址均为 `/manifests/game.webmanifest`。开发服务器返回 manifest JSON，构建时作为固定路径资源输出；manifest 随程序发布，不依赖独立素材包更新。应用名称、短名称及 Apple 主屏幕名称统一为「阿猫阿狗大作战Online」。安装图标沿用标签页的客户端 ICO 图案：iPhone 使用 `apple-touch-icon` 的 180×180 PNG，Android manifest 提供 192×192 和 512×512 PNG。图标位于 `assets/ui/images/app-icons/`，由 HD 源图经配方保留 PNG 后发布。

应用身份 `id`、启动地址 `start_url` 和导航范围 `scope` 均为 `/`，显示模式为 `standalone`。频道、大厅、房间、战斗和结算的同域 History API 路由均在范围内；GitHub 等外部链接继续打开浏览器。iPhone 入口还提供 Apple 主屏幕模式及状态栏配置。

站点需通过 HTTPS 打开。更新前添加的主屏幕入口建议删除后重新添加；iOS 26 添加时保持“作为网页 App 打开”开启，Android Chrome 使用安装应用入口。从普通浏览器标签页打开仍显示浏览器界面。

导航范围规则见 [MDN scope](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/scope)，Android 安装与图标见 [Web App Manifest](https://web.dev/articles/add-manifest)。当前配置尚未进行 iPhone 或 Android 真机验收。

## 限制

- 网页不能禁用浏览器工具栏本身，也不能拦截跨文档跳转，例如浏览器跳过同文档历史记录，或从历史菜单直接选择其他网站。历史拦截、快捷键及侧滑限制尚未浏览器实测。
- 房间沿用现有 30 秒断线保留窗口；账户认证恢复必须在窗口内完成。超过窗口、房间被关闭或服务端重启后，回到大厅重新选择房间。
- 房间恢复使用当前标签页保存的玩家身份。单独打开房间 URL 时，仍需通过大厅加入房间。
- 购买、出售和交易的在途请求及结果提示沿用现有服务端确认流程；刷新不会自动提交这些操作。
