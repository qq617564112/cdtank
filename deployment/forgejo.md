# Forgejo 自动部署

仓库：[13352889546/cdtank](https://git.cloyd.fun/13352889546/cdtank)。Forgejo 在 `192.168.10.140:13000` 提供 HTTP 服务，仓库默认分支为 `main`。

访问地址：[http://192.168.10.140:61002/](http://192.168.10.140:61002/)。网页、模型、音频和 WebSocket `/game` 共用此端口。

宿主机 `61002` 监听所有网络接口。Nginx Proxy Manager 将 `tank.cloyd.fun` 转发到 `http://172.17.0.1:61002`，并开启 WebSocket 支持，域名入口为 [https://tank.cloyd.fun/](https://tank.cloyd.fun/)。

## 发布

推送到 `main` 自动触发 `.forgejo/workflows/deploy.yml`；也可在仓库 Actions 页面手动运行。仓库专用的 `cdtank-deploy` runner 使用目标机器的 Docker socket，镜像直接在该 Docker 上构建和部署。

```sh
git remote add forgejo http://192.168.10.140:13000/13352889546/cdtank.git
git push forgejo HEAD:main
```

流水线使用 Node.js 24.16，安装锁定依赖，构建 Web 与服务端，再组装独立发行目录。运行资源来自目标 Docker 上的 `cdtank-assets:1.0.0-20261008-original` 镜像，包含原版界面素材、模型贴图和 27 张彩铅小地图，后续源码更新直接复用。首次构建需要访问 npm 和 Docker 镜像源。

## 运行资源与 runner

在包含已安装运行资源的源码目录中，将资源导入目标 Docker：

```sh
bash deployment/import-assets.sh
```

脚本只打包 `recovery/output/web-assets/` 和 `recovery/output/verified/tables/`，约 2.3 GB。固定资源镜像与源码分别保存。资源更新时修改导入脚本及 Dockerfile 中的资源版本，重新导入目标 Docker。

`cdtank-runner` 容器使用本机的 `coding-node22:ssh-20260624` 镜像和已安装的 Forgejo runner。注册范围为此仓库，标签为 `cdtank-deploy:host`；注册信息保存在 `cdtank-runner` 卷中，启动配置保存在 `config.yml`。Docker socket 挂载到 `/var/run/docker.sock`。迁移设备时需先导入运行资源并注册相同标签的仓库 runner。

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
