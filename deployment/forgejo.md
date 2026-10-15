# Forgejo 自动部署

仓库：[13352889546/cdtank](https://git.cloyd.fun/13352889546/cdtank)。Forgejo 在 `192.168.10.140:13000` 提供 HTTP 服务，仓库默认分支为 `main`。

HTTP 反代上游：[http://192.168.10.140:61002/](http://192.168.10.140:61002/)。网页、模型、音频和 WebSocket `/game` 共用此端口；玩家通过下述 HTTPS 域名访问，以启用 WebGPU。

宿主机 `61002` 监听所有网络接口。Nginx Proxy Manager 将 `tank.cloyd.fun` 转发到 `http://172.17.0.1:61002`，并开启 WebSocket 支持，域名入口为 [https://tank.cloyd.fun/](https://tank.cloyd.fun/)。

手动构建与部署、通用 HTTPS 配置及 Docker 卷备份恢复见[Docker 部署](../docs/docker-deployment.md)。

## 发布

推送到 `main` 自动触发 `.forgejo/workflows/deploy.yml`；也可在仓库 Actions 页面手动运行。仓库专用的 `cdtank-deploy` runner 使用目标机器的 Docker socket，镜像直接在该 Docker 上构建和部署。新版本先按[GitHub 发布流程](../docs/github-publication.md)公开同版本的程序包与资产包，再推送到 Forgejo；沿用已发布版本的代码更新继续使用该版本资源。

```sh
git remote add forgejo http://192.168.10.140:13000/13352889546/cdtank.git
git push forgejo HEAD:main
```

流水线依次执行：

1. 检出源码，运行 `node scripts/install-assets.mjs`，按根 `package.json` 的版本下载固定 GitHub Release 的两个附件，替换 `apps/web/public/` 和 `apps/server/resources/`。
2. 运行 `bash deployment/import-assets.sh "cdtank-assets:<提交 SHA>"`，将本次安装的完整运行目录导入目标 Docker。
3. 构建应用镜像，通过 `--build-arg CDTANK_ASSETS_IMAGE=cdtank-assets:<提交 SHA>` 指定本次资源镜像。
4. 通过 Compose 更新服务，等待 HTTP 健康检查通过。

资源下载或导入失败时流水线停止，只有镜像构建成功才进入部署。构建容器使用 Node.js 24.16，安装锁定依赖，构建 Web 与服务端，再组装独立发行目录。资源包含 UI 图集、独立图片、模型贴图、涂鸦小地图和双画质战斗资源；构建阶段注入 `deployment/assets/ui/fonts/xiangjiao-brush.ttf` 与 `Silkscreen-Regular.ttf`，并生成碰撞资产。runner 需要 Node.js 22 或更高版本、Bash、GNU `install` 与 tar，并能访问 GitHub Releases、npm 和 Docker 镜像源。

## 运行资源与 runner

自动部署每次从固定版本的 Release 安装资源并导入镜像。手动部署可在包含已安装运行资源的源码目录中指定资源镜像标签：

```sh
bash deployment/import-assets.sh cdtank-assets:1.0.2
docker build --build-arg CDTANK_ASSETS_IMAGE=cdtank-assets:1.0.2 --tag cdtank:1.0.2 .
```

脚本补入上述字体，只打包 `apps/web/public/` 和 `apps/server/resources/`，包含服务端数据表和碰撞数据。导入前按[美术发布流程](../docs/original-assets.md)准备图集、两套战斗素材和清单，或从同版本 Release 安装。省略标签时导入 `cdtank-assets:local`，与 Dockerfile 的默认值一致；指定标签时将同一值传入构建参数 `CDTANK_ASSETS_IMAGE`。资源更新需发布新版本附件，随后推送该版本源码触发自动同步。

`cdtank-runner` 容器使用本机的 `coding-node22:ssh-20260624` 镜像和已安装的 Forgejo runner。注册范围为此仓库，标签为 `cdtank-deploy:host`；注册信息保存在 `cdtank-runner` 卷中，启动配置保存在 `config.yml`。Docker socket 挂载到 `/var/run/docker.sock`。迁移设备时注册相同标签的仓库 runner，流水线会下载并导入配套资源。

镜像保留 `cdtank:<提交 SHA>` 和 `cdtank:latest` 标签。只有镜像构建成功后才更新服务；Compose 等待 HTTP 健康检查通过后完成部署。账户数据保存在 `cdtank-accounts` 卷的 `accounts.sqlite` 中，容器更新和重启保留存档。

## 运维

在连接目标 Docker 的终端中执行：

```sh
docker logs --tail 100 cdtank
docker compose -f deployment/compose.yml ps
```

回退到保留的镜像：

```sh
CDTANK_IMAGE_TAG=<提交 SHA> docker compose -f deployment/compose.yml up --detach --wait
```

账户备份命令将文件写入同一持久卷：

```sh
docker exec cdtank node account-snapshot.mjs backup \
  /app/state/accounts.sqlite /app/state/accounts-backup-20261008.sqlite
docker cp cdtank:/app/state/accounts-backup-20261008.sqlite ./accounts-backup-20261008.sqlite
```

备份路径须尚不存在。恢复规则见[运行与账户存档](operations.md)。发布会重启服务；正在进行的房间与比赛按既有重启规则结束，玩家重新进入大厅。移除卷会删除账户存档，应保留 `cdtank-accounts`。
