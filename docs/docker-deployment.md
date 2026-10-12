# Docker 部署

Docker 部署使用完整运行资源：先导入本地资源镜像，再从源码构建应用镜像，最后通过 Compose 启动。网页、静态资源和 `/game` WebSocket 由同一容器提供；账户保存在独立 Docker 卷中。

以下命令以 **1.0.2** 为例，在仓库根目录执行，后续版本替换应用镜像标签并使用同版本资源。自动部署到 Forgejo 的配置见[Forgejo 部署](../deployment/forgejo.md)。

## 环境与资源

需要 Docker Engine 和支持 `--wait` 的 Docker Compose 插件。下面的资源导入命令使用 Bash、GNU `install` 和 tar，适用于 Linux 或已开启 Docker Desktop 集成的 WSL2 环境。构建时需要访问 Node.js 镜像源和 npm registry。

准备与源码配套的两个运行资源目录：

| 目录 | 内容 |
| --- | --- |
| `apps/web/public/` | 完整 assets、data、manifests，包含 UI 图集、双画质战斗素材、模型、音频、字体和许可 |
| `apps/server/resources/` | tables、场景配置和预烘焙碰撞数据 |

已有配套运行目录可直接使用。使用 Release 安装资源时，在宿主机安装 Node.js 24.16 或更高版本，然后执行：

```sh
npm ci
npm run assets:install
```

安装脚本会从同版本的程序包和资产包取出所需资源；本地附件参数见[GitHub 发布与安装](github-publication.md)。素材编辑与生成见[运行美术资源](original-assets.md)。

## 构建并启动

将资源导入用于构建应用的同一个 Docker 引擎：

```sh
bash deployment/import-assets.sh
```

脚本补入仓库字体，将两个运行资源目录导入 Dockerfile 的 `assets` 阶段所引用的本地镜像。该资源镜像使用构建配置中的固定标签；每次更新素材后重新导入，应用镜像标签单独记录版本。资源导入不会包含创作源图或账户存档。

构建应用镜像并启动 Compose：

```sh
docker build --tag cdtank:1.0.2 .
CDTANK_IMAGE_TAG=1.0.2 docker compose -f deployment/compose.yml up --detach --wait --wait-timeout 180
```

Dockerfile 在容器内安装依赖、构建 Web 和服务端、组装完整发行目录。运行镜像包含程序、完整资源与运行依赖，以 `node` 用户执行 `node start.mjs`。

Compose 使用已构建的镜像；`--wait` 等待 HTTP 健康检查通过。当前配置为：

| 配置 | 值 |
| --- | --- |
| 应用镜像 | `cdtank:${CDTANK_IMAGE_TAG:-latest}` |
| 容器名 | `cdtank` |
| 宿主机／容器端口 | `61002:3001` |
| 账户卷 | `cdtank-accounts`，挂载到 `/app/state` |
| 默认账户库 | `/app/state/accounts.sqlite` |
| 重启策略 | `unless-stopped` |

本机打开 [http://localhost:61002](http://localhost:61002)。WebGPU 在玩家浏览器中运行，Docker 宿主机负责联机服务和静态托管。

## HTTPS 与 WebSocket

**域名和局域网 IP 的玩家入口必须使用 HTTPS，否则浏览器不会开放 WebGPU。** HTTP localhost 可用于本机访问。Docker 端口提供 HTTP，由反向代理配置浏览器信任的 TLS 证书；浏览器联机使用 `wss://`。

使用 Nginx Proxy Manager 时，将域名转发到能访问 Docker 宿主机的地址、端口 `61002`，开启 WebSocket 支持，并配置 SSL 证书与 HTTPS 跳转。代理也运行在容器中时，上游应使用宿主机地址或容器网络中的服务地址。

下面是反向代理运行在 Docker 宿主机上的 nginx 示例；替换域名和证书路径：

```nginx
server {
    listen 80;
    server_name game.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name game.example.com;
    ssl_certificate /etc/letsencrypt/live/game.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/game.example.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:61002;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /game {
        proxy_pass http://127.0.0.1:61002/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 60s;
    }
}
```

`/game` 的上游地址末尾保留 `/`，将浏览器的 `/game` 转发为 TSRPC 监听的 `/`；普通页面和静态资源保留原路径。Compose 默认在宿主机所有接口发布 61002；如代理就在宿主机，可将端口映射改为 `127.0.0.1:61002:3001`。

## 更新与日常运行

更新源码和配套资源后，重新执行资源导入、镜像构建与 Compose 启动命令，并将 `CDTANK_IMAGE_TAG` 改为新版本。保留之前的应用镜像，可通过指定其标签回退。固定版本部署时，后续 Compose 命令沿用同一 `CDTANK_IMAGE_TAG`。

查看运行状态和日志：

```sh
CDTANK_IMAGE_TAG=1.0.2 docker compose -f deployment/compose.yml ps
docker logs --tail 100 cdtank
```

停止或重新启动服务：

```sh
CDTANK_IMAGE_TAG=1.0.2 docker compose -f deployment/compose.yml stop
CDTANK_IMAGE_TAG=1.0.2 docker compose -f deployment/compose.yml up --detach --wait --wait-timeout 180
```

容器重建和重启保留 `cdtank-accounts`。普通停服也可使用 `docker compose -f deployment/compose.yml down`，该命令保留命名卷；`down --volumes` 会删除账户卷。服务重启后账户可继续登录，正在进行的房间与比赛结束，玩家重新进入大厅。

## 账户备份与恢复

运行中备份账户库，再将备份复制到宿主机：

```sh
docker exec cdtank node account-snapshot.mjs backup \
  /app/state/accounts.sqlite /app/state/accounts-backup-1.0.2.sqlite
docker cp cdtank:/app/state/accounts-backup-1.0.2.sqlite ./accounts-backup-1.0.2.sqlite
```

每次备份使用新的目标文件名。工具使用 SQLite 在线备份 API，包含已提交的 WAL 数据；运行中的数据库按此方式备份。

恢复时先停止服务，从宿主机备份恢复到卷中的新数据库路径：

```sh
CDTANK_IMAGE_TAG=1.0.2 docker compose -f deployment/compose.yml stop
docker run --rm \
  --volume cdtank-accounts:/app/state \
  --volume "$PWD:/backups:ro" \
  cdtank:1.0.2 node account-snapshot.mjs restore \
  /backups/accounts-backup-1.0.2.sqlite /app/state/accounts-restored.sqlite
```

在 `deployment/compose.yml` 的 `services.app` 下增加以下配置，与 `image` 同级：

```yaml
environment:
  ACCOUNT_DB_PATH: /app/state/accounts-restored.sqlite
```

随后执行上述 Compose 启动命令。原库和备份保留，后续备份源路径使用当前 `ACCOUNT_DB_PATH`；数据库恢复不包含正在进行的房间或浏览器本地设置。完整存档规则见[运行与账户存档](../deployment/operations.md)。

