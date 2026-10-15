# GitHub 发布与安装

**此流程适用于 1.0.1 及以后版本。** 同一个 GitHub Release 分别提供程序包和完整 public 资产包，标签使用 `v<版本>`。玩家只需下载程序包、解压并运行 Node 安装器。

## 发行附件

以 1.0.3 为例：

| 附件 | 内容 |
| --- | --- |
| `cdtank-1.0.3.tar.gz` | 编译服务端、前端构建文件、服务端内容表与碰撞数据、依赖锁文件、安装与启动入口、存档工具和许可声明 |
| `cdtank-assets-1.0.3.tar.gz` | 完整 `apps/web/public/`，包含模型、贴图、音频、UI 图集、怀旧与 HD 两套战斗素材、字体及许可、数据与清单 |

程序包解压后是 `cdtank-1.0.3/`，资产包顶层是 `public/`：

```text
cdtank-1.0.3/
  install.mjs                   自动安装、启动并打开浏览器
  start.mjs                     已安装后的直接启动入口
  release.json                  版本、标签、仓库、源码提交与资产附件名
  server/                       编译服务端及运行依赖锁文件
  web/                          前端构建产物；安装资产后成为完整网页目录
  content/tables/               服务端解码内容表
  content/assets/               场景、战场与预烘焙碰撞数据
  account-snapshot.mjs          SQLite 存档备份与恢复
  nginx.conf.example
  operations.md
  LICENSE
  NOTICE

public/
  assets/                       模型、贴图、音频、图集和字体
  data/                         运行数据
  manifests/                    UI、战斗素材及其它资源清单
```

资产包包含 `assets/models/{original,hd,mobile-hd}/`、`assets/textures/{original,hd,mobile-hd}/` 和 `battle-artwork.json` 的 `original`、`hd`、`mobile-hd` 映射。手机与平板按设置选择怀旧或移动端 HD，后者使用与怀旧版一致的贴图尺寸；电脑使用怀旧或完整 HD。发布入口与安装器要求怀旧与 HD 资源齐全，本地组装入口还检查前端构建产物中的对应目录。

1.0.3 资产包含模型几何预计算结果、按页面拆分的 UI 图集、训练模式图标与压缩音频；CVD 客户端直接读取预计算布局，代码与资产必须使用同一版本。训练模拟数据由 Web 构建输出到程序包的 `web/content/training/`，服务端内容表、场景与碰撞数据保留在程序包的 `content/`。素材生成在发布前完成，发布与安装复用成品。

拆包按 public 的具体文件路径排除素材，保留 Vite 在 `assets/` 中生成的 JS、WASM 等文件和 `manifests/image-assets.json`。安装时把资产包的 `public/` 内容合并到程序包的 `web/`。目录规则见[public 资源目录](public-assets.md)，素材生成见[运行美术资源](original-assets.md)。

源码、工具、文档与锁文件保存在 Git 中；GitHub 同时为标签提供源码 ZIP 和 tar.gz。运行附件不包含原客户端、`art/` 创作源图、恢复中间产物、开发依赖、本地配置、账户数据库或备份。

## 下载、安装与启动

需要 Node.js **24.16 或更高版本**、npm、支持 `.tar.gz` 的系统 tar，以及支持 WebGPU 的浏览器。Windows 10/11 与 macOS 可使用系统 tar；Linux 安装 tar 与 gzip。首次安装需能访问 GitHub Releases 和 npm registry。

从 [GitHub Releases](https://github.com/qq617564112/cdtank/releases) 下载程序包并解压，进入目录：

```bash
cd /path/to/cdtank-1.0.3
node install.mjs
```

安装器读取包内 `release.json`，从固定标签下载同版本资产，解压到 `web/`，再执行 `npm ci --omit=dev --ignore-scripts` 安装服务端依赖。安装成功后记录版本，后续运行同一命令会复用资产和依赖。服务在前台运行，HTTP 就绪后自动打开 [http://localhost:3001](http://localhost:3001)，Ctrl+C 停止服务。

下载或安装失败会打印原因并退出；修正网络或运行环境后再次执行同一命令。删除 `.assets-version` 可重新下载资产，删除 `.dependencies-version` 可重新安装依赖。

使用已下载的同版本资产附件：

```bash
node install.mjs --archive /path/to/cdtank-assets-1.0.3.tar.gz
```

在无桌面的服务器上关闭浏览器自动打开：

```bash
node install.mjs --no-browser
```

两个选项可以组合。本地资产文件省去资产下载，首次依赖安装仍需 npm registry。安装完成后也可直接 `node start.mjs`，适用于进程管理器或容器。

默认端口为 3001，账户库为 `state/accounts.sqlite`；通过环境变量修改。例如 Linux/macOS：

```bash
PORT=40171 ACCOUNT_DB_PATH=/srv/cdtank/state/accounts.sqlite node install.mjs --no-browser
```

Windows PowerShell：

```powershell
$env:PORT = '40171'
node install.mjs
```

升级时将新程序包解压到新目录并安装同版本资产，通过 `ACCOUNT_DB_PATH` 指向已有存档，或使用包内备份／恢复工具迁移。账户与业务数据不在 Release 中；备份步骤见[运行与账户存档](../deployment/operations.md)。

## 源码工作区安装资源

在对应版本源码目录执行：

```bash
npm ci
npm run assets:install
```

安装脚本按根 `package.json` 的版本下载两个附件，将资产包的 `public/` 安装到 `apps/web/public/`，仅从程序包取出 `content/` 安装到 `apps/server/resources/`。现成的 UI 图集、怀旧与 HD 两套战斗素材、字体和碰撞数据直接使用，运行和开发无需原客户端或 Python。

指定本地同版本附件：

```bash
npm run assets:install -- \
  --archive /path/to/cdtank-assets-1.0.3.tar.gz \
  --program /path/to/cdtank-1.0.3.tar.gz
```

安装器先在临时目录解压并确认目录内容，再替换上述两个运行资源目录。素材编辑在 `art/` 中完成；已有配套运行目录可跳过安装。两端构建和开发服务器命令见[根 README](../README.md)与[开发指南](development.md)。

## 维护者准备发行

1. 同步根 `package.json`、根 `package-lock.json` 的项目版本及 `apps/web/package.json`，记录本版更新日志。
2. 按[素材流程](asset-compression.md)准备完整 public 和服务端运行资源，保留字体许可及素材声明。
3. 提交拟发布的源码和文档，使 Git 工作区干净；ignored 运行资源和本地存档继续保留在工作区。
4. 安装 Git、Node.js、npm 与 tar。实际上传还需 [GitHub CLI](https://cli.github.com/) 并完成 `gh auth login`，`origin` 指向目标 GitHub 仓库。

只生成本地发行附件：

```bash
npm run release:build
```

该命令按锁文件执行 `npm ci`，依次构建 Web 和服务端，组装程序目录，生成两个 `.tar.gz` 附件和发布说明，输出到 `dist/github/v1.0.3/`。它不会创建 Git 标签、推送或调用 GitHub 发布。

原有 `npm run release:package -- <新目录>` 继续组装包含所有资源的完整运行目录，供本地部署与 Docker 使用；GitHub 脚本使用其 `--without-public` 选项拆分素材。完整目录不携带 GitHub 安装元数据，安装包内服务端依赖后直接运行 `start.mjs`。

## 执行 GitHub 发布

明确需要上传时执行：

```bash
npm run release:github
```

可使用自定义发布说明文件：

```bash
npm run release:github -- --notes /path/to/release-notes.md
```

脚本从干净的 HEAD 构建，记录源码提交并生成两个附件，随后创建对应 Git 标签、推送标签到 origin、创建 GitHub 草稿、上传两个附件，全部成功后公开 Release。推送标签同时上传该提交的源码；GitHub 分支更新按项目 Git 流程单独处理。

需要部署到 Forgejo 时，先完成该版本的 GitHub Release，再推送源码到 Forgejo 的 `main`。流水线按根 `package.json` 的版本安装两个附件、导入带本次提交 SHA 标签的资源镜像，再构建应用和部署；附件尚未公开时资源安装步骤失败，需完成发布后重新运行流水线。沿用已发布版本的代码更新复用该版本附件，资源变化使用新版本。完整配置见[Forgejo 自动部署](../deployment/forgejo.md)。

已有同标签草稿可重跑脚本，附件会在草稿中重新上传；已公开版本与指向其它提交的标签会被拒绝，修订使用新版本号。上传中断时保留草稿，恢复前两个附件不会作为已完成版本公开。

## 限制与许可

- 每个附件必须小于 GitHub 的 2 GiB 上限。脚本在上传前检查大小，超限时按压缩配方调整素材后重新打包。
- 原创代码、工具与文档采用 [CDTank 非商业研究用途源码许可](../LICENSE)，保留 [NOTICE](../NOTICE)。原作素材和第三方字体保留各自权利，完整素材分发需取得相应授权；来源见[素材说明](asset-sources.md)。
