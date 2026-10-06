# GitHub 源码发布

源码仓库保留应用代码、转换工具、开发与还原文档、现有验收入口和依赖锁文件。运行资源、依赖、构建产物、账户存档及本地配置由 `.gitignore` 排除。

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

运行发行包由资源重建及两端构建产物组装，与 GitHub 源码仓库分别管理。打包、安装、启动和存档说明见[运行与账户存档](../deployment/operations.md)。

