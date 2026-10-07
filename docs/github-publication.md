# GitHub 源码发布

仓库包含应用代码、转换工具、开发与还原文档、现有验收入口、依赖锁文件和资源安装脚本。已提取并转换的运行资源、字体和解码数据表压缩为 `.tar.xz`，单独发布到 GitHub Releases。下载源码后按 README 安装依赖及资源并启动，无需原客户端。

安装后运行资源位于 `recovery/output/web-assets/`，内容表位于 `recovery/output/verified/tables/`，源码引用的地图预览、角色缩略图与界面图片位于 `apps/web/src/assets/`。原客户端、下载与恢复输出、依赖、构建产物、账户存档及本地配置由 `.gitignore` 排除。

## 资源包

- 发布页：[v0.9.0](https://github.com/qq617564112/cdtank/releases/tag/v0.9.0)。
- 附件：`cdtank-assets-0.9.0.tar.xz`，使用 `xz -9e` 压缩。
- 内容：已安装的高清贴图、模型、界面图片、字体、音频、数据表、移动数据和自定义地图；解压后约 6.81 GB。
- 安装命令：`npm run assets:install`，通过固定版本地址下载并解压到仓库根目录。

更新资源版本时同步修改安装脚本中的版本、发布附件名和 README 下载链接。

v0.3.0 资源包保留供旧版本使用；当前安装脚本下载 v0.9.0，解压即得到已处理的资源，不调用原客户端提取器或高清素材生成工具。

## 仓库首页

- 简介：`《阿猫阿狗大作战 Online》的非官方 Web 复刻，基于 Babylon.js、React、TypeScript 和 Node.js。`
- 可选主题：`game`、`remake`、`babylonjs`、`typescript`、`react`、`multiplayer`、`tank-game`。
- README 提供项目介绍、原作参考图片、本地运行说明和文档导航。

## 上传源码

先确认拟发布的代码和文档，再提交到本地 Git。现有未提交的功能改动应随对应功能确认后纳入发布提交。

在 GitHub 创建空仓库，将仓库地址添加为远端；使用实际仓库地址和准备发布的本地分支名：

```bash
git remote add origin https://github.com/OWNER/REPOSITORY.git
git push -u origin HEAD:main
```

该命令把当前分支推送为 GitHub 的 `main`。已有远端时使用其地址；图片和 Markdown 文档使用仓库相对路径，随源码一起显示。

## 素材与许可

代码开源许可证尚未指定。公开源码与授予使用、修改、再分发许可是不同的事项，代码许可由项目权利人选定。

原作图片、美术、模型、音乐、音效和第三方字体保留各自权利。README 参考图片的来源见[素材来源](assets/README.md)；分发原客户端、完整素材或包含素材的发行包需取得相应授权。

## 运行发行包

运行发行包由已安装资源、内容表及两端构建产物组装，与 GitHub 仓库分别管理。打包、安装、启动和存档说明见[运行与账户存档](../deployment/operations.md)。
