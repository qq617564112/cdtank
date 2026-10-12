# 开发指南

## 工程分工

| 目录 | 职责 |
| --- | --- |
| `apps/web/src/interface/` | 登录、大厅、我的家、商城和战斗界面 |
| `apps/web/src/match/` | 对局生命周期、输入和客户端运动 |
| `apps/web/src/render/`、`assets/`、`audio/` | 场景渲染、资源载入与声音 |
| `apps/web/src/network/` | 账户、房间和通信请求 |
| `apps/server/src/` | 账户存档、房间管理、战斗判定与结算 |
| `apps/server/src/runtime/` | 房间子进程、IPC、账户服务及运行资源路径 |
| `apps/shared/` | TSRPC 协议、共同契约及两端共用规则 |
| `art/original/`、`art/hd/`、`art/compressed/` | 原版档案、高清源图与压缩成品，由 Git 忽略 |
| `tools/recovery/` | 原客户端格式解析与资源转换工具 |
| `docs/recovery/` | 还原任务、来源依据与专题文档 |
| `tests/evidence/` | 原程序行为取证脚本 |
| `recovery/` | 本地提取来源、中间结果与 Python 环境，由 Git 忽略 |
| `tests/`、`tools/` | 独立验收入口和资源查看工具 |

## 开发范围

页面路径、弹窗状态及刷新后的账户和房间恢复见[路由与会话恢复](navigation.md)。

当前主线变化与专题导航见[文档索引](README.md)。房间独立进程与主进程职责见[架构决策](room-processes.md)；客户端显示和加载行为见[显示设置](display-settings.md)与[资源加载](resource-loading.md)。

目标是还原原客户端的资产、界面、游戏模式和业务功能，并提供可联机的浏览器版本。范围按以下阶段组织，逐项完成状态统一记录在[任务清单](recovery/tasklist.md)。

| 阶段 | 范围 |
| --- | --- |
| R0 原始资源恢复 | CPK、配置、数据表、补丁覆盖、资产与功能清单 |
| R1 全资产转换 | 图片、音频、MV3/POL/CVD、地图碰撞、动画、特效、材质和字体 |
| R2 客户端与联机基础 | 高清渲染、通信协议、账户身份、房间、输入与状态同步 |
| R3 模式还原 | 团队、占领、擒王、混战、破坏的目标、计分、奖励和重生规则 |
| R4 内容与成长 | 战车、宠物、技能、道具、装备、改装、耐久、等级与称号 |
| R5 界面与社会功能 | 登录、频道、我的家、商城、交易、聊天、好友、历史和设置 |
| R6 综合交付 | 高清多人体验、断线与重入、账户重启恢复、部署和全内容验收 |

## 运行资源

运行资源使用当前 UI 精灵图，并提供原版、HD 两套战斗模型和特效贴图；小地图保持当前素材。已有配套运行目录可直接开发，或执行 `npm run assets:install` 从同版本 Release 安装 public、服务端表和碰撞数据。指定本地程序／资产附件见[发布与安装](github-publication.md)。素材生成还需完整的 `art/hd/`、`art/original/` 及[压缩依赖](asset-compression.md)，这些源目录不包含在运行包中。

图片按最终发布地址复用缓存，模型、JSON 和音频也保存完整文件；启动只预加载 UI，完整预下载由登录页确认操作触发。主要目录为：

| 目录 | 内容 |
| --- | --- |
| `art/original/` | 原版图片与模型，保留导出尺寸及文件内容，由 Git 忽略 |
| `art/hd/` | 高清源图与资源快照，包含模型贴图、UI 和 minimap，由 Git 忽略 |
| `art/compressed/` | 高清资产压缩脚本的输出，由 Git 忽略 |
| `apps/web/public/` | 基础资源及生成的 UI 图集、双画质战斗素材、字体与清单，由 Git 忽略 |
| `apps/server/resources/assets/` | 服务端场景目录、战场配置与预烘焙碰撞数据，由 Git 忽略 |
| `apps/server/resources/tables/` | 安装脚本下载的解码内容表，包含 JSON 和 CSV，由 Git 忽略 |
| `state/accounts.sqlite` | 开发环境默认账户数据库，由运行时创建并由 Git 忽略 |
| `recovery/output/` 中的其他文件 | 本地提取结果、来源清单、专题取证与截图，由 Git 忽略 |
| `recovery/.venv/` | 可选资源重建使用的 Python 依赖，由 Git 忽略 |

资源重新提取和转换是可选的维护流程，才需要将原客户端放在 `CDTank/` 并安装 Python 依赖，步骤见[从原客户端重建资源](recovery/reproducible-assets.md)。运行中账户数据库通过备份命令保存。

从已有 `art/hd/` 生成压缩资产，以及从压缩成品生成 public 精灵图和双画质战斗素材，见[高清资产压缩与精灵图](asset-compression.md)。该文档记录依赖、逐图配方、最终尺寸、WebP 编码参数和生成顺序。其它独立图片通过 `assets:publish -- --image <compressed中的相对路径>` 发布。public 分类和逻辑资源标识见[public 资源目录](public-assets.md)。

## 常用命令

以下命令在仓库根目录执行。安装资源后可直接用于运行、构建和打包。

| 命令 | 用途 |
| --- | --- |
| `npm ci` | 按锁文件安装 JavaScript 依赖 |
| `npm run assets:install` | 从同版本 Release 的两个附件安装 public、服务端内容表与现成碰撞数据 |
| `npm run assets:install -- --archive <资产包> --program <程序包>` | 使用本地同版本附件安装运行资源 |
| `npm run assets:rebuild` | 可选：从原客户端重新提取资源，再安装本地美术与字体 |
| `npm run assets:rebuild -- --reuse-verified` | 可选：复用完整提取目录重新导出资源，仍需原客户端 |
| `npm run assets:original` | 发布原版及本地 HD 图片，清理无引用图片与已有 UI 图集 |
| `npm run assets:hd` | 将高清材质安装到原模型，再执行单图发布流程 |
| `npm run assets:compressed` | 按逐图配方从 `art/hd/` 生成 `art/compressed/`，保留高清源文件 |
| `npm run assets:compressed -- --image <源路径或输出路径>` | 增量生成指定独立图片，可重复指定 `--image` |
| `npm run assets:sprites` | 从已有 `art/compressed/` 生成 UI 精灵图和清单到 `apps/web/public/` |
| `npm run assets:battle-artwork` | 从原版素材与压缩成品发布怀旧、HD两套战斗模型和特效贴图 |
| `npm run assets:publish` | 整理已有 public 为 assets、data、manifests，不重新编码 |
| `npm run assets:publish -- --image <compressed中的相对路径>` | 发布指定独立压缩图片，可重复指定 `--image` |
| `npm run dev:server` | 启动开发服务端 |
| `npm run dev` | 启动正式 Web 开发入口 |
| `npm run protocol:generate` | 协议源码变更后重新生成 `serviceProto.ts` |
| `npm run build:web` | 客户端类型检查与生产构建，输出 `dist/web/` |
| `npm run build:server` | 编译独立服务端，输出 `dist/server/` |
| `npm run start:server` | 启动已编译服务端，同时托管 `dist/web` 的网页和资源 |
| `npm run release:package -- /srv/cdtank` | 向新的目标目录组装发行包 |
| `npm run release:build` | 构建并生成本地程序／资产附件，不创建标签或上传 |
| `npm run release:github` | 构建、推送对应标签、上传两包，完成后公开 GitHub Release |
| `npm run accounts:backup -- <源库> <新备份路径>` | 在线备份账户数据库 |
| `npm run accounts:restore -- <备份库> <新数据库路径>` | 停服后恢复存档 |

## 本地配置

Web 开发服务器将同源 `/game` WebSocket 转发到游戏服务端。

客户端要求 WebGPU，通过 HTTPS 或 localhost 访问。引擎异步初始化和 HUD/场景优化见 [WebGPU 客户端渲染](webgpu-rendering.md)。

服务端默认按 20 Hz 推进每个房间的独立模拟。主进程持有账户数据库及网络连接，房间进程无需额外监听端口或数据库路径。修改 `TICK_RATE` 会影响权威模拟节奏，不是客户端帧率设置。

构建两端后，`PORT=40171 npm run start:server` 在同一端口提供网页、资源和 `/game`。静态托管模块挂在 TSRPC 3.4.21 的内部 HTTP 监听器上；升级 TSRPC 时需确认该监听器仍可访问。开发时继续使用 Vite 提供页面和热更新。

| 环境变量 | 默认值 | 用途 |
| --- | --- | --- |
| `PORT` | `3001` | 网页、资源与 WebSocket 共用的服务端端口 |
| `TICK_RATE` | `20` | 房间权威模拟频率，单位 Hz |
| `CDTANK_WEB_PORT` | `5173` | Vite 开发端口 |
| `CDTANK_WEB_PREVIEW_PORT` | `4173` | Vite 构建预览端口 |
| `CDTANK_GAME_SERVER` | `ws://127.0.0.1:3001` | 开发 WebSocket 代理目标 |
| `CDTANK_WEB_ASSETS` | `apps/web/public` | Web 静态资源目录 |
| `WEB_ASSETS` | `apps/web/public` | 服务端及离线转换工具读取的 Web 资源目录 |
| `SERVER_ASSETS` | `apps/server/resources/assets` | 服务端场景与碰撞资源目录 |
| `WEB_ROOT` | `dist/web` | 服务端托管的已构建网页目录，发行包默认 `web` |
| `CONTENT_TABLES` | `apps/server/resources/tables` | 服务端内容表目录 |
| `ACCOUNT_DB_PATH` | `state/accounts.sqlite` | 账户存档路径 |

生产配置、独立发行包、反向代理和存档操作见[运行与账户存档](../deployment/operations.md)及[环境变量示例](../deployment/server.env.example)。

## 资源版本

1.0.1 及以后源码、程序包和资产包使用相同版本号；下载资源按根 package.json 的版本选择固定标签。安装流程、发布准备和当前附件状态见[GitHub 发布与安装](github-publication.md)。

## 验收与来源

现有验收命令保留在根 `package.json`，对应的原始来源和范围记录在[还原文档索引](recovery/README.md)及各专题中。资产结构、原程序行为对照、联机业务、网页表现和性能分别记录证据，完成状态按[任务清单](recovery/tasklist.md)维护。

本仓库当前协作约定见[AGENTS.md](../AGENTS.md)。执行检查前需明确要检测的失败和失败后的修改；当前约定不编写单元测试，不运行测试、浏览器验收、构建或类型检查。
