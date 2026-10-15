# CDTank · 阿猫阿狗大作战复刻

当前版本：**1.0.2** · [GitHub Releases](https://github.com/qq617564112/cdtank/releases) · [当前状态与文档](docs/README.md) · [更新日志](CHANGELOG.md)

![阿猫阿狗大作战 Online 高清标志](docs/assets/logo-hd.webp)

**《阿猫阿狗大作战 Online》的非官方 Web 复刻项目。** 使用原 Windows 客户端的资源、数据表和程序行为作为依据，以 Babylon.js、React 和 TypeScript 重建浏览器客户端，以 Node.js 和 TSRPC 实现联机服务端，让猫狗战车重新驶回木桶镇。

原作由上海软星制作、大宇资讯发行，是《阿猫阿狗》系列的休闲坦克射击网游，2006 年推出。玩家操控猫狗角色驾驶战车，在木桶镇的街头巷尾交战，画面沿用系列的卡通渲染风格。背景资料见[原作介绍](docs/game-background.md)。

![阿猫阿狗大作战 Online 原作战斗画面](docs/assets/original-battle.jpg)

*原作参考画面，来源为巴哈姆特作品资料页；图片出处和权利说明见[素材来源](docs/asset-sources.md)。*

客户端使用 **WebGPU**，界面采用手绘卡通风格，保留涂鸦小地图。战斗素材支持怀旧／HD 切换，渲染分辨率、抗锯齿和卡通描边可分别调整。每个房间由独立 Node.js 进程运行权威模拟，账户与连接由主进程管理。

本版主要变化和专题入口见[当前状态与文档](docs/README.md)。

## 当前内容

- **联机对战**：创建和加入房间、密码房、换队、准备、战斗、结算及再战。
- **五种模式**：团队、占领、擒王、混战、破坏；保留原表 26 组规则参数，房间目录覆盖 25 张原场景和测试地图，按场景内容提供对应模式。
- **战车与场景**：21 种原版战车、323 套有效主题皮肤、履带动画，以及宠物、部件、音乐和音效；高清贴图保留原模型几何、UV 与动画。
- **账户与角色**：注册登录、我的家、库存与装备、商城及社交功能，保存角色成长、称号与账户资料。
- **成长与交易**：战车火力／装甲改造、宠物技能学习确认、装饰部件购买、贵重品数量出售与维修计时。
- **玩家与社交**：公开资料、精确昵称查找、家族聊天，以及 GM 问题提交和回复收件箱；家族归属与人工回复由本机运营者管理。
- **战斗统计**：记录每局射击、命中、伤害和连杀等统计，结算九项战斗奖章，累计战绩与实际消费保存到 SQLite。
- **CPU 对手**：可在等待房间添加 CPU，通过同一套战斗输入和规则参与对局。
- **房间与恢复**：房间独立进程、房主转交、页面与弹窗 URL，以及刷新后的账户、频道和原房间恢复。
- **资源工具**：CPK、MV3、POL、CVD 和数据表的提取与转换工具，以及素材制作所需的模型渲染入口。
- **显示与加载**：电脑与移动端均可选怀旧／HD，移动端 HD 采用怀旧贴图尺寸，支持全局横屏；五档渲染分辨率、4× MSAA、FPS 显示、亮度／饱和度／对比度；UI 预加载、模型与音频缓存，以及电脑登录页可选的全资源预下载。
- **战场画面**：GPU HUD、模型动画与粒子绘制，按地图配置的方向光和实时软阴影。
- **交付流程**：高清源图、逐图压缩配方、WebP 成品、UI 精灵图与怀旧／HD 战斗资源；GitHub 程序／资产分包与自动安装，以及 Forgejo / Docker 自动部署。

项目仍在持续还原中。完整原版规则、全部技能道具、界面表现和高清多人性能的完成情况，以[任务清单](docs/recovery/tasklist.md)和各专题证据为准。

## 项目截图

### 战车商城

![战车商城：战车列表、模型预览与属性面板](docs/assets/QQ图片20261006212305.png)

### 猫狗商城

![猫狗商城：角色列表、模型预览与技能信息](docs/assets/QQ图片20261006212309.png)

### 团队模式

![团队模式：开场提示、双方名单、战车与小地图](docs/assets/QQ图片20261006212312.png)

### 战斗结算

![战斗结算：双方得分、击毁数量、奖章与再战确认](docs/assets/QQ图片20261006212315.png)

## 本地运行

需要 **Node.js 24.16 或更高版本**和支持 **WebGPU** 的浏览器。以下三种方式任选其一；本机使用 HTTP localhost，服务器和局域网访问必须使用 HTTPS。

### 1. 直接使用 Release 运行

安装 [Node.js](https://nodejs.org/en/download) **24.16 或更高版本**，从 [GitHub Releases](https://github.com/qq617564112/cdtank/releases) 下载程序包 `cdtank-1.0.2.tar.gz` 并解压。在解压目录运行：

```bash
cd /path/to/cdtank-1.0.2
node install.mjs
```

安装器自动下载同版本资产包、解压到 `web/`、安装服务端运行依赖，然后启动服务并打开 [http://localhost:3001](http://localhost:3001)。后续启动仍运行 `node install.mjs`，已安装的资产和依赖会复用；按 Ctrl+C 停止服务。1.0.1 及以后版本沿用此流程，文件名中的版本随 Release 更新。

账户默认保存到发行包的 `state/accounts.sqlite`；可通过 `PORT` 和 `ACCOUNT_DB_PATH` 修改端口及存档路径。系统需提供支持 `.tar.gz` 的 `tar`，Windows 10/11 和 macOS 可使用系统自带版本。手动指定资产包、禁止自动打开浏览器及升级存档说明见[发布与安装](docs/github-publication.md)。

### 2. 本地构建运行

克隆源码或下载源码 ZIP 并解压，在仓库根目录安装依赖：

```bash
npm ci
```

安装与源码版本配套的运行资源，自动下载同版本的程序包和资产包，取出 public、服务端内容表与碰撞数据：

```bash
npm run assets:install
```

已有配套 `apps/web/public/` 和 `apps/server/resources/` 时可跳过安装。public 按 `assets/`、`data/`、`manifests/` 分类，见[目录规则](docs/public-assets.md)。离线安装可指定两个本地附件，见[发布说明](docs/github-publication.md)。运行资源包含 UI 图集、怀旧与 HD 两套战斗素材、模型、音频、字体、数据表和碰撞数据，无需原客户端或 Python。修改素材时需要另行保留完整的 `art/hd/`、`art/original/` 及[资产压缩依赖](docs/asset-compression.md)。

构建网页和服务端后启动：

```bash
npm run build:web
npm run build:server
PORT=40171 npm run start:server
```

打开 [http://localhost:40171](http://localhost:40171)。服务端在同一端口提供构建后的网页、静态资源和联机连接。需要组装完整独立运行目录时，执行 `npm run release:package -- /path/to/new-release-directory`，安装包内服务端依赖后运行 `node start.mjs`，具体见[运行与账户存档](deployment/operations.md)。

### 3. 本地开发服务器

按第二种方式准备源码、依赖和配套运行资源，然后在仓库根目录的两个终端分别启动：

```bash
# 终端一：联机服务端，默认端口 3001
npm run dev:server
```

```bash
# 终端二：Web 客户端，默认端口 5173
npm run dev
```

打开 [http://localhost:5173](http://localhost:5173)。Vite 提供页面和热更新，并将 `/game` WebSocket 代理到开发服务端。开发配置与环境变量见[开发指南](docs/development.md)。

## 服务部署与 HTTPS

### Docker 部署

在包含配套 `apps/web/public/` 和 `apps/server/resources/` 的源码目录执行：

```bash
bash deployment/import-assets.sh
docker build --tag cdtank:1.0.2 .
CDTANK_IMAGE_TAG=1.0.2 docker compose -f deployment/compose.yml up --detach --wait --wait-timeout 180
```

本机入口为 [http://localhost:61002](http://localhost:61002)，账户保存在 `cdtank-accounts` 持久卷中。资源准备、HTTPS 反代、镜像更新及存档备份恢复见[Docker 部署](docs/docker-deployment.md)。

### HTTPS 入口

**服务器和局域网部署的玩家入口必须使用 HTTPS；通过普通 HTTP 域名或局域网 IP 访问时，浏览器不会开放 WebGPU，游戏无法启动。** HTTP localhost 可用于本机运行。

Node.js 服务可继续提供 HTTP，由配置有效 TLS 证书的反向代理对外提供 HTTPS，并开启 `/game` 的 WebSocket 转发；浏览器联机连接使用 `wss://`。部署配置见[运行与账户存档](deployment/operations.md)及[Forgejo 自动部署](deployment/forgejo.md)。

三种运行方式均可通过 `ACCOUNT_DB_PATH` 指定已有存档。渲染实现见 [WebGPU 客户端渲染](docs/webgpu-rendering.md)。

## 进入游戏与操作

注册或登录后，选择频道进入大厅，创建或加入房间，资源加载完成后点击准备。默认开局人数由地图原表决定；可在等待房间添加 CPU 补足人数，也可用多个浏览器窗口加入同一房间。

开场先显示模式介绍和战斗提示，提示结束后开始计时并开放操作。结算画面保留最后的战场状态，可继续投票再战或返回大厅。

正常启动预加载界面资源，地图、模型和音频在使用时加载并缓存。登录页“加载资源包”可在确认体积后一次性缓存所有已发布静态资源。显示选项及素材切换见[显示设置](docs/display-settings.md)，缓存与重试见[资源加载](docs/resource-loading.md)。

| 默认按键 | 操作 |
| --- | --- |
| W / S | 前进 / 后退 |
| A / D | 车身左转 / 右转 |
| ← / → | 炮塔左转 / 右转 |
| 空格 | 开火 |
| 1–8 | 请求使用对应快捷槽 |

按键可在设置中调整。道具是否生效取决于账户库存和对应功能的还原状态。

## 目录

```text
apps/
  web/src/              浏览器客户端：界面、渲染、音频与对局
  web/public/           正式静态资源：模型、贴图、音频、UI 与字体
  server/src/           联机服务端：房间、战斗、账户与社交
  server/resources/     正式服务端资源：数据表、场景与碰撞数据
  shared/               通信协议、共同契约和两端共用规则
art/original/           原版导出素材，保留源尺寸与内容
art/hd/                 高清源图与资源快照
art/compressed/         按配方生成的运行成品
docs/                  开发、显示、资产、渲染与性能说明
docs/recovery/          还原任务、来源依据与专题说明
tools/recovery/         原客户端解析、导出和转换工具
tests/evidence/         原程序行为取证脚本和对应实现
recovery/               本地提取来源与中间结果，由 Git 忽略
state/                  本地账户存档，由 Git 忽略
scripts/                构建、资源重建、打包和账户备份脚本
deployment/             运行配置、反向代理与存档说明
tests/                  现有资产、规则、联机和页面验收入口
```

运行资源与源码分别管理，可随 GitHub Release 发布或导入 Docker 资源镜像。原客户端 `CDTank/`、美术目录 `art/`、恢复工作目录 `recovery/`、正式运行资源、账户数据库、`node_modules/` 和 `dist/` 由 `.gitignore` 排除。

## 文档

| 内容 | 入口 |
| --- | --- |
| 当前主线变化与完整导航 | [文档索引](docs/README.md) |
| 版本变化 | [更新日志](CHANGELOG.md) |
| 原作背景与参考资料 | [原作介绍](docs/game-background.md) |
| 图片出处与权利归属 | [素材来源](docs/asset-sources.md) |
| 开发命令、配置与项目范围 | [开发指南](docs/development.md) |
| 运行美术目录与发布流程 | [运行美术资源](docs/original-assets.md) · [public 目录](docs/public-assets.md) |
| HD 资产压缩、尺寸规则与精灵图生成 | [高清资产压缩与精灵图](docs/asset-compression.md) |
| 高清战车、地图物件与履带 | [高清素材](docs/hd-assets.md) |
| 显示选项与怀旧／HD 切换 | [显示设置](docs/display-settings.md) |
| 预加载、缓存与失败重试 | [资源加载](docs/resource-loading.md) |
| GPU HUD、动画、光照与性能记录 | [WebGPU 渲染](docs/webgpu-rendering.md) · [浏览器性能](docs/browser-performance.md) |
| 房间进程与权威模拟 | [房间架构](docs/room-processes.md) · [服务端计算](docs/server-performance.md) |
| 页面路径与刷新恢复 | [路由与会话恢复](docs/navigation.md) |
| 当前还原状态与专题导航 | [还原文档索引](docs/recovery/README.md) |
| 可选：从原客户端重新生成资源 | [资源重建](docs/recovery/reproducible-assets.md) |
| 生产部署与账户备份恢复 | [运行与账户存档](deployment/operations.md) |
| Docker 构建、Compose 与 HTTPS 代理 | [Docker 部署](docs/docker-deployment.md) |
| Forgejo CI/CD 与 Docker 部署 | [自动部署](deployment/forgejo.md) |
| GitHub 程序／资产发布与安装 | [发布说明](docs/github-publication.md) |

## 当前限制

- 房间刷新恢复沿用 30 秒断线保留窗口；超时、房间关闭或服务端重启后回到大厅。账户存档保留，正在进行的对局不随重启恢复。
- 既有两图性能记录覆盖特定设备与配置；后续贴图、缓存和软阴影改动的整局视觉效果与性能仍以专题记录及任务清单的实测范围为准。

## 素材与许可

原作名称、美术、模型、音频、界面和其他游戏素材的权利归相应权利人所有。素材来源记录在[素材来源](docs/asset-sources.md)。本项目与原作开发商、发行商没有官方关联。

本项目原创代码、工具与文档采用 [CDTank 非商业研究用途源码许可](LICENSE)：允许非商业的学习、学术研究、技术分析与实验验证，以及在相同许可下分享源码和修改版本；**仅供研究使用，禁止商用**。Copyright © 2026 CDTank contributors。该许可限制用途，不属于 OSI 定义的开源许可证。

Release 资源包包含从原客户端提取并转换的运行资源，以及运行所用的第三方字体，来源见[素材来源](docs/asset-sources.md)。原作素材及其转换或衍生版本、第三方组件与字体保留各自权利和许可，不由本项目的源码许可重新授权。版权与来源说明见 [NOTICE](NOTICE)。
