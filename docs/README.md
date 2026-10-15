# 文档索引与当前状态

当前版本为 **1.0.3**，提供 WebGPU 浏览器客户端、独立房间进程、持久账户、手绘界面和怀旧／HD 两套战斗素材。1.0.1 及以后采用程序包与 public 资产包分开发布、Node 安装器自动安装并启动的流程；命令见[发布与安装](github-publication.md)，发布历史见[更新日志](../CHANGELOG.md)。

## 当前版本的主要变化

| 方面 | 当前实现 | 说明 |
| --- | --- | --- |
| 渲染 | 战场、我的家、商城预览使用 WebGPU；HUD、模型动画与粒子由 GPU 绘制 | [WebGPU 渲染](webgpu-rendering.md) |
| 移动端 | 横屏页面、双摇杆、开火与单排道具栏、专用结算页；准星为 54×42 逻辑像素 | [移动端页面](mobile-pages-ui.md) · [战斗操作](mobile-battle-ui.md) |
| 房间服务 | 每房间独立子进程推进权威模拟；主进程管理连接、账户事务及消息转发 | [房间进程决策](room-processes.md) |
| 训练 | 单人训练房间运行于浏览器 Worker，沿用混战规则和机器人 AI；训练期间屏蔽房间邀请 | [训练模式](training-mode.md) |
| UI 与文字 | 手绘界面、卡通控件、图片艺术字与 glyph，动态正文使用随仓库提供的字体 | [UI 文字](ui-text-rendering.md) |
| 高清素材 | 21 辆战车、323 套有效皮肤、履带动画及地图物件高清贴图；保留几何、UV 和动画 | [高清素材](hd-assets.md) · [战车素材](tank-hd.md) |
| 资源生产 | HD 源图经配方生成 compressed，再发布怀旧与 HD 两套战斗资源；UI 无损合图 | [压缩与发布](asset-compression.md) |
| 模型预计算 | 资产阶段计算描边法线、MV3 姿态映射及 CVD 动画布局，浏览器直接读取成品 | [几何预计算](geometry-preprocessing.md) |
| HUD 更新 | 按显示数据订阅，装填与道具冷却更新原节点，头像及静态图案复用 | [HUD 渲染](hud-react-performance.md) |
| 加载 | UI 预加载，模型和声音按需缓存；电脑登录页可选全资源预下载，入场前准备动态道具与掉落物 | [资源加载](resource-loading.md) |
| 入场进度 | 地图配置、模型解析、地形和场景实例化进度汇入战斗加载界面 | [更新日志](../CHANGELOG.md) |
| 显示 | 电脑与移动端怀旧／HD 选择、移动端 HD 采用怀旧尺寸与全局横屏；五档渲染分辨率、4× MSAA、卡通描边、FPS、亮度／饱和度／对比度 | [显示设置](display-settings.md) |
| 场景光照 | 电脑按地图配置方向光和实时软阴影；移动端关闭实时阴影并降低特效密度 | [场景光照与阴影](recovery/ground-contact-shadows.md) · [显示设置](display-settings.md) |
| 会话 | URL 记录页面与弹窗，刷新恢复账户、频道和原房间；房主退出后转交权限 | [路由与恢复](navigation.md) |
| 部署 | 正式资源迁入 apps 目录，Forgejo Actions 构建 Docker 镜像，持久卷保存账户 | [自动部署](../deployment/forgejo.md) |
| GitHub 发行 | 同版本程序／public 资产分包；安装器下载资产、安装依赖、启动服务并打开浏览器 | [发布与安装](github-publication.md) |
| 许可 | 原创代码、工具与文档采用非商业研究用途源码许可，素材与第三方许可单独声明 | [LICENSE](../LICENSE) · [NOTICE](../NOTICE) |

## 运行与开发

| 内容 | 文档 |
| --- | --- |
| 项目介绍、运行步骤和操作 | [根目录 README](../README.md) |
| 工程职责、命令和环境变量 | [开发指南](development.md) |
| CPU 脱困、目标保持与逐车轨迹分析 | [CPU 轨迹](cpu-trajectories.md) |
| 页面、弹窗和刷新恢复 | [路由与会话恢复](navigation.md) |
| 显示选项、默认值与保存行为 | [显示设置](display-settings.md) |
| 手机与平板的页面布局、16:9 至 21:9 比例及触摸操作 | [移动端页面 UI](mobile-pages-ui.md) · [移动端战斗 UI](mobile-battle-ui.md) |
| 静态目录、预加载与浏览器缓存 | [public 目录](public-assets.md) · [资源加载](resource-loading.md) |
| 原场景、模式组合与自定义场景 | [可玩地图](playable-maps.md) · [测试地图](test-map.md) · [出生规则](spawn-rules.md) |
| 消息显示 | [游戏消息](game-messages.md) |
| 独立发行目录、代理和存档 | [运行与账户存档](../deployment/operations.md) |
| Docker 资源准备、构建、Compose 与存档 | [Docker 部署](docker-deployment.md) |
| Forgejo runner 与自动部署 | [Forgejo 部署](../deployment/forgejo.md) |
| GitHub 程序／资产发布与安装 | [发布说明](github-publication.md) |

## 素材与渲染

| 内容 | 文档 |
| --- | --- |
| 原版、HD、压缩成品与发布目录 | [运行美术资源](original-assets.md) |
| 尺寸依据、编码方案、合图和怀旧与 HD 两套战斗素材输出 | [高清资产压缩与精灵图](asset-compression.md) |
| WASM 资产预计算、描边法线、姿态去重与 CVD 数据布局 | [几何数据离线预计算](geometry-preprocessing.md) |
| 战车与地图物件高清化 | [高清素材](hd-assets.md) · [战车素材](tank-hd.md) |
| 涂鸦小地图与文字 | [小地图风格](minimap-cartoon-style.md) · [UI 文字](ui-text-rendering.md) |
| WebGPU、HUD、场景动画与运行计数 | [渲染实现](webgpu-rendering.md) |
| 地图光照、投影范围和材质 | [场景光照与软阴影](recovery/ground-contact-shadows.md) |
| 两张地图的既有实测 | [浏览器性能](browser-performance.md) |
| 12 人团队对战的实测记录与采样范围 | [团队战斗性能](team12-performance.md) |
| 房间拆分、导航与碰撞 | [房间进程](room-processes.md) · [服务端计算](server-performance.md) |
| 可选的原客户端提取与转换 | [资源重建](recovery/reproducible-assets.md) |
| 原作背景、参考图片和版权 | [原作介绍](game-background.md) · [素材来源](asset-sources.md) |

还原来源、规则、业务专题与完成状态见[还原索引](recovery/README.md)和[任务清单](recovery/tasklist.md)。本地取证与预览产物的链接需在保留相应输出的工作区中读取。

## 限制与证据范围

- 10 月 9 日两图的浏览器与房间性能数据保留当时的设备、分辨率和渲染配置；后续素材与阴影改动没有新的整局性能结论。
- 房间和比赛保存在内存中，服务重启后重新入场；刷新恢复受现有 30 秒窗口限制。
- 高清模型预览、静态走查、原程序取证和多人游戏验收各有范围，功能完成状态按任务清单记录。
