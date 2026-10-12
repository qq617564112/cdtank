# 独立发行目录

M8-02 已接受本机独立发行运行范围。`npm run release:package -- <新目录>` 组装已构建的 Web、编译服务端、固定运行依赖锁文件、原内容表、启动入口、运维说明和账户备份命令。发行目录不携带账户存档。

在包内 `server` 运行 `npm ci --omit=dev --ignore-scripts`，再从任意工作目录运行 `node <发行目录>/start.mjs`。资源默认来自包内 `web` 与 `content/tables`，账户库默认写入 `state/accounts.sqlite`。环境变量可覆盖这三个路径。静态站点与 `/game` 反代配置见包内 nginx 示例。

`tests/standalone-release-network.cts` 从临时目录启动完整发行包，清除仓库资源路径和 Node 模块路径覆盖，独立安装依赖。真实两个空账户认证、昵称、地图目录、创建与加入房间、双端玩家快照、正常退出及新建房间消失均通过。冷重启后同凭据恢复同账户身份与昵称，另一账户库存仍为空。未导入资金、角色或库存。

HTTP 检查通过测试静态服务读取正式 HTML、入口 JavaScript 和实际战斗目录资源。依赖解析路径在发行包内部，运行不依赖仓库源码或开发依赖。

证据索引：`recovery/output/standalone-release-accepted.json`。专属严格类型检查与实际网络验收通过；Web 使用已通过的 `lobby-intimate-production-web-build.log`，服务端使用当前既有编译产物。

## 未完成范围

本片验证本机隔离发行目录与实际 nginx 反代。真实独立设备访问及远端浏览器整页仍未验收，M8-02 父项保持未完成。

## 本机 nginx 正式页面验收

`recovery/output/release-proxy-accepted.json` 已接受真实 nginx 1.22.1 反代范围：两个普通 Chromium 账户加载发行包正式页面，通过同源 `/game` 完成 101 升级、创建与加入房间、等待页中文公共聊天双端可见、双端正常退出与刷新身份保持。860 个实际 HTTP 响应没有 4xx，入口 JavaScript MIME 正确。大厅及等待页 1920 完整画面已主审。未使用账户、名单、资金或库存夹具。

此段使用隔离 prefix/临时账户库，不改系统 nginx 配置或启动系统服务。`tests/browser-release-proxy.mjs` 与原 nginx 示例配置对应。真实独立设备访问仍待验收，M8-02 父项保持未完成。
