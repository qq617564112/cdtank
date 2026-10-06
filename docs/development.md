# 开发指南

## 工程分工

| 目录 | 职责 |
| --- | --- |
| `apps/web/src/interface/` | 登录、大厅、我的家、商城和战斗界面 |
| `apps/web/src/match/` | 对局生命周期、输入和客户端运动 |
| `apps/web/src/render/`、`assets/`、`audio/` | 场景渲染、资源载入与声音 |
| `apps/web/src/network/` | 账户、房间和通信请求 |
| `apps/server/src/` | 账户存档、房间管理、战斗判定与结算 |
| `apps/shared/` | TSRPC 协议、共同契约及两端共用规则 |
| `recovery/` | 原客户端格式解析、资源转换、取证与还原文档 |
| `tests/`、`tools/` | 独立验收入口和资源查看工具 |

## 开发范围

目标是还原原客户端的资产、界面、游戏模式和业务功能，并提供可联机的浏览器版本。范围按以下阶段组织，逐项完成状态统一记录在[任务清单](../recovery/docs/tasklist.md)。

| 阶段 | 范围 |
| --- | --- |
| R0 原始资源恢复 | CPK、配置、数据表、补丁覆盖、资产与功能清单 |
| R1 全资产转换 | 图片、音频、MV3/POL/CVD、地图碰撞、动画、特效、材质和字体 |
| R2 客户端与联机基础 | 高清渲染、通信协议、账户身份、房间、输入与状态同步 |
| R3 模式还原 | 团队、占领、擒王、混战、破坏的目标、计分、奖励和重生规则 |
| R4 内容与成长 | 战车、宠物、技能、道具、装备、改装、耐久、等级与称号 |
| R5 界面与社会功能 | 登录、频道、我的家、商城、交易、聊天、好友、历史和设置 |
| R6 综合交付 | 高清多人体验、断线与重入、账户重启恢复、部署和全内容验收 |

## 资源准备

原客户端放在仓库根目录的 `CDTank/`。资源准备的完整步骤见[从原客户端重建资源](../recovery/docs/reproducible-assets.md)。主要目录为：

| 本地目录 | 内容 |
| --- | --- |
| `recovery/.venv/` | Python 提取与转换依赖 |
| `recovery/output/verified/` | 解包资源、已解码内容表与来源清单 |
| `recovery/output/web-assets/` | Web 和服务端实际读取的转换资源 |
| `recovery/output/accounts.sqlite` | 开发环境默认账户数据库 |
| `recovery/output/` 中的其他文件 | 专题取证、验收结果与截图 |

这些目录包含运行依赖、玩家数据和还原依据。清理生成数据时应保留需要复用的资源与验收记录；运行中账户数据库通过备份命令保存。

## 常用命令

以下命令在仓库根目录执行，运行和构建前需完成资源准备。

| 命令 | 用途 |
| --- | --- |
| `npm ci` | 按锁文件安装 JavaScript 依赖 |
| `npm run assets:rebuild -- --font /path/to/font.ttf` | 首次提取并生成运行资源 |
| `npm run assets:rebuild -- --reuse-verified` | 复用提取结果重新导出资源，需已有附件字体 |
| `npm run dev:server` | 启动开发服务端 |
| `npm run dev` | 启动正式 Web 开发入口 |
| `npm run tools:assets:dev` | 启动独立资源查看器，默认端口 5211 |
| `npm run protocol:generate` | 协议源码变更后重新生成 `serviceProto.ts` |
| `npm run build:web` | 客户端类型检查与生产构建，输出 `dist/web/` |
| `npm run build:server` | 编译独立服务端，输出 `dist/server/` |
| `npm run start:server` | 启动已编译服务端 |
| `npm run release:package -- /srv/cdtank` | 向新的目标目录组装发行包 |
| `npm run accounts:backup -- <源库> <新备份路径>` | 在线备份账户数据库 |
| `npm run accounts:restore -- <备份库> <新数据库路径>` | 停服后恢复存档 |

## 本地配置

Web 开发服务器将同源 `/game` WebSocket 转发到游戏服务端。

| 环境变量 | 默认值 | 用途 |
| --- | --- | --- |
| `PORT` | `3001` | 游戏服务端端口 |
| `CDTANK_WEB_PORT` | `5173` | Vite 开发端口 |
| `CDTANK_GAME_SERVER` | `ws://127.0.0.1:3001` | 开发 WebSocket 代理目标 |
| `CDTANK_WEB_ASSETS` | `recovery/output/web-assets` | Web 静态资源目录 |
| `WEB_ASSETS` | `recovery/output/web-assets` | 服务端资源目录 |
| `CONTENT_TABLES` | `recovery/output/verified/tables` | 服务端内容表目录 |
| `ACCOUNT_DB_PATH` | `recovery/output/accounts.sqlite` | 账户存档路径 |

生产配置、独立发行包、反向代理和存档操作见[运行与账户存档](../deployment/operations.md)及[环境变量示例](../deployment/server.env.example)。

## 验收与来源

现有验收命令保留在根 `package.json`，对应的原始来源和范围记录在[还原文档索引](../recovery/docs/README.md)及各专题中。资产结构、原程序行为对照、联机业务、网页表现和性能分别记录证据，完成状态按[任务清单](../recovery/docs/tasklist.md)维护。

本仓库当前协作约定见[AGENTS.md](../AGENTS.md)。执行检查前需明确要检测的失败和失败后的修改；当前约定不编写单元测试，不运行测试、浏览器验收、构建或类型检查。

