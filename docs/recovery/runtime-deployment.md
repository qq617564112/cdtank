# 独立客户端与服务端运行

E-05将正式客户端构建和正式服务端编译/启动分开。原程序取证和渲染验证不属于启动步骤。首次内容恢复需生成所需资产；部署使用已经导出的数据，不能省略这些运行数据。

## 服务端

要求支持node:sqlite的Node版本（当前验收Node22及以上）。`npm run build:server`执行独立server tsconfig，输出CommonJS到dist/server；包含协议及规则，生成独立package.json。`npm run start:server`启动编译后的JS，不依赖tsx或原程序取证；仓库启动脚本从自身路径确定默认数据位置，允许所有环境变量覆盖。

独立部署时复制dist/server到/srv/cdtank/server，在该目录执行npm install --omit=dev，再设置deployment/server.env.example所列变量运行`npm start`。内容需包含web-assets中的combat-catalog.json、tank-textures.json、tanks.json、battlefields.json、scene-placements.json，以及原导出tables中的tank/pet/datascale与m001–m005等config实际读取表。保留完整导出tables是当前可靠的部署输入；数据库目录需可写且应单独持久保存。

WEB_ASSETS与CONTENT_TABLES应使用绝对路径，使进程可在任意工作目录启动。BATTLEFIELDS、SCENE_PLACEMENTS旧单文件覆盖仍保留。PORT为1–65535整数，TICK_RATE为1–1000整数；显式MATCH_MIN_PLAYERS、MATCH_TIME_LIMIT_SECONDS演示覆盖必须有效，不合法配置启动失败。原缺省时限与最低人数仍来自模式表。

资源数据在模块导入时读取，数据缺失时失败而不自动生成。迁移前默认从仓库cwd读同一数据，迁移后仓库启动脚本明确提供同一绝对路径。独立产物运行、真实两个连接确认/账户保存/重启及CPU各两局验证见server-build-runtime.md。

## 客户端

`npm run build:web`使用apps/web独立tsconfig与Vite配置输出dist/web。`npm run dev:web`和`npm run preview:web`分别提供开发/构建预览；CDTANK_WEB_ASSETS、CDTANK_GAME_SERVER、端口等配置见web-runtime-config.md。客户端内容以构建时资产目录拷贝到发行产物；正式运行不需原程序目录、Python或取证脚本。

部署将dist/web复制到/srv/cdtank/web，由静态HTTP服务器提供；同源/game经WebSocket反向代理到正式服务端。deployment/nginx.conf.example给出可审阅的最小配置，未对外部署或启动系统服务。Nginx示例的3001应与服务端PORT保持相同。Vite preview用于本地验证，实际部署使用静态服务器和代理。

本阶段保留历史模型查看功能及尚未迁出的其他render-check目录；完整发行页面与诊断入口整理仍由E-03推进。服务端还不是完全模块化，World房间/战斗/玩法/结算继续按E-02逐片迁移。
