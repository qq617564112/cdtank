# 运行与账户存档

使用 Node.js 24.16 或更高版本。Web 构建为 `npm run build`，服务端构建为 `npm run build:server`。将 `dist/web` 作为静态站点发布；`index.html` 是正式玩家入口，`validation.html` 是独立验证入口。WebSocket `/game` 转发到服务端，示例见 `nginx.conf.example`。

## 独立发行目录

完成两端构建后，将已构建的 Web、编译服务端、运行依赖锁文件和内容表打包到新目录：

```sh
npm run release:package -- /srv/cdtank
cd /srv/cdtank/server
npm ci --omit=dev --ignore-scripts
node /srv/cdtank/start.mjs
```

`start.mjs` 可从任意工作目录启动。默认 Web 资源目录为发行包的 `web`，原数据表为 `content/tables`，账户库为 `state/accounts.sqlite`。包内不带玩家账户数据；已有存档通过备份恢复命令导入新路径。服务运行依赖在 `server/package-lock.json` 固定，目标设备无需项目源码或开发依赖。

静态服务将根目录设为 `/srv/cdtank/web`，将 `/game` 的 WebSocket 请求转发至服务端。包内 `nginx.conf.example` 提供配置，默认入口为 `http://服务器:8080/`。浏览器和服务端分别部署时仍须配置同一 WebSocket 接入路径。

将示例 `server` 块加入 nginx 的 `http` 配置，并保留标准 `include /etc/nginx/mime.types;`。使用 `nginx -t` 检查配置后重载 nginx。浏览器通过此地址加载页面，并连接同源 `/game`；JavaScript 模块由 nginx 提供正确的 MIME 类型。

服务端也可使用 `server.env.example` 中的环境变量覆盖默认值：

```sh
ACCOUNT_DB_PATH=/srv/cdtank/state/accounts.sqlite \
WEB_ASSETS=/srv/cdtank/web \
CONTENT_TABLES=/srv/cdtank/content/tables \
node /srv/cdtank/start.mjs
```

正式登录页可注册账号和密码，或登录已注册账号；账号与密码各为1至20字。注册会将当前浏览器已有的未绑定账户绑定到该账号，保持原账户数据；已绑定账户使用登录。账号和密码可在另一浏览器登录同一持久账户。

浏览器本地存储保留账户token与账号名，不保存密码。同一浏览器可用已保存身份继续进入；清除本地存储后，已注册账户可用账号和密码重新登录。未绑定账号的token账户依赖原浏览器保存的token恢复。认证后进入频道选择，再进入正式大厅；大厅可以进入我的家、商城、创建或加入房间，资源加载完成后在等待页准备，退出对局返回大厅。

## 服务重启与房间

账户身份、昵称、拥有记录、已确认库存和配置、交易确认记录及已完成战绩保存在 SQLite。服务重启后，用原浏览器凭据重新认证即可读取这些数据。

临时房间、Ready 状态和正在进行的比赛只保存在服务内存中。服务中断后浏览器清理旧对局画面、聊天与名单；重启不恢复原房间，也不把未完成比赛写成战绩。玩家刷新正式页面后回大厅，再正常创建或加入新房间。重新入场读取保存的角色、装备和库存。

## 备份

从项目根目录运行：

```sh
npm run accounts:backup -- /srv/cdtank/state/accounts.sqlite /srv/cdtank/backups/accounts-2026-10-04.sqlite
```

独立发行包使用 `node /srv/cdtank/account-snapshot.mjs backup <源库> <新备份路径>`，恢复时将 `backup` 换为 `restore`。

命令通过 SQLite 在线备份 API 保存一致性数据库，包含已提交到 WAL 的数据。服务器可以继续运行；备份完成后的交易继续写入原数据库，不进入已完成的备份。目标必须是新路径。不要用普通文件复制替代运行中数据库的备份。

账户数据库包含账户凭据、昵称、拥有记录、物品库存、七个快捷槽、角色资料、装备配置、好友与黑名单、购买请求确认记录及已保存战绩。备份文件按账户存档管理，恢复后浏览器原凭据继续有效。

## 恢复

停止服务端，然后将备份恢复到新数据库路径：

```sh
npm run accounts:restore -- /srv/cdtank/backups/accounts-2026-10-04.sqlite /srv/cdtank/state/accounts-restored.sqlite
```

将 `ACCOUNT_DB_PATH` 改为新路径，按上述启动命令重启服务端。原数据库和备份保留不变。运行中的房间、连接与战斗状态不在账户数据库中；玩家重新认证后从大厅继续操作。

数据库备份不包含 `dist/web`、编译服务端、`WEB_ASSETS`、`CONTENT_TABLES` 或浏览器本地设置。发布版本时同时保留对应代码、锁文件、构建产物和资源目录；恢复存档使用同一发布版本的程序与内容。本命令不转换数据库格式。

## 验证范围

`npm run test:release:network` 组装临时完整发行目录、安装包内固定依赖，再从仓库外启动两次服务。两个普通空账户通过认证、地图目录、建房、加入、双端玩家同步、退出及冷重启身份/昵称恢复。测试静态 HTTP 服务检查正式 HTML、入口 JS 与目录资源；浏览器与实际 nginx 反代范围见下段。

`npm run test:release:browser` 使用实际 nginx 隔离配置、发行目录和两个普通 Chromium 账户，验证同源 `/game` 的 101 升级、正式大厅创建与加入、等待页中文公共聊天双端呈现、正常退出及刷新身份保持。本机反代范围已通过；真实独立设备访问仍未验收。测试需要已打包并安装运行依赖的 `dist/release`、Chromium，以及 `recovery/output/nginx-runtime` 中解出的 nginx/nginx-common 软件包。

`npm run test:accounts:backup` 在独立端口和临时目录启动编译服务端，通过普通账户 API 购买和配槽，运行中备份，再从恢复副本重新启动。验收涵盖原账户认证、昵称、库存、快捷槽、购入角色与资料、好友、其他账户隔离及重复购买请求不再次扣款。另一段复用已有正常两局战绩检查点，只读备份原库，并通过恢复后的编译服务端验证完整两条记录和分页；不重复对局。完整部署与浏览器本地设置恢复仍按各自任务验收。
